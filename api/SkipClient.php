<?php
/**
 * ============================================================
 *  File:        SkipClient.php
 *  Description: Skips the "Now Serving" client by setting
 *               SkipCount = 1 on their visit. The Now Serving
 *               logic in waiting-room.php will pass over them
 *               once, then decrement so they're eligible again.
 *               No timestamp manipulation — no swap loops.
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
    "SELECT VisitID FROM tblVisits
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

// Set SkipCount to 1 — client loses exactly one turn
$updateStmt = $mysqli->prepare("UPDATE tblVisits SET SkipCount = 1 WHERE VisitID = ?");
$updateStmt->bind_param('s', $skipRow['VisitID']);
$updateStmt->execute();
$updateStmt->close();

echo json_encode(['success' => true, 'message' => 'Client will be skipped one turn.']);
