<?php
/**
 * ============================================================
 *  File:        CheckIn.php
 *  Purpose:     Update client info and check them into waiting room
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 21 @ 12:41 PM
 *  Changes Made:      Initial creation and update for portal
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

// Validate required fields
$clientID        = trim($body['clientID'] ?? '');
$services        = $body['services'] ?? [];
$needsInterpreter = !empty($body['needsInterpreter']) ? 1 : 0;

if (empty($clientID)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required field: clientID.']);
    exit;
}

if (empty($services) || !is_array($services)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing or invalid services array.']);
    exit;
}

// Hardcoded EventID for now (same pattern as GrabQueue.php)
$eventID = '4cbde538985861b9';

// ---------------------------------------------------------------
// 1. Update TranslatorNeeded on tblClients
// ---------------------------------------------------------------
$updateClient = $mysqli->prepare("UPDATE tblClients SET TranslatorNeeded = ? WHERE ClientID = ?");
if (!$updateClient) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}
$updateClient->bind_param('is', $needsInterpreter, $clientID);
if (!$updateClient->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update client: ' . $updateClient->error]);
    $updateClient->close();
    exit;
}
$updateClient->close();

// ---------------------------------------------------------------
// 2. Fetch the VisitID for this client + event
// ---------------------------------------------------------------
$visitStmt = $mysqli->prepare(
    "SELECT VisitID FROM tblVisits WHERE ClientID = ? AND EventID = ? LIMIT 1"
);
if (!$visitStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}
$visitStmt->bind_param('ss', $clientID, $eventID);
$visitStmt->execute();
$visitResult = $visitStmt->get_result();
$visitRow = $visitResult->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'No visit record found for this client and event.']);
    exit;
}
$visitID = $visitRow['VisitID'];

// ---------------------------------------------------------------
// 3. Update tblVisits — set status to Registered and CheckInTime
// ---------------------------------------------------------------
$now = date('Y-m-d H:i:s');
$updateVisit = $mysqli->prepare(
    "UPDATE tblVisits SET RegistrationStatus = 'CheckedIn', CheckInTime = ? WHERE VisitID = ?"
);
if (!$updateVisit) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}
$updateVisit->bind_param('ss', $now, $visitID);
if (!$updateVisit->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update visit: ' . $updateVisit->error]);
    $updateVisit->close();
    exit;
}
$updateVisit->close();

// ---------------------------------------------------------------
// 4. Insert rows into tblVisitServices for each service
// ---------------------------------------------------------------
$insertService = $mysqli->prepare(
    "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority)
     VALUES (?, ?, ?, 'Pending', ?)"
);
if (!$insertService) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}

foreach ($services as $serviceID) {
    $serviceID = trim($serviceID);
    error_log('Attempting insert — VisitID: ' . $visitID . ' | ServiceID: [' . $serviceID . ']');
    if (empty($serviceID)) continue;

    $visitServiceID = bin2hex(random_bytes(8)); // 16-char hex ID
    $queuePriority  = date('Y-m-d H:i:s');      // Timestamp = FIFO order

    $insertService->bind_param('ssss', $visitServiceID, $visitID, $serviceID, $queuePriority);
    if (!$insertService->execute()) {
        // Log but don't hard-fail — attempt remaining services
        error_log('Failed to insert VisitService for ' . $serviceID . ': ' . $insertService->error);
    }
}
$insertService->close();

// ---------------------------------------------------------------
// 5. Update clientsProcessed stat in tblAnalytics
// ---------------------------------------------------------------
$statKey = 'clientsProcessed';
$updateStat = $mysqli->prepare(
    "UPDATE tblAnalytics SET StatValue = StatValue + 1, LastUpdated = NOW()
     WHERE EventID = ? AND StatID = ?"
);
if ($updateStat) {
    $updateStat->bind_param('ss', $eventID, $statKey);
    $updateStat->execute();
    $updateStat->close();
}

// Fetch updated clientsProcessed to return to frontend
$clientsProcessed = 0;
$statFetch = $mysqli->query(
    "SELECT StatValue FROM tblAnalytics WHERE EventID = '$eventID' AND StatID = 'clientsProcessed' LIMIT 1"
);
if ($statFetch && $statRow = $statFetch->fetch_assoc()) {
    $clientsProcessed = (int)$statRow['StatValue'];
}

// ---------------------------------------------------------------
// 6. Success
// ---------------------------------------------------------------
http_response_code(200);
echo json_encode([
    'success'          => true,
    'message'          => 'Client checked in successfully.',
    'visitID'          => $visitID,
    'clientsProcessed' => $clientsProcessed
]);