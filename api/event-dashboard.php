<?php
/**
 * ============================================================
 *  File:        event-dashboard.php
 *  Purpose:     Event-selectable dashboard data endpoint.
 *               Returns event list, selected event metrics,
 *               chart data, and service utilization.
 * ============================================================
 */

require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

$mysqli = $GLOBALS['mysqli'];

function normalizeEventLabel(array $row): string
{
    $datePart = !empty($row['EventDate']) ? $row['EventDate'] : 'No Date';
    $locationPart = trim((string)($row['LocationName'] ?? ''));
    $label = $locationPart !== '' ? ($datePart . ' - ' . $locationPart) : $datePart;
    if ((int)($row['IsActive'] ?? 0) === 1) {
        $label .= ' (Active)';
    }
    return $label;
}

function defaultMetrics(): array
{
    return [
        'totalVisits' => 0,
        'registered' => 0,
        'checkedIn' => 0,
        'abandoned' => 0,
        'translatorNeeded' => 0,
        'clientsServed' => 0,
        'volunteersServed' => 0,
        'chiropractorClientsServed' => 0,
        'chiropractorVolunteersServed' => 0,
        'volunteerBadgesPrinted' => 0,
    ];
}

function safeInt($value): int
{
    if ($value === null || $value === '') {
        return 0;
    }
    return (int)$value;
}

