<?php
/**
 * ============================================================
 *  File:        CreateService.php
 *  Description: Handles creating a new service.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 19 @ 7:47 PM
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
$ServiceID = $_POST['ServiceID'] ?? '';
$ServiceName = $_POST['ServiceName'] ?? '';
$IconTag = $_POST['IconTag'] ?? '';

$missingFields = [];
if (empty($ServiceID)) $missingFields[] = 'ServiceID';
if (empty($ServiceName)) $missingFields[] = 'ServiceName';
if (empty($IconTag)) $missingFields[] = 'IconTag';

// Return error for missing fields
if (!empty($missingFields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missingFields)
    ]);
    exit;
}

// Check for duplicate ServiceID or ServiceName
$dupCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ServiceID = ? OR ServiceName = ?");
$dupCheck->bind_param("ss", $ServiceID, $ServiceName);
$dupCheck->execute();
$dupCheck->bind_result($count);
$dupCheck->fetch();
$dupCheck->close();

if ($count > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'A service with this ServiceID or ServiceName already exists.'
    ]);
    exit;
}

// Prepare the query with temp variables
$serviceInsert = $mysqli->prepare("INSERT INTO tblServices (ServiceID, ServiceName, IconTag) VALUES (?, ?, ?)");

// Check for error
if (!$serviceInsert) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$serviceInsert->bind_param("sss", $ServiceID, $ServiceName, $IconTag);
$result = $serviceInsert->execute();

// Give response
if ($result) {
    http_response_code(201);
    $msg = json_encode(['success' => true, 'message' => 'New service created.']);
    echo $msg;
    error_log($msg); 
} else {
    http_response_code(400);
    $msg = json_encode(['success' => false, 'message' => 'Service creation failed.']);
    echo $msg;
    error_log($msg); 
}