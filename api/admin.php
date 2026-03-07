<?php
/**
 * ============================================================
 *  File:        admin.php
 *  Description: Admin dashboard API. Handles GET (load settings)
 *               and POST (update settings) for all admin-managed
 *               configuration. Modular — each settings section is
 *               a handler that can be added independently.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Mar 7, 2026
 *  Changes Made:      Initial creation
 * ============================================================
 */

require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

$mysqli = $GLOBALS['mysqli'];

// ─── GET: Load all admin settings ───────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = [];

    // --- Pin Code ---
    $pinStmt = $mysqli->prepare("SELECT PinID, PinValue, LastUpdated FROM tblPinCode LIMIT 1");
    if ($pinStmt) {
        $pinStmt->execute();
        $pin = $pinStmt->get_result()->fetch_assoc();
        $pinStmt->close();
        $response['pinCode'] = $pin ?: null;
    }

    // --- Event (hardcoded) ---
    $activeEventID = '4cbde538985861b9';
    $response['activeEvent'] = ['EventID' => $activeEventID];

    // --- Services (all defined + event-specific settings) ---
    $svcStmt = $mysqli->prepare(
        "SELECT s.ServiceID, s.ServiceName, s.IconTag,
                es.EventServiceID, es.MaxCapacity, es.MaxSeats, es.StandbyLimit, es.IsClosed
         FROM tblServices s
         LEFT JOIN tblEventServices es ON es.ServiceID = s.ServiceID AND es.EventID = ?
         ORDER BY s.ServiceName ASC"
    );
    if ($svcStmt) {
        $svcStmt->bind_param('s', $activeEventID);
        $svcStmt->execute();
        $rows = $svcStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $svcStmt->close();
        $response['services'] = $rows;
    }

    // --- Config values ---
    $response['config'] = getConfig($mysqli);

    http_response_code(200);
    echo json_encode(['success' => true, 'data' => $response]);
    exit;
}

// ─── POST: Update a specific settings section ───────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'Content-Type must be application/json.']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON body.']);
    exit;
}

$action = $body['action'] ?? '';

