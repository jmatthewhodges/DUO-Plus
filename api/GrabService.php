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
$currentEventID = '4cbde538985861b9';

// --- Combined counts + waitlist (one query instead of two) ---
// Fetches all statuses so PHP can count per-status; waitlist is filtered in PHP.
$dataStmt = $mysqli->prepare(
    "SELECT c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB,
            vs.ServiceID, vs.ServiceStatus
     FROM tblVisitServices vs
     JOIN tblVisits v ON v.VisitID = vs.VisitID
     JOIN tblClients c ON c.ClientID = v.ClientID
     WHERE vs.ServiceID IN ($placeholders)
     ORDER BY FIELD(vs.ServiceStatus, 'In-Progress', 'Pending'), vs.QueuePriority ASC"
);
if (!$dataStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}
$dataStmt->bind_param($types, ...$serviceIDs);
$dataStmt->execute();
$allRows = $dataStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$dataStmt->close();

$counts = ['Pending' => 0, 'In-Progress' => 0, 'Complete' => 0, 'Standby' => 0];
$waitList = [];
$countedClients = [];
foreach ($allRows as $row) {
    $status = $row['ServiceStatus'];
    $clientKey = $row['ClientID'] . ':' . $status;
    if (!isset($countedClients[$clientKey])) {
        $countedClients[$clientKey] = true;
        if (isset($counts[$status])) $counts[$status]++;
    }
    if ($status === 'Pending' || $status === 'In-Progress') {
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
        $capacityData[] = [
            'serviceID'       => $cr['ServiceID'],
            'maxCapacity'     => $maxCap,
            'currentAssigned' => $assigned,
            'isClosed'        => (int)$cr['IsClosed'],
            'standbyLimit'    => (int)$cr['StandbyLimit'],
            'standbyCount'    => ($maxCap > 0 && $assigned > $maxCap) ? ($assigned - $maxCap) : 0,
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
    'capacityData'   => $capacityData,
    'waitList'       => $waitList,
]);