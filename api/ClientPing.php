<?php
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

$mysqli = $GLOBALS['mysqli'];
$eventStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 ORDER BY EventDate DESC LIMIT 1");
$eventStmt->execute();
$event = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

if (!$event) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'No active event found.']);
    exit;
}

$eventId = $event['EventID'];
$settingKey = 'ClientPing';

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $serviceName = trim((string)($body['serviceName'] ?? ''));
    $serviceId = trim((string)($body['serviceId'] ?? ''));
    if ($serviceName === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing service name.']);
        exit;
    }

    $ping = json_encode([
        'id' => bin2hex(random_bytes(12)),
        'serviceName' => $serviceName,
        'serviceId' => $serviceId,
        'createdAt' => gmdate('c'),
    ]);
    $stmt = $mysqli->prepare(
        "INSERT INTO tblEventSettings (EventID, SettingKey, SettingValue)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)"
    );
    $stmt->bind_param('sss', $eventId, $settingKey, $ping);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to save client ping.']);
        exit;
    }
    echo json_encode(['success' => true]);
    exit;
}

$stmt = $mysqli->prepare("SELECT SettingValue FROM tblEventSettings WHERE EventID = ? AND SettingKey = ? LIMIT 1");
$stmt->bind_param('ss', $eventId, $settingKey);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
$ping = $row ? json_decode($row['SettingValue'], true) : null;

echo json_encode(['success' => true, 'ping' => is_array($ping) ? $ping : null]);