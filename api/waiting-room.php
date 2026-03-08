<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Returns queue data for the waiting-room dashboard.
 *               - NowServing: next client to be served (FIFO by
 *                 FirstCheckedIn) with an assigned service chosen
 *                 by hierarchy + seat availability.
 *               - WaitList: remaining checked-in clients.
 *               - Services: all available service definitions.
 * ============================================================
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];

// Service hierarchy — loaded from DB (category SortOrder drives priority).
// Operational services inherit their parent category's SortOrder.
$serviceHierarchy = [];
$hierStmt = $mysqli->prepare(
    "SELECT s.ServiceID,
            COALESCE(p.SortOrder, s.SortOrder) AS Priority
     FROM tblServices s
     LEFT JOIN tblServices p ON p.ServiceID = s.ParentServiceID
     WHERE s.ServiceType = 'operational'
        OR (s.ServiceType = 'category' AND NOT EXISTS (
            SELECT 1 FROM tblServices c WHERE c.ParentServiceID = s.ServiceID
        ))"
);
if ($hierStmt) {
    $hierStmt->execute();
    $hierRows = $hierStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $hierStmt->close();
    foreach ($hierRows as $hr) {
        $serviceHierarchy[$hr['ServiceID']] = (int)$hr['Priority'];
    }
}

/*
---------------------------------
  Active Event
---------------------------------
*/
$eventStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 LIMIT 1");
if (!$eventStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare event query: ' . $mysqli->error]);
    exit;
}
$eventStmt->execute();
$eventResult = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

if (!$eventResult) {
    // No active event — return empty sets
    http_response_code(200);
    echo json_encode(['success' => true, 'NowServing' => [], 'WaitList' => [], 'Services' => []]);
    exit;
}
$activeEventID = $eventResult['EventID'];

/*
---------------------------------
  Event Service Availability
---------------------------------
*/
$svcStmt = $mysqli->prepare(
    "SELECT es.ServiceID, s.ServiceName, es.SeatsInProgress, es.MaxSeats, es.IsClosed
     FROM tblEventServices es
     JOIN tblServices s ON s.ServiceID = es.ServiceID
     WHERE es.EventID = ?"
);
if (!$svcStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare availability query: ' . $mysqli->error]);
    exit;
}
$svcStmt->bind_param('s', $activeEventID);
$svcStmt->execute();
$svcRows = $svcStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$svcStmt->close();

// ServiceID => { ServiceName, available }
$serviceInfo = [];
$servicesList = []; // for frontend
foreach ($svcRows as $row) {
    $serviceInfo[$row['ServiceID']] = [
        'ServiceName' => $row['ServiceName'],
        'available'   => !$row['IsClosed'] && (int)$row['SeatsInProgress'] < (int)$row['MaxSeats'],
    ];
    $servicesList[] = [
        'ServiceID'   => $row['ServiceID'],
        'ServiceName' => $row['ServiceName'],
        'IsClosed'    => (bool)$row['IsClosed'],
    ];
}

/*
---------------------------------
  Checked-In Clients (FIFO)
---------------------------------
*/
$clientsStmt = $mysqli->prepare(
    "SELECT v.VisitID, v.ClientID, v.FirstCheckedIn, v.EnteredWaitingRoom,
            c.FirstName, c.MiddleInitial, c.LastName, c.DOB
     FROM tblVisits v
     JOIN tblClients c ON c.ClientID = v.ClientID
     WHERE v.EventID = ? AND v.RegistrationStatus = 'CheckedIn'
     ORDER BY v.FirstCheckedIn ASC"
);
if (!$clientsStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare clients query: ' . $mysqli->error]);
    exit;
}
$clientsStmt->bind_param('s', $activeEventID);
$clientsStmt->execute();
$clients = $clientsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$clientsStmt->close();

/*
---------------------------------
  Pending Visit Services
---------------------------------
*/
$visitIDs = array_column($clients, 'VisitID');
$visitServiceMap = []; // VisitID => [ { ServiceID, ServiceName }, ... ]

