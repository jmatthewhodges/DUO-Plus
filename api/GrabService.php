<?php
/**
 * ============================================================
 *  File:        GrabService.php
 *  Purpose:     Returns stats and waitlist for one or more services.
 *               Accepts ServiceID via query string (comma-separated
 *               or repeated, e.g. ?ServiceID=medicalExam,medicalFollowUp
 *               or ?ServiceID[]=medicalExam&ServiceID[]=medicalFollowUp).
 * ============================================================
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];

// --- Parse ServiceID(s) from query string ---
$raw = $_GET['ServiceID'] ?? null;

if (!$raw) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing ServiceID parameter']);
    exit;
}

// Support array (?ServiceID[]=a&ServiceID[]=b) or comma-separated (?ServiceID=a,b)
if (is_array($raw)) {
    $serviceIDs = array_values(array_filter(array_map('trim', $raw)));
} else {
    $serviceIDs = array_values(array_filter(array_map('trim', explode(',', $raw))));
}

if (empty($serviceIDs)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No valid ServiceID values provided']);
    exit;
}

$placeholders = implode(',', array_fill(0, count($serviceIDs), '?'));
$types = str_repeat('s', count($serviceIDs));

// Resolve active event so service stats and capacity reflect the current event.
$eventStmt = $mysqli->prepare(
    "SELECT EventID
     FROM tblEvents
     WHERE IsActive = 1
     ORDER BY EventDate DESC
     LIMIT 1"
);
if (!$eventStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare active event query: ' . $mysqli->error]);
    exit;
}
$eventStmt->execute();
$eventRow = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

if (!$eventRow || empty($eventRow['EventID'])) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'pendingCount' => 0,
        'inProgressCount' => 0,
        'completedCount' => 0,
        'avgServiceTime' => null,
        'pastAvgServiceTime' => null,
        'capacityData' => [],
        'waitList' => [],
    ]);
    exit;
}

$currentEventID = $eventRow['EventID'];
$previousEventID = null;

// Resolve previous event (most recent non-current event).
$prevEventStmt = $mysqli->prepare(
    "SELECT EventID
     FROM tblEvents
     WHERE EventID <> ?
     ORDER BY EventDate DESC
     LIMIT 1"
);
if ($prevEventStmt) {
    $prevEventStmt->bind_param('s', $currentEventID);
    $prevEventStmt->execute();
    $prevEventRow = $prevEventStmt->get_result()->fetch_assoc();
    $prevEventStmt->close();
    if ($prevEventRow && !empty($prevEventRow['EventID'])) {
        $previousEventID = $prevEventRow['EventID'];
    }
}

// --- Combined counts + waitlist (one query instead of two) ---
// Fetches all statuses so PHP can count per-status; waitlist is filtered in PHP.
$dataStmt = $mysqli->prepare(
    "SELECT c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB,
            vs.ServiceID, vs.ServiceStatus, v.IsAbandoned, v.FirstCheckedIn,
            assigned.AssignedServiceDetails
     FROM tblVisitServices vs
     JOIN tblVisits v ON v.VisitID = vs.VisitID
     JOIN tblClients c ON c.ClientID = v.ClientID
     LEFT JOIN (
         SELECT vs2.VisitID, v2.EventID,
                GROUP_CONCAT(
                    CONCAT(
                        REPLACE(vs2.ServiceID, '::', ''),
                        '::',
                        REPLACE(s2.ServiceName, '::', ''),
                        '::',
                        REPLACE(vs2.ServiceStatus, '::', '')
                    )
                    ORDER BY s2.ServiceName
                    SEPARATOR '||'
                ) AS AssignedServiceDetails
         FROM tblVisitServices vs2
                 JOIN tblVisits v2 ON v2.VisitID = vs2.VisitID
         JOIN tblServices s2 ON s2.ServiceID = vs2.ServiceID
                 WHERE v2.EventID = ?
                 GROUP BY vs2.VisitID, v2.EventID
         ) assigned ON assigned.VisitID = v.VisitID AND assigned.EventID = v.EventID
     WHERE vs.ServiceID IN ($placeholders)
             AND v.EventID = ?
       AND vs.ServiceStatus IN ('Pending', 'In-Progress', 'Complete', 'Standby')
     ORDER BY v.FirstCheckedIn ASC, vs.QueuePriority ASC"
);
if (!$dataStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}
$dataStmt->bind_param('s' . $types . 's', ...[$currentEventID, ...$serviceIDs, $currentEventID]);
$dataStmt->execute();
$allRows = $dataStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$dataStmt->close();

$counts = ['Pending' => 0, 'In-Progress' => 0, 'Complete' => 0, 'Standby' => 0];
$waitList = [];
$countedClients = [];
$abandonedByService = [];
foreach ($allRows as $row) {
    $status = $row['ServiceStatus'];
    $isAbandoned = (int)($row['IsAbandoned'] ?? 0) === 1;
    $clientKey = $row['ClientID'] . ':' . $status;

    if ($isAbandoned && in_array($status, ['Pending', 'Standby'], true)) {
        $serviceKey = $row['ServiceID'];
        $abandonedByService[$serviceKey] = ($abandonedByService[$serviceKey] ?? 0) + 1;
    }

    if (!isset($countedClients[$clientKey])) {
        $countedClients[$clientKey] = true;
        if (isset($counts[$status])) {
            if (!($isAbandoned && in_array($status, ['Pending', 'Standby'], true))) {
                $counts[$status]++;
            }
        }
    }
    if (in_array($status, ['Pending', 'In-Progress', 'Complete', 'Standby'], true)) {
        $waitList[] = $row;
    }
}

// --- Average service time (current event only) ---
// Actions logged as "{ServiceID}CheckIn" / "{ServiceID}CheckOut" by ServiceScan.php
$avgStmt = $mysqli->prepare(
    "SELECT AVG(TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp)) AS avgMinutes
     FROM tblVisitServices vs
     JOIN tblVisits v ON v.VisitID = vs.VisitID
     JOIN tblMovementLogs ci
       ON ci.VisitServiceID = vs.VisitServiceID
       AND ci.Action = CONCAT(vs.ServiceID, 'CheckIn')
     JOIN tblMovementLogs co
       ON co.VisitServiceID = vs.VisitServiceID
       AND co.Action = CONCAT(vs.ServiceID, 'CheckOut')
     WHERE vs.ServiceID IN ($placeholders)
       AND v.EventID = ?"
);
$avgServiceTime = null;
if ($avgStmt) {
    $avgStmt->bind_param($types . 's', ...[...$serviceIDs, $currentEventID]);
    $avgStmt->execute();
    $avgRow = $avgStmt->get_result()->fetch_assoc();
    $avgStmt->close();
    if ($avgRow && $avgRow['avgMinutes'] !== null) {
        $avgServiceTime = round((float)$avgRow['avgMinutes']);
    }
}

// --- Average service time (previous event only) ---
$pastAvgServiceTime = null;
if ($previousEventID) {
        $pastAvgStmt = $mysqli->prepare(
                "SELECT AVG(TIMESTAMPDIFF(MINUTE, ci.Timestamp, co.Timestamp)) AS avgMinutes
                 FROM tblVisitServices vs
                 JOIN tblVisits v ON v.VisitID = vs.VisitID
                 JOIN tblMovementLogs ci
                     ON ci.VisitServiceID = vs.VisitServiceID
                     AND ci.Action = CONCAT(vs.ServiceID, 'CheckIn')
                 JOIN tblMovementLogs co
                     ON co.VisitServiceID = vs.VisitServiceID
                     AND co.Action = CONCAT(vs.ServiceID, 'CheckOut')
                 WHERE vs.ServiceID IN ($placeholders)
                     AND v.EventID = ?"
        );

        if ($pastAvgStmt) {
                $pastAvgStmt->bind_param($types . 's', ...[...$serviceIDs, $previousEventID]);
                $pastAvgStmt->execute();
                $pastAvgRow = $pastAvgStmt->get_result()->fetch_assoc();
                $pastAvgStmt->close();
                if ($pastAvgRow && $pastAvgRow['avgMinutes'] !== null) {
                        $pastAvgServiceTime = round((float)$pastAvgRow['avgMinutes']);
                }
        }
}

// --- Capacity data for availability bars (avoids a second HTTP request from the client) ---
$capStmt = $mysqli->prepare(
    "SELECT es.ServiceID, es.MaxCapacity, es.CurrentAssigned, es.IsClosed, es.StandbyLimit
     FROM tblEventServices es
     WHERE es.EventID = ? AND es.ServiceID IN ($placeholders)"
);
$capacityData = [];
if ($capStmt) {
    $capStmt->bind_param('s' . $types, $currentEventID, ...$serviceIDs);
    $capStmt->execute();
    $capRows = $capStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $capStmt->close();
    foreach ($capRows as $cr) {
        $maxCap   = (int)$cr['MaxCapacity'];
        $assigned = (int)$cr['CurrentAssigned'];
        $abandonedAdjust = (int)($abandonedByService[$cr['ServiceID']] ?? 0);
        $effectiveAssigned = max($assigned - $abandonedAdjust, 0);
        $capacityData[] = [
            'serviceID'       => $cr['ServiceID'],
            'maxCapacity'     => $maxCap,
            'currentAssigned' => $effectiveAssigned,
            'isClosed'        => (int)$cr['IsClosed'],
            'standbyLimit'    => (int)$cr['StandbyLimit'],
            'standbyCount'    => ($maxCap > 0 && $effectiveAssigned > $maxCap) ? ($effectiveAssigned - $maxCap) : 0,
        ];
    }
}

// --- Response ---
http_response_code(200);
echo json_encode([
    'success'        => true,
    'pendingCount'   => $counts['Pending'],
    'inProgressCount'=> $counts['In-Progress'],
    'completedCount' => $counts['Complete'],
    'avgServiceTime' => $avgServiceTime,
    'pastAvgServiceTime' => $pastAvgServiceTime,
    'capacityData'   => $capacityData,
    'waitList'       => $waitList,
]);