<?php
/**
 * ============================================================
 *  File:        AddEventService.php
 *  Purpose:     Handles adding a service to an event.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:38 PM
 *  Changes Made:      Code cleanup
 * ============================================================
*/

// Set content-type and default timezone
header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

// Request method check
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use POST.']);
    exit;
}

// Content-Type check
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'message' => 'Content-Type must be application/json.']);
    exit;
}

// Decode JSON body
$rawBody = file_get_contents('php://input');
$_POST = json_decode($rawBody, true);

if (!is_array($_POST)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

$EventID = $_POST['EventID'] ?? '';
$ServiceID = $_POST['ServiceID'] ?? '';
$MaxCapacity = $_POST['MaxCapacity'] ?? null;
$CurrentAssigned = $_POST['CurrentAssigned'] ?? null;
$IsClosed = $_POST['IsClosed'] ?? null;

$missingFields = [];
if (empty($EventID)) $missingFields[] = 'EventID';
if (empty($ServiceID)) $missingFields[] = 'ServiceID';
if (!isset($_POST['MaxCapacity']) || !is_int($_POST['MaxCapacity'])) $missingFields[] = 'MaxCapacity (must be integer)';
if (!isset($_POST['CurrentAssigned']) || !is_int($_POST['CurrentAssigned'])) $missingFields[] = 'CurrentAssigned (must be integer)';
if (
    !isset($_POST['IsClosed']) ||
    !(
        $_POST['IsClosed'] === true ||
        $_POST['IsClosed'] === false ||
        $_POST['IsClosed'] === 1 ||
        $_POST['IsClosed'] === 0 ||
        $_POST['IsClosed'] === "true" ||
        $_POST['IsClosed'] === "false"
    )
) {
    $missingFields[] = 'IsClosed (must be boolean true/false or integer 1/0)';
}

// Normalize IsClosed to integer 1 or 0 for DB
$IsClosed = ($_POST['IsClosed'] === true || $_POST['IsClosed'] === 1 || $_POST['IsClosed'] === "1") ? 1 : 0;

// Return error for missing fields
if (!empty($missingFields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missingFields)
    ]);
    exit;
}

// Check if EventID exists
$eventCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblEvents WHERE EventID = ?");
$eventCheck->bind_param("s", $EventID);
$eventCheck->execute();
$eventCheck->bind_result($eventCount);
$eventCheck->fetch();
$eventCheck->close();

if ($eventCount == 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Event not found for provided EventID.']);
    exit;
}

// Check if ServiceID exists
$serviceCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ServiceID = ?");
$serviceCheck->bind_param("s", $ServiceID);
$serviceCheck->execute();
$serviceCheck->bind_result($serviceCount);
$serviceCheck->fetch();
$serviceCheck->close();

if ($serviceCount == 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service not found for provided ServiceID.']);
    exit;
}

// Check for duplicate EventID + ServiceID in tblEventServices
$dupCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblEventServices WHERE EventID = ? AND ServiceID = ?");
$dupCheck->bind_param("ss", $EventID, $ServiceID);
$dupCheck->execute();
$dupCheck->bind_result($dupCount);
$dupCheck->fetch();
$dupCheck->close();

if ($dupCount > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'This service is already assigned to this event.'
    ]);
    exit;
}

// Generate unique EventServiceID
$EventServiceID = bin2hex(random_bytes(8));

// Prepare the query with temp variables
$eventServiceInsert = $mysqli->prepare("INSERT INTO tblEventServices (EventServiceID, EventID, ServiceID, MaxCapacity, CurrentAssigned, IsClosed) VALUES (?, ?, ?, ?, ?, ?)");

// Check for error
if (!$eventServiceInsert) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$eventServiceInsert->bind_param("sssiii", $EventServiceID, $EventID, $ServiceID, $MaxCapacity, $CurrentAssigned, $IsClosed);
$result = $eventServiceInsert->execute();

// Give response
if ($result) {
    http_response_code(201);
    $msg = json_encode(['success' => true, 'message' => 'New event service added.']);
    echo $msg;
    error_log($msg); 
} else {
    http_response_code(400);
    $msg = json_encode(['success' => false, 'message' => 'Failed to add event service.']);
    echo $msg;
    error_log($msg); 
}