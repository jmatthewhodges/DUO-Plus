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

// --- Counts by status (single query) ---
$countStmt = $mysqli->prepare(
    "SELECT vs.ServiceStatus, COUNT(DISTINCT c.ClientID) AS cnt
     FROM tblVisitServices vs
     JOIN tblVisits v ON v.VisitID = vs.VisitID
     JOIN tblClients c ON c.ClientID = v.ClientID
     WHERE vs.ServiceID IN ($placeholders)
     GROUP BY vs.ServiceStatus"
);
if (!$countStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}
$countStmt->bind_param($types, ...$serviceIDs);
$countStmt->execute();
$countRows = $countStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$countStmt->close();

$counts = ['Pending' => 0, 'In-Progress' => 0, 'Complete' => 0, 'Standby' => 0];
foreach ($countRows as $row) {
    $counts[$row['ServiceStatus']] = (int)$row['cnt'];
}

// --- Average service time from movement logs ---
// Pairs "Seated" → "Completed" actions per VisitServiceID
$avgStmt = $mysqli->prepare(
    "SELECT AVG(TIMESTAMPDIFF(MINUTE, seated.Timestamp, completed.Timestamp)) AS avgMinutes
     FROM tblMovementLogs seated
     JOIN tblMovementLogs completed
       ON completed.VisitServiceID = seated.VisitServiceID
       AND completed.Action = 'Completed'
     JOIN tblVisitServices vs ON vs.VisitServiceID = seated.VisitServiceID
     WHERE seated.Action = 'Seated'
     AND vs.ServiceID IN ($placeholders)"
);
$avgServiceTime = null;
if ($avgStmt) {
    $avgStmt->bind_param($types, ...$serviceIDs);
    $avgStmt->execute();
    $avgRow = $avgStmt->get_result()->fetch_assoc();
    $avgStmt->close();
    if ($avgRow && $avgRow['avgMinutes'] !== 0) {
        $avgServiceTime = round((float)$avgRow['avgMinutes']);
    }
}

// --- Waitlist (all clients with Pending status for these services) ---
$waitStmt = $mysqli->prepare(
    "SELECT c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB
     FROM tblVisitServices vs
     JOIN tblVisits v ON v.VisitID = vs.VisitID
     JOIN tblClients c ON c.ClientID = v.ClientID
     WHERE vs.ServiceID IN ($placeholders)
     AND vs.ServiceStatus = 'Pending'
     ORDER BY vs.QueuePriority ASC"
);
if (!$waitStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}
$waitStmt->bind_param($types, ...$serviceIDs);
$waitStmt->execute();
$waitList = $waitStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$waitStmt->close();

// --- Response ---
http_response_code(200);
echo json_encode([
    'success'        => true,
    'pendingCount'   => $counts['Pending'],
    'inProgressCount'=> $counts['In-Progress'],
    'completedCount' => $counts['Complete'],
    'avgServiceTime' => $avgServiceTime,
    'waitList'       => $waitList,
]);