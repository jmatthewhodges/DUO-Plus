<?php
/**
 * ============================================================
 *  File:        SkipClient.php
 *  Description: Skips the "Now Serving" client by moving them
 *               one position back in the FIFO queue. Sets their
 *               FirstCheckedIn to 1 second after the next client
 *               (no swap — avoids infinite loops).
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

$input = json_decode(file_get_contents('php://input'), true);
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

// Get the skipped client's visit
$skipStmt = $mysqli->prepare(
    "SELECT VisitID, FirstCheckedIn FROM tblVisits
     WHERE ClientID = ? AND EventID = ? AND RegistrationStatus = 'CheckedIn'
     LIMIT 1"
);
$skipStmt->bind_param('ss', $clientID, $activeEventID);
$skipStmt->execute();
$skipRow = $skipStmt->get_result()->fetch_assoc();
$skipStmt->close();

if (!$skipRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Client visit not found or not checked in']);
    exit;
}

$skippedVisitID = $skipRow['VisitID'];
$skippedTime    = $skipRow['FirstCheckedIn'];

// Find the next client in queue (the one directly behind the skipped client)
$nextStmt = $mysqli->prepare(
    "SELECT VisitID, FirstCheckedIn FROM tblVisits
     WHERE EventID = ? AND RegistrationStatus = 'CheckedIn'
       AND FirstCheckedIn > ?
     ORDER BY FirstCheckedIn ASC
     LIMIT 1"
);
$nextStmt->bind_param('ss', $activeEventID, $skippedTime);
$nextStmt->execute();
$nextRow = $nextStmt->get_result()->fetch_assoc();
$nextStmt->close();

if (!$nextRow) {
    // Already last in queue — nowhere to move
    echo json_encode(['success' => true, 'message' => 'Client is already at the end of the queue.']);
    exit;
}

$nextTime = $nextRow['FirstCheckedIn'];

// Move the skipped client to 1 second after the next client.
// Don't touch the next client — avoids swap loops when multiple clients are skipped.
$newTime = date('Y-m-d H:i:s', strtotime($nextTime) + 1);

$updateSkipped = $mysqli->prepare("UPDATE tblVisits SET FirstCheckedIn = ? WHERE VisitID = ?");
$updateSkipped->bind_param('ss', $newTime, $skippedVisitID);
$updateSkipped->execute();
$updateSkipped->close();

echo json_encode(['success' => true, 'message' => 'Client moved back one position in queue.']);
