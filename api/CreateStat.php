<?php
/**
 * ============================================================
 *  File:        CreateStat.php
 *  Description: Handles creating a new statistic for tracking at an event.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 21 @ 10:55 AM
 *  Changes Made:      Initial creation & update for portal
 * ============================================================
*/

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
$StatID = $_POST['StatID'] ?? '';
$EventID = $_POST['EventID'] ?? '';
$StatKey = $_POST['StatKey'] ?? '';
$StatValue = $_POST['StatValue'] ?? 0;

$missingFields = [];
if (empty($StatID)) $missingFields[] = 'StatID';
if (empty($EventID)) $missingFields[] = 'EventID';
if (empty($StatKey)) $missingFields[] = 'StatKey';
if (!isset($_POST['StatValue'])) $missingFields[] = 'StatValue';

// Return error for missing fields
if (!empty($missingFields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missingFields)
    ]);
    exit;
}

if (!is_numeric($StatValue)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'StatValue must be numeric.']);
    exit;
}
$StatValue = (int)$StatValue; // Explicitly cast to integer

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

// Check for duplicate StatID
$statCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblAnalytics WHERE StatID = ?");
$statCheck->bind_param("s", $StatID);
$statCheck->execute();
$statCheck->bind_result($statCount);
$statCheck->fetch();
$statCheck->close();

if ($statCount > 0) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'StatID already exists.']);
    exit;
}

$LastUpdated = date('Y-m-d H:i:s');

// Prepare the query with temp variables
$createStat = $mysqli->prepare("INSERT INTO tblAnalytics (StatID, EventID, StatKey, StatValue, LastUpdated) VALUES (?, ?, ?, ?, ?)");

// Check for error
if (!$createStat) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$createStat->bind_param("sssis", $StatID, $EventID, $StatKey, $StatValue, $LastUpdated);
$result = $createStat->execute();

// Give response
if ($result) {
    http_response_code(201);
    $msg = json_encode([
        'success' => true,
        'message' => 'Statistic created.',
    ]);
    echo $msg;
    error_log($msg); 
} else {
    http_response_code(400);
    $msg = json_encode([
        'success' => false,
        'message' => 'Statistic creation failed.',
        'error' => $createStat->error
    ]);
    echo $msg;
    error_log($msg); 
}