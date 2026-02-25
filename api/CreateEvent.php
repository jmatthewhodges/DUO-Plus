<?php
/**
 * ============================================================
 *  File:        CreateEvent.php
 *  Purpose:     Handles creating a new event.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:40 PM
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

// Validate required fields
$EventDate = $_POST['EventDate'] ?? '';
$LocationName = $_POST['LocationName'] ?? '';
$IsActive = ($_POST['IsActive'] === true || $_POST['IsActive'] === 1 || $_POST['IsActive'] === "1") ? 1 : 0;

$missingFields = [];
if (empty($EventDate)) $missingFields[] = 'EventDate';
if (empty($LocationName)) $missingFields[] = 'LocationName';
// Validate IsActive: must be present and either 1, 0, true, or false
if (!array_key_exists('IsActive', $_POST) || !in_array($_POST['IsActive'], [1, 0, "1", "0", true, false], true)) {
    $missingFields[] = 'IsActive (must be boolean true/false or 1/0)';
}

// Return error for missing fields
if (!empty($missingFields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missingFields)
    ]);
    exit;
}

// Then validate EventDate format
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $EventDate)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'EventDate must be in YYYY-MM-DD format.'
    ]);
    exit;
}

// Check for duplicate event (same LocationName and EventDate)
$dupCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblEvents WHERE LocationName = ? AND EventDate = ?");
$dupCheck->bind_param("ss", $LocationName, $EventDate);
$dupCheck->execute();
$dupCheck->bind_result($count);
$dupCheck->fetch();
$dupCheck->close();

if ($count > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'An event with this LocationName and EventDate already exists.'
    ]);
    exit;
}

// Generate unique EventID
$EventID = bin2hex(random_bytes(8));

// Prepare the query with temp variables
$eventInsert = $mysqli->prepare("INSERT INTO tblEvents (EventID, EventDate, LocationName, IsActive) VALUES (?, ?, ?, ?)");

// Check for error
if (!$eventInsert) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$eventInsert->bind_param("sssi", $EventID, $EventDate, $LocationName, $IsActive);
$result = $eventInsert->execute();

// Give response
if ($result) {
    http_response_code(201);
    $msg = json_encode(['success' => true, 'message' => 'New event created.']);
    echo $msg;
    error_log($msg); 
} else {
    http_response_code(400);
    $msg = json_encode(['success' => false, 'message' => 'Event creation failed.']);
    echo $msg;
    error_log($msg); 
}