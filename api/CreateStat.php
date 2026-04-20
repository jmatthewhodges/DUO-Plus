<?php
/**
 * ============================================================
 * File:            CreateStat.php
 * Description:     Create a new tracked event statistic.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:20 PM
 * Changes Made:      Standardized readability structure and comments.
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

function getActiveEventID(mysqli $mysqli): ?string
{
    $stmt = $mysqli->prepare(
        "SELECT EventID
         FROM tblEvents
         WHERE IsActive = 1
         ORDER BY EventDate DESC
         LIMIT 1"
    );

    if (!$stmt) {
        return null;
    }

    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row['EventID'] ?? null;
}

// Validate required fields
$StatID = trim($_POST['StatID'] ?? '');
$StatKey = trim($_POST['StatKey'] ?? '');
$StatValue = $_POST['StatValue'] ?? 0;
$EventID = getActiveEventID($mysqli);

$missingFields = [];
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

if (!$EventID) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'No active event found.']);
    exit;
}

// StatKey must be unique per event
$statCheck = $mysqli->prepare("SELECT StatID FROM tblAnalytics WHERE EventID = ? AND StatKey = ? LIMIT 1");
if (!$statCheck) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$statCheck->bind_param("ss", $EventID, $StatKey);
$statCheck->execute();
$existingStat = $statCheck->get_result()->fetch_assoc();
$statCheck->close();

if ($existingStat) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'StatKey already exists for this active event.']);
    exit;
}

if ($StatID === '') {
    $StatID = bin2hex(random_bytes(8));
}

// Prepare the query with temp variables
$createStat = $mysqli->prepare("INSERT INTO tblAnalytics (StatID, EventID, StatKey, StatValue, LastUpdated) VALUES (?, ?, ?, ?, NOW())");

// Check for error
if (!$createStat) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$createStat->bind_param("sssi", $StatID, $EventID, $StatKey, $StatValue);
$result = $createStat->execute();

// Give response
if ($result) {
    http_response_code(201);
    $msg = json_encode([
        'success' => true,
        'message' => 'Statistic created.',
        'stat' => [
            'StatID' => $StatID,
            'EventID' => $EventID,
            'StatKey' => $StatKey,
            'StatValue' => $StatValue
        ]
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