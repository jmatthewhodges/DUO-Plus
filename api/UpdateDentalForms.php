<?php
/**
 * ============================================================
 *  File:        UpdateDentalForms.php
 *  Purpose:     Toggle dental forms completion for a checked-in client.
 *  Method:      POST (application/json)
 *  Body:        { "ClientID": "...", "FormsCompleted": true|false }
 * ============================================================
 */

require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON body.']);
    exit;
}

$clientID = trim($input['ClientID'] ?? '');
$rawFormsCompleted = $input['FormsCompleted'] ?? null;

if ($clientID === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ClientID is required.']);
    exit;
}

$formsCompleted = 0;
if (is_bool($rawFormsCompleted)) {
    $formsCompleted = $rawFormsCompleted ? 1 : 0;
} elseif (is_numeric($rawFormsCompleted)) {
    $formsCompleted = ((int)$rawFormsCompleted) === 1 ? 1 : 0;
} elseif (is_string($rawFormsCompleted)) {
    $truthy = ['1', 'true', 'yes', 'on'];
    $formsCompleted = in_array(strtolower(trim($rawFormsCompleted)), $truthy, true) ? 1 : 0;
}

$mysqli = $GLOBALS['mysqli'];

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
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No active event found.']);
    exit;
}

$eventID = $eventRow['EventID'];

$visitStmt = $mysqli->prepare(
    "SELECT VisitID
     FROM tblVisits
     WHERE ClientID = ?
       AND EventID = ?
       AND RegistrationStatus = 'CheckedIn'
     ORDER BY FirstCheckedIn DESC
     LIMIT 1"
);
if (!$visitStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare visit lookup: ' . $mysqli->error]);
    exit;
}
$visitStmt->bind_param('ss', $clientID, $eventID);
$visitStmt->execute();
$visitRow = $visitStmt->get_result()->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Checked-in visit not found for this client.']);
    exit;
}

$visitID = $visitRow['VisitID'];

$updateStmt = $mysqli->prepare(
    "UPDATE tblVisits
     SET DentalFormsCompleted = ?
     WHERE VisitID = ?"
);
if (!$updateStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare update statement: ' . $mysqli->error]);
    exit;
}
$updateStmt->bind_param('is', $formsCompleted, $visitID);
$updateStmt->execute();
$updateStmt->close();

echo json_encode([
    'success' => true,
    'ClientID' => $clientID,
    'VisitID' => $visitID,
    'FormsCompleted' => (bool)$formsCompleted,
]);
