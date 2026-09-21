<?php
/**
 * ============================================================
 * File:            ClientPing.php
 * Description:     Return or create the latest client request for the active event.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  Sept 20, 2026
 * Changes Made:      This is the Client Ping system that parses the DB and returns or creates the latest ping for the active event.
 * ============================================================
 */
/** Return or create the latest client request for the active event. */
require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// Get the active event ID
$mysqli = $GLOBALS['mysqli'];
$eventStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 ORDER BY EventDate DESC LIMIT 1");
$eventStmt->execute();
$event = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

// If no active event is found, return an error
if (!$event) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'No active event found.']);
    exit;
}

$eventId = $event['EventID'];

// Handle POST request to create a new client ping
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $serviceName = trim((string)($body['serviceName'] ?? ''));
    $serviceId = trim((string)($body['serviceId'] ?? ''));
    if ($serviceName === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing service name.']);
        exit;
    }

    // Sanitize serviceId to create a valid SettingKey
    $serviceKey = preg_replace('/[^a-zA-Z0-9_-]/', '', $serviceId);
    if ($serviceKey === '') $serviceKey = 'general';
    $settingKey = 'ClientPing_' . $serviceKey;

    // Create a new ping entry
    $newPing = [
        'id' => bin2hex(random_bytes(12)),
        'serviceName' => $serviceName,
        'serviceId' => $serviceId,
        'createdAt' => gmdate('c'),
    ];
    // Store the new ping in the database
    $ping = json_encode($newPing);
    // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both insert and update
    $stmt = $mysqli->prepare(
        "INSERT INTO tblEventSettings (EventID, SettingKey, SettingValue)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)"
    );
    // Bind parameters and execute the statement
    $stmt->bind_param('sss', $eventId, $settingKey, $ping);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to save client ping.']);
        exit;
    }
    echo json_encode(['success' => true, 'ping' => $newPing]);
    exit;
}

// Handle GET request to retrieve the latest client ping
$stmt = $mysqli->prepare("SELECT SettingKey, SettingValue FROM tblEventSettings WHERE EventID = ? AND SettingKey LIKE 'ClientPing_%'");
$stmt->bind_param('s', $eventId);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
$storedPings = [];
// Decode each stored ping and collect them
foreach ($rows as $row) {
    $ping = json_decode($row['SettingValue'], true);
    if (is_array($ping) && !empty($ping['id'])) $storedPings[] = $ping;
}

// Return the stored pings and the latest ping
echo json_encode([
    'success' => true,
    'pings' => array_values($storedPings),
    'ping' => !empty($storedPings) ? end($storedPings) : null,
]);