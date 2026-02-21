<?php
/**
 * ============================================================
 *  File:        CreatePin.php
 *  Description: Handles creating a new PIN code entry in tblPinCode.
 *
 *  Last Modified By:  Claude
 *  Last Modified On:  Feb 21, 2026
 *  Changes Made:      Fixed to match tblPinCode structure
 *                     (PinID, PinValue, LastUpdated)
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
$body = json_decode($rawBody, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Extract field
$PinValue = $body['PinValue'] ?? '';

// Validate required field
if (empty($PinValue)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required field: PinValue.']);
    exit;
}

// Validate PIN format — must be exactly 6 digits
if (!is_string($PinValue) || strlen($PinValue) !== 6 || !ctype_digit($PinValue)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'PinValue must be exactly 6 numeric digits.']);
    exit;
}

// Check for duplicate PIN value
$dupCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblPinCode WHERE PinValue = ?");
if (!$dupCheck) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}
$dupCheck->bind_param('s', $PinValue);
$dupCheck->execute();
$dupCheck->bind_result($count);
$dupCheck->fetch();
$dupCheck->close();

if ($count > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'This PIN already exists. Please choose a different PIN.'
    ]);
    exit;
}

// Generate unique PinID and timestamp
$PinID       = bin2hex(random_bytes(8));
$LastUpdated = date('Y-m-d H:i:s');

// Insert new PIN
$pinInsert = $mysqli->prepare(
    "INSERT INTO tblPinCode (PinID, PinValue, LastUpdated) VALUES (?, ?, ?)"
);

if (!$pinInsert) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
    exit;
}

$pinInsert->bind_param('sss', $PinID, $PinValue, $LastUpdated);
$result = $pinInsert->execute();

if ($result) {
    http_response_code(201);
    $msg = json_encode([
        'success'     => true,
        'message'     => 'PIN created successfully.',
        'PinID'       => $PinID,
        'LastUpdated' => $LastUpdated
    ]);
    echo $msg;
    error_log($msg);
} else {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'message' => 'PIN creation failed: ' . $pinInsert->error]);
    echo $msg;
    error_log($msg);
}

$pinInsert->close();