if (!empty($visitIDs)) {
    $placeholders = implode(',', array_fill(0, count($visitIDs), '?'));
    $types = str_repeat('s', count($visitIDs));

    // All visit services (any status) — for the update modal
    $allVsStmt = $mysqli->prepare(
        "SELECT vs.VisitID, vs.VisitServiceID, vs.ServiceID, vs.ServiceStatus, s.ServiceName
         FROM tblVisitServices vs
         JOIN tblServices s ON s.ServiceID = vs.ServiceID
         WHERE vs.VisitID IN ($placeholders)"
    );
    $allVisitServiceMap = []; // VisitID => [ { ServiceID, ServiceStatus, ... } ]
    if ($allVsStmt) {
        $allVsStmt->bind_param($types, ...$visitIDs);
        $allVsStmt->execute();
        $allVsRows = $allVsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $allVsStmt->close();
        foreach ($allVsRows as $avs) {
            $allVisitServiceMap[$avs['VisitID']][] = $avs;
        }
    }

    // Pending only — for queue logic
    $vsStmt = $mysqli->prepare(
        "SELECT vs.VisitID, vs.ServiceID, s.ServiceName, vs.IsFastTracked
         FROM tblVisitServices vs
         JOIN tblServices s ON s.ServiceID = vs.ServiceID
         WHERE vs.VisitID IN ($placeholders)
         AND vs.ServiceStatus = 'Pending'"
    );
    if (!$vsStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to prepare visit-services query: ' . $mysqli->error]);
        exit;
    }
    $vsStmt->bind_param($types, ...$visitIDs);
    $vsStmt->execute();
    $vsRows = $vsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $vsStmt->close();

    foreach ($vsRows as $vs) {
        $visitServiceMap[$vs['VisitID']][] = $vs;
    }

    // Count remaining (Pending + In-Progress) services per visit
    $vsRemainStmt = $mysqli->prepare(
        "SELECT vs.VisitID,
                SUM(CASE WHEN vs.ServiceStatus IN ('Pending','In-Progress') THEN 1 ELSE 0 END) AS RemainingCount
         FROM tblVisitServices vs
         WHERE vs.VisitID IN ($placeholders)
         GROUP BY vs.VisitID"
    );
    $remainingMap = [];
    if ($vsRemainStmt) {
        $vsRemainStmt->bind_param($types, ...$visitIDs);
        $vsRemainStmt->execute();
        $remainRows = $vsRemainStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $vsRemainStmt->close();
        foreach ($remainRows as $rr) {
            $remainingMap[$rr['VisitID']] = (int)$rr['RemainingCount'];
        }
    }

    // Track which visits currently have an In-Progress service (client is at a station)
    $inProgressStmt = $mysqli->prepare(
        "SELECT vs.VisitID, vs.ServiceID, s.ServiceName
         FROM tblVisitServices vs
         JOIN tblServices s ON s.ServiceID = vs.ServiceID
         WHERE vs.VisitID IN ($placeholders)
           AND vs.ServiceStatus = 'In-Progress'"
    );
    $visitsInProgress = [];
    if ($inProgressStmt) {
        $inProgressStmt->bind_param($types, ...$visitIDs);
        $inProgressStmt->execute();
        $ipRows = $inProgressStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $inProgressStmt->close();
        foreach ($ipRows as $ipRow) {
            $visitsInProgress[$ipRow['VisitID']] = [
                'ServiceID'   => $ipRow['ServiceID'],
                'ServiceName' => $ipRow['ServiceName'],
            ];
        }
    }
}

/*
---------------------------------
  Determine "Now Serving"
---------------------------------
  Walk clients in FIFO order. For each, sort their pending
  services by hierarchy and pick the first one whose
  SeatsInProgress < MaxSeats.
*/
$nowServing = null;
$nowServingClientID = null;

foreach ($clients as $client) {
    $visitID = $client['VisitID'];
    if (!isset($visitServiceMap[$visitID])) continue;

    // Skip clients who are currently being served at a station
    if (isset($visitsInProgress[$visitID])) continue;

    $pending = $visitServiceMap[$visitID];

    // Sort by: fast-tracked first, then by hierarchy (lowest SortOrder = highest priority)
    usort($pending, function ($a, $b) use ($serviceHierarchy) {
        // IsFastTracked DESC: fast-tracked services come first
        $ftA = (int)($a['IsFastTracked'] ?? 0);
        $ftB = (int)($b['IsFastTracked'] ?? 0);
        if ($ftA !== $ftB) return $ftB - $ftA;

        // Then by hierarchy priority ASC
        $pa = $serviceHierarchy[$a['ServiceID']] ?? 99;
        $pb = $serviceHierarchy[$b['ServiceID']] ?? 99;
        return $pa - $pb;
    });

    // Pick first service with an available seat
    foreach ($pending as $svc) {
        $sid = $svc['ServiceID'];
        if (isset($serviceInfo[$sid]) && $serviceInfo[$sid]['available']) {
            $serviceIDs = array_column($pending, 'ServiceID');
            $nowServing = [
                'ClientID'            => $client['ClientID'],
                'FirstName'           => $client['FirstName'],
                'MiddleInitial'       => $client['MiddleInitial'],
                'LastName'            => $client['LastName'],
                'DOB'                 => $client['DOB'],
                'ServiceSelections'   => implode(',', $serviceIDs),
                'AssignedServiceID'   => $sid,
                'AssignedServiceName' => $svc['ServiceName'],
            ];
            $nowServingClientID = $client['ClientID'];
            break 2; // found — exit both loops
        }
    }
}

/*
---------------------------------
  Wait List (all checked-in clients)
---------------------------------
*/
$waitList = [];
foreach ($clients as $client) {
    $visitID = $client['VisitID'];
    $pending = $visitServiceMap[$visitID] ?? [];
    $serviceIDs = array_column($pending, 'ServiceID');

    $remaining = $remainingMap[$visitID] ?? 0;

    // Client was skipped if FirstCheckedIn was reset after original EnteredWaitingRoom
    $wasSkipped = (!empty($client['EnteredWaitingRoom']) && !empty($client['FirstCheckedIn']))
        && $client['FirstCheckedIn'] > $client['EnteredWaitingRoom'];

    $entry = [
        'ClientID'            => $client['ClientID'],
        'VisitID'             => $client['VisitID'],
        'FirstName'           => $client['FirstName'],
        'MiddleInitial'       => $client['MiddleInitial'],
        'LastName'            => $client['LastName'],
        'DOB'                 => $client['DOB'],
        'ServiceSelections'   => implode(',', $serviceIDs),
        'AllServicesComplete' => $remaining === 0,
        'CurrentServiceName'  => null,
        'WasSkipped'          => $wasSkipped,
        'VisitServices'       => $allVisitServiceMap[$client['VisitID']] ?? [],
    ];

    if (isset($visitsInProgress[$visitID])) {
        $entry['CurrentServiceName'] = $visitsInProgress[$visitID]['ServiceName'];
    }

    $waitList[] = $entry;
}

/*
---------------------------------
  Response
---------------------------------
*/
http_response_code(200);
echo json_encode([
    'success'    => true,
    'NowServing' => $nowServing ? [$nowServing] : [],
    'WaitList'   => $waitList,
    'Services'   => $servicesList,
]);
