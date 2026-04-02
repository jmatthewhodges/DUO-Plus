<?php
/**
 * ============================================================
 *  File:        AbandonClient.php
 *  Description: Marks a client as abandoned for the current event.
 *               Sets IsAbandoned = 1 on their visit so the NowServing
 *               logic permanently skips them, and logs 'Abandoned' for
 *               each of their pending/standby services.
 *  Method:      POST  { "ClientID": "..." }
 * ============================================================
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$clientID = $input['ClientID'] ?? null;

if (!$clientID) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ClientID is required']);
    exit;
}

$mysqli = $GLOBALS['mysqli'];

// Get active event
$eventStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 LIMIT 1");
$eventStmt->execute();
$eventResult = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

if (!$eventResult) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No active event']);
    exit;
}
$activeEventID = $eventResult['EventID'];

// Get the client's visit
$visitStmt = $mysqli->prepare(
    "SELECT VisitID FROM tblVisits
     WHERE ClientID = ? AND EventID = ? AND RegistrationStatus = 'CheckedIn'
     LIMIT 1"
);
$visitStmt->bind_param('ss', $clientID, $activeEventID);
$visitStmt->execute();
$visitRow = $visitStmt->get_result()->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Client visit not found or not checked in']);
    exit;
}
$visitID = $visitRow['VisitID'];

// Mark visit as abandoned
$abandonStmt = $mysqli->prepare("UPDATE tblVisits SET IsAbandoned = 1 WHERE VisitID = ?");
$abandonStmt->bind_param('s', $visitID);
$abandonStmt->execute();
$abandonStmt->close();

// Log 'Abandoned' for every pending/standby service on this visit
$pendingStmt = $mysqli->prepare(
    "SELECT VisitServiceID FROM tblVisitServices WHERE VisitID = ? AND ServiceStatus IN ('Pending','Standby')"
);
if ($pendingStmt) {
    $pendingStmt->bind_param('s', $visitID);
    $pendingStmt->execute();
    $pendingRows = $pendingStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $pendingStmt->close();

    $now     = date('Y-m-d H:i:s');
    $logStmt = $mysqli->prepare(
        "INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp) VALUES (?, ?, 'Abandoned', ?)"
    );
    if ($logStmt) {
        foreach ($pendingRows as $pr) {
            $logID = uniqid('log_', true);
            $logStmt->bind_param('sss', $logID, $pr['VisitServiceID'], $now);
            $logStmt->execute();
        }
        $logStmt->close();
    }
}

echo json_encode(['success' => true, 'message' => 'Client marked as abandoned.']);
