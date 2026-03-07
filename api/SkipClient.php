<?php
/**
 * ============================================================
 *  File:        SkipClient.php
 *  Description: Skips the "Now Serving" client by moving their
 *               FirstCheckedIn timestamp to now, pushing them
 *               to the back of the FIFO queue.
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

// Update FirstCheckedIn to now — moves client to the back of the queue
$updateStmt = $mysqli->prepare(
    "UPDATE tblVisits
     SET FirstCheckedIn = NOW()
     WHERE ClientID = ? AND EventID = ? AND RegistrationStatus = 'CheckedIn'"
);
if (!$updateStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare update: ' . $mysqli->error]);
    exit;
}
$updateStmt->bind_param('ss', $clientID, $activeEventID);
$updateStmt->execute();

if ($updateStmt->affected_rows === 0) {
    $updateStmt->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Client visit not found or not checked in']);
    exit;
}

$updateStmt->close();

echo json_encode(['success' => true, 'message' => 'Client moved to back of queue']);