try {
    $eventsStmt = $mysqli->prepare(
        "SELECT EventID, EventDate, LocationName, IsActive
         FROM tblEvents
         ORDER BY EventDate DESC, LocationName ASC"
    );

    if (!$eventsStmt) {
        throw new RuntimeException('Failed to prepare events query: ' . $mysqli->error);
    }

    $eventsStmt->execute();
    $eventRows = $eventsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $eventsStmt->close();

    $events = [];
    $eventByID = [];
    foreach ($eventRows as $row) {
        $event = [
            'EventID' => $row['EventID'],
            'EventDate' => $row['EventDate'],
            'LocationName' => $row['LocationName'],
            'IsActive' => safeInt($row['IsActive']),
            'label' => normalizeEventLabel($row),
        ];
        $events[] = $event;
        $eventByID[$row['EventID']] = $event;
    }

    $requestedEventID = trim((string)($_GET['eventID'] ?? ''));
    $selectedEventID = null;

    if ($requestedEventID !== '' && isset($eventByID[$requestedEventID])) {
        $selectedEventID = $requestedEventID;
    }

    if ($selectedEventID === null && !empty($events)) {
        $activeEvent = null;
        foreach ($events as $event) {
            if ((int)$event['IsActive'] === 1) {
                $activeEvent = $event;
                break;
            }
        }

        if ($activeEvent) {
            $selectedEventID = $activeEvent['EventID'];
        } else {
            $selectedEventID = $events[0]['EventID'];
        }
    }

    if ($selectedEventID === null) {
        echo json_encode([
            'success' => true,
            'events' => [],
            'selectedEvent' => null,
            'metrics' => defaultMetrics(),
            'charts' => [
                'serviceOutcomes' => [
                    'labels' => [],
                    'assigned' => [],
                    'completed' => [],
                ],
                'serviceWaitTimes' => [
                    'labels' => [],
                    'selectedAvgMinutes' => [],
                    'pastAvgMinutes' => [],
                    'pastEventID' => null,
                ],
            ],
            'registrationChoices' => [],
            'serviceOutcomes' => [],
            'serviceWaitComparisons' => [],
            'serviceUtilization' => [],
        ]);
        exit;
    }

    $previousEventID = null;
    $eventCount = count($events);
    for ($index = 0; $index < $eventCount; $index++) {
        if (($events[$index]['EventID'] ?? '') !== $selectedEventID) {
            continue;
        }
        if (isset($events[$index + 1])) {
            $previousEventID = (string)($events[$index + 1]['EventID'] ?? '');
        }
        break;
    }

    $metrics = defaultMetrics();

    $visitTotalsStmt = $mysqli->prepare(
        "SELECT
            COUNT(*) AS TotalVisits,
            SUM(CASE WHEN RegistrationStatus = 'Registered' THEN 1 ELSE 0 END) AS RegisteredCount,
            SUM(CASE WHEN RegistrationStatus = 'CheckedIn' THEN 1 ELSE 0 END) AS CheckedInCount,
            SUM(CASE WHEN COALESCE(IsAbandoned, 0) = 1 THEN 1 ELSE 0 END) AS AbandonedCount
         FROM tblVisits
         WHERE EventID = ?"
    );

    if ($visitTotalsStmt) {
        $visitTotalsStmt->bind_param('s', $selectedEventID);
        $visitTotalsStmt->execute();
        $visitTotals = $visitTotalsStmt->get_result()->fetch_assoc() ?: [];
        $visitTotalsStmt->close();

        $metrics['totalVisits'] = safeInt($visitTotals['TotalVisits'] ?? 0);
        $metrics['registered'] = safeInt($visitTotals['RegisteredCount'] ?? 0);
        $metrics['checkedIn'] = safeInt($visitTotals['CheckedInCount'] ?? 0);
        $metrics['abandoned'] = safeInt($visitTotals['AbandonedCount'] ?? 0);
    }

    $translatorStmt = $mysqli->prepare(
        "SELECT COUNT(DISTINCT v.ClientID) AS TranslatorNeededCount
         FROM tblVisits v
         INNER JOIN tblClients c ON c.ClientID = v.ClientID
         WHERE v.EventID = ?
           AND COALESCE(c.TranslatorNeeded, 0) = 1"
    );

    if ($translatorStmt) {
        $translatorStmt->bind_param('s', $selectedEventID);
        $translatorStmt->execute();
        $translatorRow = $translatorStmt->get_result()->fetch_assoc() ?: [];
        $translatorStmt->close();

        $metrics['translatorNeeded'] = safeInt($translatorRow['TranslatorNeededCount'] ?? 0);
    }

    $analyticsKeys = [
        'clientsServed',
        'volunteersServed',
        'chiropractorClientsServed',
        'chiropractorVolunteersServed',
    ];

    $analyticsStmt = $mysqli->prepare(
        "SELECT StatKey, StatValue
         FROM tblAnalytics
         WHERE EventID = ?
           AND StatKey IN (?, ?, ?, ?)"
    );

    if ($analyticsStmt) {
        $analyticsStmt->bind_param(
            'sssss',
            $selectedEventID,
            $analyticsKeys[0],
            $analyticsKeys[1],
            $analyticsKeys[2],
            $analyticsKeys[3]
        );
        $analyticsStmt->execute();
        $analyticsRes = $analyticsStmt->get_result();

        while ($row = $analyticsRes->fetch_assoc()) {
            $key = (string)$row['StatKey'];
            if (array_key_exists($key, $metrics)) {
                $metrics[$key] = safeInt($row['StatValue']);
            }
        }

        $analyticsStmt->close();
    }

    $volunteerBadgeStmt = $mysqli->prepare(
        "SELECT COUNT(DISTINCT LOWER(TRIM(VolunteerName))) AS UniqueBadgesPrinted
         FROM tblVolunteerBadgePrintLog
         WHERE EventID = ?"
    );

    if ($volunteerBadgeStmt) {
        $volunteerBadgeStmt->bind_param('s', $selectedEventID);
        $volunteerBadgeStmt->execute();
        $volunteerBadgeRow = $volunteerBadgeStmt->get_result()->fetch_assoc() ?: [];
        $volunteerBadgeStmt->close();

        $metrics['volunteerBadgesPrinted'] = safeInt($volunteerBadgeRow['UniqueBadgesPrinted'] ?? 0);
    }

    $topServiceLabels = [];
    $topServiceSeries = [];
    $topServicesStmt = $mysqli->prepare(
        "SELECT
            vs.ServiceID,
            COALESCE(s.ServiceName, vs.ServiceID) AS ServiceName,
            COUNT(*) AS Total
         FROM tblVisitServices vs
         INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
         LEFT JOIN tblServices s ON s.ServiceID = vs.ServiceID
         WHERE v.EventID = ?
         GROUP BY vs.ServiceID, COALESCE(s.ServiceName, vs.ServiceID)
         ORDER BY Total DESC
         LIMIT 8"
    );

    if ($topServicesStmt) {
        $topServicesStmt->bind_param('s', $selectedEventID);
        $topServicesStmt->execute();
        $topRes = $topServicesStmt->get_result();
        while ($row = $topRes->fetch_assoc()) {
            $topServiceLabels[] = (string)$row['ServiceName'];
            $topServiceSeries[] = safeInt($row['Total']);
        }
        $topServicesStmt->close();
    }

    // Step 5 registration choices (category services shown during registration).
    $registrationChoices = [];
    if ($previousEventID !== null && $previousEventID !== '') {
        $registrationChoicesStmt = $mysqli->prepare(
            "SELECT
                s.ServiceID,
                COALESCE(s.ServiceName, s.ServiceID) AS ServiceName,
                COALESCE(sel.ChosenCount, 0) AS ChosenCount,
                COALESCE(past.ChosenCount, 0) AS PastChosenCount
             FROM tblServices s
             LEFT JOIN (
                SELECT ServiceID, COUNT(DISTINCT ClientID) AS ChosenCount
                FROM tblVisitServiceSelections
                WHERE EventID = ?
                GROUP BY ServiceID
             ) sel ON sel.ServiceID = s.ServiceID
             LEFT JOIN (
                SELECT ServiceID, COUNT(DISTINCT ClientID) AS ChosenCount
                FROM tblVisitServiceSelections
                WHERE EventID = ?
                GROUP BY ServiceID
             ) past ON past.ServiceID = s.ServiceID
             WHERE s.ServiceType = 'category'
               AND COALESCE(s.ParentServiceID, '') = ''
             ORDER BY COALESCE(s.SortOrder, 9999) ASC, ServiceName ASC
             LIMIT 4"
        );

        if ($registrationChoicesStmt) {
            $registrationChoicesStmt->bind_param('ss', $selectedEventID, $previousEventID);
            $registrationChoicesStmt->execute();
            $registrationChoicesRes = $registrationChoicesStmt->get_result();

            while ($row = $registrationChoicesRes->fetch_assoc()) {
                $chosenCount = safeInt($row['ChosenCount']);
                $pastChosenCount = safeInt($row['PastChosenCount']);

                $registrationChoices[] = [
                    'serviceID' => (string)$row['ServiceID'],
                    'serviceName' => (string)$row['ServiceName'],
                    'chosenCount' => $chosenCount,
                    'pastChosenCount' => $pastChosenCount,
                    'deltaChosenCount' => $chosenCount - $pastChosenCount,
                ];
            }

            $registrationChoicesStmt->close();
        }
    } else {
        $registrationChoicesStmt = $mysqli->prepare(
            "SELECT
                s.ServiceID,
                COALESCE(s.ServiceName, s.ServiceID) AS ServiceName,
                COALESCE(sel.ChosenCount, 0) AS ChosenCount
             FROM tblServices s
             LEFT JOIN (
                SELECT ServiceID, COUNT(DISTINCT ClientID) AS ChosenCount
                FROM tblVisitServiceSelections
                WHERE EventID = ?
                GROUP BY ServiceID
             ) sel ON sel.ServiceID = s.ServiceID
             WHERE s.ServiceType = 'category'
               AND COALESCE(s.ParentServiceID, '') = ''
             ORDER BY COALESCE(s.SortOrder, 9999) ASC, ServiceName ASC
             LIMIT 4"
        );

        if ($registrationChoicesStmt) {
            $registrationChoicesStmt->bind_param('s', $selectedEventID);
            $registrationChoicesStmt->execute();
            $registrationChoicesRes = $registrationChoicesStmt->get_result();

            while ($row = $registrationChoicesRes->fetch_assoc()) {
                $registrationChoices[] = [
                    'serviceID' => (string)$row['ServiceID'],
                    'serviceName' => (string)$row['ServiceName'],
                    'chosenCount' => safeInt($row['ChosenCount']),
                    'pastChosenCount' => null,
                    'deltaChosenCount' => null,
                ];
            }

            $registrationChoicesStmt->close();
        }
    }

    $serviceOutcomes = [];
    $serviceOutcomeStmt = $mysqli->prepare(
        "SELECT
            base.ServiceID,
            COALESCE(s.ServiceName, base.ServiceID) AS ServiceName,
            COALESCE(ass.AssignedCount, 0) AS AssignedCount,
            COALESCE(comp.CompletedCount, 0) AS CompletedCount
         FROM (
             SELECT ServiceID FROM tblEventServices WHERE EventID = ?
             UNION
             SELECT ServiceID FROM tblVisitServiceSelections WHERE EventID = ?
             UNION
             SELECT vs.ServiceID
             FROM tblVisitServices vs
             INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
             WHERE v.EventID = ?
         ) base
         LEFT JOIN tblServices s ON s.ServiceID = base.ServiceID
                 LEFT JOIN (
                         SELECT vs.ServiceID, COUNT(DISTINCT vs.VisitID) AS AssignedCount
             FROM tblVisitServices vs
             INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
             WHERE v.EventID = ?
                             AND vs.ServiceStatus IN ('Pending', 'Standby', 'In-Progress', 'Complete')
                         GROUP BY vs.ServiceID
                 ) ass ON ass.ServiceID = base.ServiceID
                 LEFT JOIN (
                         SELECT vs.ServiceID, COUNT(DISTINCT vs.VisitID) AS CompletedCount
                         FROM tblVisitServices vs
                         INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
                         WHERE v.EventID = ?
                             AND vs.ServiceStatus = 'Complete'
                         GROUP BY vs.ServiceID
                 ) comp ON comp.ServiceID = base.ServiceID
         WHERE
             -- Exclude high-level category buckets for post-event service outcomes.
             LOWER(COALESCE(s.ServiceID, '')) NOT IN ('dental', 'medical')
             AND LOWER(COALESCE(s.ServiceName, '')) NOT IN ('dental', 'medical')
             AND (
                 COALESCE(s.ServiceType, 'operational') <> 'category'
                 OR LOWER(COALESCE(s.ServiceID, '')) IN ('optical', 'haircut')
                 OR LOWER(COALESCE(s.ServiceName, '')) IN ('optical', 'haircut')
             )
         ORDER BY COALESCE(s.SortOrder, 9999) ASC, ServiceName ASC"
    );

    if ($serviceOutcomeStmt) {
        $serviceOutcomeStmt->bind_param(
            'sssss',
            $selectedEventID,
            $selectedEventID,
            $selectedEventID,
            $selectedEventID,
            $selectedEventID
        );
        $serviceOutcomeStmt->execute();
        $serviceOutcomeRes = $serviceOutcomeStmt->get_result();

        while ($row = $serviceOutcomeRes->fetch_assoc()) {
            $assignedCount = safeInt($row['AssignedCount']);
            $completedCount = safeInt($row['CompletedCount']);
            $completionRate = $assignedCount > 0 ? round(($completedCount / $assignedCount) * 100, 1) : 0;

            $serviceOutcomes[] = [
                'serviceID' => (string)$row['ServiceID'],
                'serviceName' => (string)$row['ServiceName'],
                'assignedCount' => $assignedCount,
                'completedCount' => $completedCount,
                'completionRate' => $completionRate,
                'notCompletedCount' => max($assignedCount - $completedCount, 0),
            ];
        }

        $serviceOutcomeStmt->close();
    }

    $serviceOutcomeChartRows = array_values(array_filter(
        $serviceOutcomes,
        function (array $row): bool {
            return (
                safeInt($row['assignedCount']) > 0 ||
                safeInt($row['completedCount']) > 0
            );
        }
    ));

    usort(
        $serviceOutcomeChartRows,
        function (array $left, array $right): int {
            return safeInt($right['assignedCount']) <=> safeInt($left['assignedCount']);
        }
    );

    $serviceOutcomeChartRows = array_slice($serviceOutcomeChartRows, 0, 10);

    $serviceOutcomeChartLabels = [];
    $serviceOutcomeAssignedSeries = [];
    $serviceOutcomeCompletedSeries = [];

    foreach ($serviceOutcomeChartRows as $row) {
        $serviceOutcomeChartLabels[] = (string)$row['serviceName'];
        $serviceOutcomeAssignedSeries[] = safeInt($row['assignedCount']);
        $serviceOutcomeCompletedSeries[] = safeInt($row['completedCount']);
    }

    $serviceWaitComparisons = [];
    $serviceWaitChartLabels = [];
    $serviceWaitChartSelectedSeries = [];
    $serviceWaitChartPastSeries = [];

    $serviceWaitByServiceID = [];

    $selectedWaitStmt = $mysqli->prepare(
        "SELECT
            vs.ServiceID,
            COALESCE(s.ServiceName, vs.ServiceID) AS ServiceName,
            AVG(TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp)) AS SelectedAvgMinutes
         FROM tblVisitServices vs
         INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
         LEFT JOIN tblServices s ON s.ServiceID = vs.ServiceID
         INNER JOIN tblMovementLogs ci
            ON ci.VisitServiceID = vs.VisitServiceID
            AND ci.Action = CONCAT(vs.ServiceID, 'CheckIn')
         INNER JOIN tblMovementLogs co
            ON co.VisitServiceID = vs.VisitServiceID
            AND co.Action = CONCAT(vs.ServiceID, 'CheckOut')
         WHERE v.EventID = ?
           AND TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp) >= 0
           AND LOWER(COALESCE(s.ServiceID, '')) NOT IN ('dental', 'medical')
           AND LOWER(COALESCE(s.ServiceName, '')) NOT IN ('dental', 'medical')
           AND (
               COALESCE(s.ServiceType, 'operational') <> 'category'
               OR LOWER(COALESCE(s.ServiceID, '')) IN ('optical', 'haircut')
               OR LOWER(COALESCE(s.ServiceName, '')) IN ('optical', 'haircut')
           )
         GROUP BY vs.ServiceID, s.ServiceName, s.SortOrder"
    );

    if ($selectedWaitStmt) {
        $selectedWaitStmt->bind_param('s', $selectedEventID);
        $selectedWaitStmt->execute();
        $selectedWaitRes = $selectedWaitStmt->get_result();

        while ($row = $selectedWaitRes->fetch_assoc()) {
            $serviceID = (string)$row['ServiceID'];
            $serviceWaitByServiceID[$serviceID] = [
                'serviceID' => $serviceID,
                'serviceName' => (string)$row['ServiceName'],
                'selectedAvgMinutes' => ($row['SelectedAvgMinutes'] === null)
                    ? null
                    : round((float)$row['SelectedAvgMinutes'], 1),
                'pastAvgMinutes' => null,
                'deltaMinutes' => null,
            ];
        }

        $selectedWaitStmt->close();
    }

    if ($previousEventID !== null && $previousEventID !== '') {
        $pastWaitStmt = $mysqli->prepare(
            "SELECT
                vs.ServiceID,
                COALESCE(s.ServiceName, vs.ServiceID) AS ServiceName,
                AVG(TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp)) AS PastAvgMinutes
             FROM tblVisitServices vs
             INNER JOIN tblVisits v ON v.VisitID = vs.VisitID
             LEFT JOIN tblServices s ON s.ServiceID = vs.ServiceID
             INNER JOIN tblMovementLogs ci
                ON ci.VisitServiceID = vs.VisitServiceID
                AND ci.Action = CONCAT(vs.ServiceID, 'CheckIn')
             INNER JOIN tblMovementLogs co
                ON co.VisitServiceID = vs.VisitServiceID
                AND co.Action = CONCAT(vs.ServiceID, 'CheckOut')
             WHERE v.EventID = ?
               AND TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp) >= 0
               AND LOWER(COALESCE(s.ServiceID, '')) NOT IN ('dental', 'medical')
               AND LOWER(COALESCE(s.ServiceName, '')) NOT IN ('dental', 'medical')
               AND (
                   COALESCE(s.ServiceType, 'operational') <> 'category'
                   OR LOWER(COALESCE(s.ServiceID, '')) IN ('optical', 'haircut')
                   OR LOWER(COALESCE(s.ServiceName, '')) IN ('optical', 'haircut')
               )
             GROUP BY vs.ServiceID, s.ServiceName, s.SortOrder"
        );

        if ($pastWaitStmt) {
            $pastWaitStmt->bind_param('s', $previousEventID);
            $pastWaitStmt->execute();
            $pastWaitRes = $pastWaitStmt->get_result();

            while ($row = $pastWaitRes->fetch_assoc()) {
                $serviceID = (string)$row['ServiceID'];
                $pastAvgMinutes = ($row['PastAvgMinutes'] === null)
                    ? null
                    : round((float)$row['PastAvgMinutes'], 1);

                if (!isset($serviceWaitByServiceID[$serviceID])) {
                    $serviceWaitByServiceID[$serviceID] = [
                        'serviceID' => $serviceID,
                        'serviceName' => (string)$row['ServiceName'],
                        'selectedAvgMinutes' => null,
                        'pastAvgMinutes' => $pastAvgMinutes,
                        'deltaMinutes' => null,
                    ];
                    continue;
                }

                $serviceWaitByServiceID[$serviceID]['pastAvgMinutes'] = $pastAvgMinutes;
            }

            $pastWaitStmt->close();
        }
    }

    foreach ($serviceWaitByServiceID as $row) {
        $selectedAvgMinutes = $row['selectedAvgMinutes'];
        $pastAvgMinutes = $row['pastAvgMinutes'];
        if ($selectedAvgMinutes === null && $pastAvgMinutes === null) {
            continue;
        }

        $row['deltaMinutes'] = ($selectedAvgMinutes !== null && $pastAvgMinutes !== null)
            ? round($selectedAvgMinutes - $pastAvgMinutes, 1)
            : null;

        $serviceWaitComparisons[] = $row;
    }

    usort(
        $serviceWaitComparisons,
        function (array $left, array $right): int {
            $leftValue = (float)($left['selectedAvgMinutes'] ?? 0);
            $rightValue = (float)($right['selectedAvgMinutes'] ?? 0);
            return $rightValue <=> $leftValue;
        }
    );

    $serviceWaitComparisons = array_slice($serviceWaitComparisons, 0, 10);

    foreach ($serviceWaitComparisons as $row) {
        $serviceWaitChartLabels[] = (string)$row['serviceName'];
        $serviceWaitChartSelectedSeries[] = (float)($row['selectedAvgMinutes'] ?? 0);
        $serviceWaitChartPastSeries[] = (float)($row['pastAvgMinutes'] ?? 0);
    }

    $serviceUtilization = [];
    $utilizationStmt = $mysqli->prepare(
        "SELECT
            es.ServiceID,
            COALESCE(s.ServiceName, es.ServiceID) AS ServiceName,
            COALESCE(es.MaxCapacity, 0) AS MaxCapacity,
            COALESCE(es.CurrentAssigned, 0) AS CurrentAssigned,
            COALESCE(es.CurrentStandby, 0) AS CurrentStandby,
            COALESCE(es.SeatsInProgress, 0) AS SeatsInProgress,
            COALESCE(es.IsClosed, 0) AS IsClosed
         FROM tblEventServices es
         LEFT JOIN tblServices s ON s.ServiceID = es.ServiceID
         WHERE es.EventID = ?
         ORDER BY COALESCE(s.SortOrder, 9999) ASC, ServiceName ASC"
    );

    if ($utilizationStmt) {
        $utilizationStmt->bind_param('s', $selectedEventID);
        $utilizationStmt->execute();
        $utilizationRes = $utilizationStmt->get_result();
        while ($row = $utilizationRes->fetch_assoc()) {
            $maxCapacity = safeInt($row['MaxCapacity']);
            $assigned = safeInt($row['CurrentAssigned']);
            $utilizationPct = 0;

            if ($maxCapacity > 0) {
                $utilizationPct = round(($assigned / $maxCapacity) * 100, 1);
            }

            $serviceUtilization[] = [
                'serviceID' => (string)$row['ServiceID'],
                'serviceName' => (string)$row['ServiceName'],
                'maxCapacity' => $maxCapacity,
                'currentAssigned' => $assigned,
                'currentStandby' => safeInt($row['CurrentStandby']),
                'seatsInProgress' => safeInt($row['SeatsInProgress']),
                'isClosed' => safeInt($row['IsClosed']),
                'utilizationPercent' => $utilizationPct,
            ];
        }
        $utilizationStmt->close();
    }

    echo json_encode([
        'success' => true,
        'events' => $events,
        'selectedEvent' => $eventByID[$selectedEventID] ?? null,
        'metrics' => $metrics,
        'charts' => [
            'serviceOutcomes' => [
                'labels' => $serviceOutcomeChartLabels,
                'assigned' => $serviceOutcomeAssignedSeries,
                'completed' => $serviceOutcomeCompletedSeries,
            ],
            'serviceWaitTimes' => [
                'labels' => $serviceWaitChartLabels,
                'selectedAvgMinutes' => $serviceWaitChartSelectedSeries,
                'pastAvgMinutes' => $serviceWaitChartPastSeries,
                'pastEventID' => $previousEventID,
            ],
            'topServices' => [
                'labels' => $topServiceLabels,
                'series' => $topServiceSeries,
            ],
        ],
        'registrationChoices' => $registrationChoices,
        'serviceOutcomes' => $serviceOutcomes,
        'serviceWaitComparisons' => $serviceWaitComparisons,
        'serviceUtilization' => $serviceUtilization,
        'generatedAt' => date('Y-m-d H:i:s'),
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load dashboard data.',
        'error' => $e->getMessage(),
    ]);
}
