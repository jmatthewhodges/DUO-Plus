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

// Service hierarchy — lower number = higher priority
// Dental (#1) > Optical (#2) > Medical (#3) > Haircut (#4)
$serviceHierarchy = [
    'dentalHygiene'    => 1,
    'dentalExtraction' => 1,
    'optical'          => 2,
    'medicalExam'      => 3,
    'medicalFollowUp'  => 3,
    'haircut'          => 4,
];

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
foreach ($svcRows as $row) {
    $serviceInfo[$row['ServiceID']] = [
        'ServiceName' => $row['ServiceName'],
        'available'   => !$row['IsClosed'] && (int)$row['SeatsInProgress'] < (int)$row['MaxSeats'],
    ];
}

/*
---------------------------------
  Checked-In Clients (FIFO)
---------------------------------
*/
$clientsStmt = $mysqli->prepare(
    "SELECT v.VisitID, v.ClientID, v.FirstCheckedIn,
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

    $vsStmt = $mysqli->prepare(
        "SELECT vs.VisitID, vs.ServiceID, s.ServiceName
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

    $pending = $visitServiceMap[$visitID];

    // Sort by hierarchy (lowest number = highest priority)
    usort($pending, function ($a, $b) use ($serviceHierarchy) {
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

    $waitList[] = [
        'ClientID'            => $client['ClientID'],
        'FirstName'           => $client['FirstName'],
        'MiddleInitial'       => $client['MiddleInitial'],
        'LastName'            => $client['LastName'],
        'DOB'                 => $client['DOB'],
        'ServiceSelections'   => implode(',', $serviceIDs),
        'AllServicesComplete' => $remaining === 0,
    ];
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
]);