// ─── Action Router (modular — add new cases as needed) ──────
switch ($action) {

    // ── Update PIN Code ──────────────────────────────────────
    case 'updatePin':
        $newPin = $body['pinValue'] ?? '';
        if (!is_string($newPin) || strlen($newPin) !== 6 || !ctype_digit($newPin)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'PIN must be exactly 6 digits.']);
            exit;
        }

        $stmt = $mysqli->prepare("UPDATE tblPinCode SET PinValue = ?, LastUpdated = NOW() LIMIT 1");
        $stmt->bind_param('s', $newPin);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => 'PIN updated.']);
        break;

    // ── Update Service Capacity / Seats / Standby ────────────
    case 'updateService':
        $eventServiceID = $body['eventServiceID'] ?? '';
        $maxCapacity    = $body['maxCapacity']    ?? null;
        $maxSeats       = $body['maxSeats']       ?? null;
        $standbyLimit   = $body['standbyLimit']   ?? null;

        if (empty($eventServiceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing eventServiceID.']);
            exit;
        }

        // Build dynamic SET clause — only update fields that were provided
        $sets = [];
        $types = '';
        $values = [];

        if ($maxCapacity !== null && is_numeric($maxCapacity)) {
            $sets[] = "MaxCapacity = ?";
            $types .= 'i';
            $values[] = (int) $maxCapacity;
        }
        if ($maxSeats !== null && is_numeric($maxSeats)) {
            $sets[] = "MaxSeats = ?";
            $types .= 'i';
            $values[] = (int) $maxSeats;
        }
        if ($standbyLimit !== null && is_numeric($standbyLimit)) {
            $sets[] = "StandbyLimit = ?";
            $types .= 'i';
            $values[] = (int) $standbyLimit;
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No valid fields to update.']);
            exit;
        }

        $sql = "UPDATE tblEventServices SET " . implode(', ', $sets) . " WHERE EventServiceID = ?";
        $types .= 's';
        $values[] = $eventServiceID;

        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param($types, ...$values);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => 'Service settings updated.']);
        break;

    // ── Add New Service ──────────────────────────────────────
    case 'addService':
        $serviceID   = trim($body['serviceID']   ?? '');
        $serviceName = trim($body['serviceName'] ?? '');
        $iconTag     = trim($body['iconTag']     ?? '');

        if (empty($serviceID) || empty($serviceName) || empty($iconTag)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ServiceID, ServiceName, and IconTag are required.']);
            exit;
        }

        // Whitelist: only allow alphanumeric + camelCase for ServiceID
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9]{1,63}$/', $serviceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ServiceID must be alphanumeric camelCase (2-64 chars).']);
            exit;
        }

        // Sanitize ServiceName
        $serviceName = htmlspecialchars($serviceName, ENT_QUOTES, 'UTF-8');

        // Check duplicate
        $dupCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ServiceID = ? OR ServiceName = ?");
        $dupCheck->bind_param('ss', $serviceID, $serviceName);
        $dupCheck->execute();
        $dupCheck->bind_result($count);
        $dupCheck->fetch();
        $dupCheck->close();

        if ($count > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'A service with this ID or name already exists.']);
            exit;
        }

        $stmt = $mysqli->prepare("INSERT INTO tblServices (ServiceID, ServiceName, IconTag) VALUES (?, ?, ?)");
        $stmt->bind_param('sss', $serviceID, $serviceName, $iconTag);
        $stmt->execute();
        $stmt->close();

        // Also add to active event's tblEventServices with defaults
        $eID = '4cbde538985861b9';
        {
            $esID = bin2hex(random_bytes(8));
            $defaultCapacity = 50;
            $defaultSeats = 3;
            $defaultStandby = 5;
            $closed = 0;
            $assigned = 0;
            $seatsInProgress = 0;

            $esStmt = $mysqli->prepare(
                "INSERT INTO tblEventServices (EventServiceID, EventID, ServiceID, MaxCapacity, CurrentAssigned, IsClosed, MaxSeats, SeatsInProgress, StandbyLimit)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $esStmt->bind_param('sssiiiiii', $esID, $eID, $serviceID, $defaultCapacity, $assigned, $closed, $defaultSeats, $seatsInProgress, $defaultStandby);
            $esStmt->execute();
            $esStmt->close();
        }

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Service created.']);
        break;

    // ── Remove Service ───────────────────────────────────────
    case 'removeService':
        $serviceID = trim($body['serviceID'] ?? '');

        if (empty($serviceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ServiceID is required.']);
            exit;
        }

        // Check if service has any active visit services (Pending / In-Progress)
        $activeCheck = $mysqli->prepare(
            "SELECT COUNT(*) FROM tblVisitServices WHERE ServiceID = ? AND ServiceStatus IN ('Pending','In-Progress')"
        );
        $activeCheck->bind_param('s', $serviceID);
        $activeCheck->execute();
        $activeCheck->bind_result($activeCount);
        $activeCheck->fetch();
        $activeCheck->close();

        if ($activeCount > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => "Cannot remove — $activeCount client(s) are still using this service."]);
            exit;
        }

        // Remove from event services first (FK safe)
        $delES = $mysqli->prepare("DELETE FROM tblEventServices WHERE ServiceID = ?");
        $delES->bind_param('s', $serviceID);
        $delES->execute();
        $delES->close();

        // Remove service definition
        $delS = $mysqli->prepare("DELETE FROM tblServices WHERE ServiceID = ?");
        $delS->bind_param('s', $serviceID);
        $delS->execute();
        $delS->close();

        echo json_encode(['success' => true, 'message' => 'Service removed.']);
        break;

    // ── Toggle Service Open/Closed ───────────────────────────
    case 'toggleService':
        $eventServiceID = $body['eventServiceID'] ?? '';
        $isClosed       = $body['isClosed'] ?? null;

        if (empty($eventServiceID) || $isClosed === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'eventServiceID and isClosed are required.']);
            exit;
        }

        $closedVal = $isClosed ? 1 : 0;
        $stmt = $mysqli->prepare("UPDATE tblEventServices SET IsClosed = ? WHERE EventServiceID = ?");
        $stmt->bind_param('is', $closedVal, $eventServiceID);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => $isClosed ? 'Service closed.' : 'Service opened.']);
        break;

    // ── Update Config Value ──────────────────────────────────
    case 'updateConfig':
        $key   = trim($body['key']   ?? '');
        $value = trim($body['value'] ?? '');

        if (empty($key)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Config key is required.']);
            exit;
        }

        // Whitelist allowed config keys
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/', $key)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid config key format.']);
            exit;
        }

        setConfigValue($mysqli, $key, $value);
        echo json_encode(['success' => true, 'message' => "Config '$key' updated."]);
        break;

    // ── Unknown action ───────────────────────────────────────
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Unknown action: $action"]);
        break;
}
