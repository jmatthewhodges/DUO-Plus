<?php
/**
 * ============================================================
 *  File:        ServiceScan.php
 *  Purpose:     Handles checking in or out client after scanning QR code badge.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  March 3 @ 7:30 PM
 *  Changes Made:      Init
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
$ClientID = $_POST['ClientID'] ?? '';
$ServiceID = $_POST['ServiceID'] ?? '';

$missingFields = [];
if (empty($ClientID)) $missingFields[] = 'ClientID';
if (empty($ServiceID)) $missingFields[] = 'ServiceID';

// Return error for missing fields
if (!empty($missingFields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: ' . implode(', ', $missingFields)
    ]);
    exit;
}

// Find the client's VisitService matching the given ServiceID (Pending or In-Progress)
$stmt = $mysqli->prepare("
    SELECT vs.VisitServiceID, vs.VisitID, vs.ServiceStatus, vs.QueuePriority, vs.RegCode
    FROM tblVisitServices vs
    JOIN tblVisits v ON vs.VisitID = v.VisitID
    WHERE v.ClientID = ?
      AND vs.ServiceID = ?
      AND vs.ServiceStatus IN ('Pending', 'In-Progress')
    LIMIT 1
");
$stmt->bind_param('ss', $ClientID, $ServiceID);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'No pending or in-progress service found for this client and service.'
    ]);
    exit;
}

$visitService = $result->fetch_assoc();
$stmt->close();

$VisitServiceID = $visitService['VisitServiceID'];
$currentStatus = $visitService['ServiceStatus'];
$now = date('Y-m-d H:i:s');
$LogID = uniqid('log_', true);

if ($currentStatus === 'Pending') {
    // CHECK IN: Pending -> In-Progress
    $newStatus = 'In-Progress';
    $action = $ServiceID . 'CheckIn';
    $responseMessage = 'Client checked in to service successfully.';
} else {
    // CHECK OUT: In-Progress -> Complete
    $newStatus = 'Complete';
    $action = $ServiceID . 'CheckOut';
    $responseMessage = 'Client checked out of service successfully.';
}

// Update ServiceStatus
$updateStmt = $mysqli->prepare("
    UPDATE tblVisitServices
    SET ServiceStatus = ?
    WHERE VisitServiceID = ?
");
$updateStmt->bind_param('ss', $newStatus, $VisitServiceID);
$updateStmt->execute();
$updateStmt->close();

// Log the action in tblMovementLogs
$logStmt = $mysqli->prepare("
    INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp)
    VALUES (?, ?, ?, ?)
");
$logStmt->bind_param('ssss', $LogID, $VisitServiceID, $action, $now);
$logStmt->execute();
$logStmt->close();

// Return success
echo json_encode([
    'success' => true,
    'message' => $responseMessage,
    'VisitServiceID' => $VisitServiceID,
    'newStatus' => $newStatus
]);

