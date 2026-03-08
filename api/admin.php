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
                s.ParentServiceID, s.ServiceType, s.SortOrder,
                es.EventServiceID, es.MaxCapacity, es.MaxSeats, es.StandbyLimit, es.IsClosed
         FROM tblServices s
         LEFT JOIN tblEventServices es ON es.ServiceID = s.ServiceID AND es.EventID = ?
         ORDER BY s.SortOrder ASC, s.ServiceName ASC"
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

    // --- Event Settings (e.g. FastTrackLimit) ---
    $evtSettingsStmt = $mysqli->prepare(
        "SELECT SettingKey, SettingValue FROM tblEventSettings WHERE EventID = ?"
    );
    $eventSettings = [];
    if ($evtSettingsStmt) {
        $evtSettingsStmt->bind_param('s', $activeEventID);
        $evtSettingsStmt->execute();
        $evtRows = $evtSettingsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $evtSettingsStmt->close();
        foreach ($evtRows as $er) {
            $eventSettings[$er['SettingKey']] = $er['SettingValue'];
        }
    }
    $response['eventSettings'] = $eventSettings;

    // --- Fast Track current usage count ---
    $ftCountStmt = $mysqli->prepare(
        "SELECT COUNT(DISTINCT vs.VisitID) AS cnt
         FROM tblVisitServices vs
         JOIN tblVisits v ON v.VisitID = vs.VisitID
         WHERE v.EventID = ? AND vs.IsFastTracked = 1"
    );
    $ftUsed = 0;
    if ($ftCountStmt) {
        $ftCountStmt->bind_param('s', $activeEventID);
        $ftCountStmt->execute();
        $ftRow = $ftCountStmt->get_result()->fetch_assoc();
        $ftCountStmt->close();
        $ftUsed = (int)($ftRow['cnt'] ?? 0);
    }
    $response['fastTrackUsed'] = $ftUsed;

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

    // ── Update Event Setting ─────────────────────────────────
    case 'updateEventSetting':
        $settingKey   = trim($body['settingKey']   ?? '');
        $settingValue = trim($body['settingValue'] ?? '');
        $settingEventID = '4cbde538985861b9'; // hardcoded for now

        if (empty($settingKey)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing settingKey.']);
            exit;
        }

        // Upsert: INSERT or UPDATE
        $upsertStmt = $mysqli->prepare(
            "INSERT INTO tblEventSettings (EventID, SettingKey, SettingValue)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue)"
        );
        $upsertStmt->bind_param('sss', $settingEventID, $settingKey, $settingValue);
        $upsertStmt->execute();
        $upsertStmt->close();

        echo json_encode(['success' => true, 'message' => 'Setting updated.']);
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

    // ── Update Sort Order ─────────────────────────────────────
    case 'updateSortOrder':
        $serviceID = trim($body['serviceID'] ?? '');
        $sortOrder = $body['sortOrder'] ?? null;

        if (empty($serviceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing serviceID.']);
            exit;
        }
        if ($sortOrder === null || !is_numeric($sortOrder)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'sortOrder must be a number.']);
            exit;
        }

        $stmt = $mysqli->prepare("UPDATE tblServices SET SortOrder = ? WHERE ServiceID = ?");
        $sortVal = (int) $sortOrder;
        $stmt->bind_param('is', $sortVal, $serviceID);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => 'Sort order updated.']);
        break;

    // ── Update Icon Tag ───────────────────────────────────────
    case 'updateIcon':
        $serviceID = trim($body['serviceID'] ?? '');
        $iconTag   = trim($body['iconTag']   ?? '');

        if (empty($serviceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing serviceID.']);
            exit;
        }
        if (empty($iconTag)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'iconTag is required.']);
            exit;
        }

        $stmt = $mysqli->prepare("UPDATE tblServices SET IconTag = ? WHERE ServiceID = ?");
        $stmt->bind_param('ss', $iconTag, $serviceID);
        $stmt->execute();
        $stmt->close();

        echo json_encode(['success' => true, 'message' => 'Icon updated.']);
        break;

    // ── Add New Service ──────────────────────────────────────
    case 'addService':
        $serviceID       = trim($body['serviceID']       ?? '');
        $serviceName     = trim($body['serviceName']     ?? '');
        $iconTag         = trim($body['iconTag']         ?? '');
        $parentServiceID = trim($body['parentServiceID'] ?? '') ?: null;
        $serviceType     = trim($body['serviceType']     ?? 'category');
        $sortOrder       = (int)($body['sortOrder']      ?? 0);

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

        // Validate serviceType
        if (!in_array($serviceType, ['category', 'operational'], true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'serviceType must be "category" or "operational".']);
            exit;
        }

        // If operational, parentServiceID is required
        if ($serviceType === 'operational' && empty($parentServiceID)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Operational services must have a parentServiceID.']);
            exit;
        }

        // Validate parent exists if provided
        if ($parentServiceID !== null) {
            $parentCheck = $mysqli->prepare("SELECT ServiceType FROM tblServices WHERE ServiceID = ?");
            $parentCheck->bind_param('s', $parentServiceID);
            $parentCheck->execute();
            $parentRow = $parentCheck->get_result()->fetch_assoc();
            $parentCheck->close();
            if (!$parentRow || $parentRow['ServiceType'] !== 'category') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'parentServiceID must reference an existing category.']);
                exit;
            }
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

        $stmt = $mysqli->prepare(
            "INSERT INTO tblServices (ServiceID, ServiceName, IconTag, ParentServiceID, ServiceType, SortOrder) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param('sssssi', $serviceID, $serviceName, $iconTag, $parentServiceID, $serviceType, $sortOrder);
        $stmt->execute();
        $stmt->close();

        // Only add to tblEventServices for operational services (or categories with no children)
        // Categories that have children don't need event-level capacity
        $needsEventRow = ($serviceType === 'operational');
        if ($serviceType === 'category' && $parentServiceID === null) {
            // Check if this category has children — if not, it doubles as operational
            $childCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ParentServiceID = ?");
            $childCheck->bind_param('s', $serviceID);
            $childCheck->execute();
            $childCheck->bind_result($childCount);
            $childCheck->fetch();
            $childCheck->close();
            // Standalone category with no children doubles as its own operational service,
            // so it needs an event row for capacity/queue management.
            $needsEventRow = ($childCount === 0);
        }

        if ($needsEventRow) {
            $eID = '4cbde538985861b9';
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

        // Cascade to child services: if this is a category, close/open all children too
        $lookupStmt = $mysqli->prepare(
            "SELECT es.ServiceID, es.EventID FROM tblEventServices es WHERE es.EventServiceID = ?"
        );
        if ($lookupStmt) {
            $lookupStmt->bind_param('s', $eventServiceID);
            $lookupStmt->execute();
            $lookupRow = $lookupStmt->get_result()->fetch_assoc();
            $lookupStmt->close();

            if ($lookupRow) {
                $parentSvcID = $lookupRow['ServiceID'];
                $parentEvtID = $lookupRow['EventID'];

                // Find child services
                $childStmt = $mysqli->prepare(
                    "SELECT s.ServiceID FROM tblServices s WHERE s.ParentServiceID = ?"
                );
                if ($childStmt) {
                    $childStmt->bind_param('s', $parentSvcID);
                    $childStmt->execute();
                    $childRows = $childStmt->get_result()->fetch_all(MYSQLI_ASSOC);
                    $childStmt->close();

                    // Update each child's tblEventServices row
                    foreach ($childRows as $cr) {
                        $updateChild = $mysqli->prepare(
                            "UPDATE tblEventServices SET IsClosed = ? WHERE EventID = ? AND ServiceID = ?"
                        );
                        if ($updateChild) {
                            $updateChild->bind_param('iss', $closedVal, $parentEvtID, $cr['ServiceID']);
                            $updateChild->execute();
                            $updateChild->close();
                        }
                    }
                }
            }
        }

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
