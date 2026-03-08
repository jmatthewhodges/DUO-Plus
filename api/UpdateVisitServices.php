<?php
/**
 * ============================================================
 *  File:        UpdateVisitServices.php
 *  Description: Add or remove a service from a client's visit.
 *               Does NOT affect queue order (FirstCheckedIn).
 *  Method:      POST
 *  Body:        { "visitID": "...", "serviceID": "...", "action": "add"|"remove" }
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Mar 7, 2026
 *  Changes Made:      Initial creation
 * ============================================================
 */

require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON body.']);
    exit;
}

$visitID   = trim($input['visitID']   ?? '');
$serviceID = trim($input['serviceID'] ?? '');
$action    = trim($input['action']    ?? '');

if (empty($visitID) || empty($serviceID) || !in_array($action, ['add', 'remove', 'checkin', 'checkout'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'visitID, serviceID, and action (add|remove|checkin|checkout) are required.']);
    exit;
}

$mysqli = $GLOBALS['mysqli'];
$eventID = '4cbde538985861b9';

// Verify visit exists
$visitCheck = $mysqli->prepare("SELECT VisitID FROM tblVisits WHERE VisitID = ? LIMIT 1");
$visitCheck->bind_param('s', $visitID);
$visitCheck->execute();
if (!$visitCheck->get_result()->fetch_assoc()) {
    $visitCheck->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Visit not found.']);
    exit;
}
$visitCheck->close();

// Verify service exists
$svcCheck = $mysqli->prepare("SELECT ServiceID FROM tblServices WHERE ServiceID = ? LIMIT 1");
$svcCheck->bind_param('s', $serviceID);
$svcCheck->execute();
if (!$svcCheck->get_result()->fetch_assoc()) {
    $svcCheck->close();
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Service not found.']);
    exit;
}
$svcCheck->close();

if ($action === 'add') {
    // Check for existing visit service (any status)
    $dupCheck = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceStatus FROM tblVisitServices WHERE VisitID = ? AND ServiceID = ? LIMIT 1"
    );
    $dupCheck->bind_param('ss', $visitID, $serviceID);
    $dupCheck->execute();
    $existing = $dupCheck->get_result()->fetch_assoc();
    $dupCheck->close();

    if ($existing) {
        // If it was completed or removed, reset to Pending
        if ($existing['ServiceStatus'] === 'Complete') {
            $resetStmt = $mysqli->prepare(
                "UPDATE tblVisitServices SET ServiceStatus = 'Pending', QueuePriority = NOW() WHERE VisitServiceID = ?"
            );
            $resetStmt->bind_param('s', $existing['VisitServiceID']);
            $resetStmt->execute();
            $resetStmt->close();

            echo json_encode(['success' => true, 'message' => 'Service re-added (reset from Complete to Pending).']);
            exit;
        }
        // Already Pending or In-Progress
        echo json_encode(['success' => true, 'message' => 'Service already active.']);
        exit;
    }

    // Insert new visit service
    $vsID = bin2hex(random_bytes(8));
    $now = date('Y-m-d H:i:s');
    $insertStmt = $mysqli->prepare(
        "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority) VALUES (?, ?, ?, 'Pending', ?)"
    );
    $insertStmt->bind_param('ssss', $vsID, $visitID, $serviceID, $now);
    $insertStmt->execute();
    $insertStmt->close();

    // Increment CurrentAssigned
    $incStmt = $mysqli->prepare(
        "UPDATE tblEventServices SET CurrentAssigned = CurrentAssigned + 1 WHERE EventID = ? AND ServiceID = ?"
    );
    $incStmt->bind_param('ss', $eventID, $serviceID);
    $incStmt->execute();
    $incStmt->close();

    echo json_encode(['success' => true, 'message' => 'Service added.']);

} elseif ($action === 'remove') {
    // Find the visit service
    $findStmt = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceStatus FROM tblVisitServices WHERE VisitID = ? AND ServiceID = ? AND ServiceStatus IN ('Pending','In-Progress') LIMIT 1"
    );
    $findStmt->bind_param('ss', $visitID, $serviceID);
    $findStmt->execute();
    $vs = $findStmt->get_result()->fetch_assoc();
    $findStmt->close();

    if (!$vs) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No active visit service found to remove.']);
        exit;
    }

    // Delete the visit service row
    $delStmt = $mysqli->prepare("DELETE FROM tblVisitServices WHERE VisitServiceID = ?");
    $delStmt->bind_param('s', $vs['VisitServiceID']);
    $delStmt->execute();
    $delStmt->close();

    // If it was In-Progress, decrement SeatsInProgress
    if ($vs['ServiceStatus'] === 'In-Progress') {
        $decSeats = $mysqli->prepare(
            "UPDATE tblEventServices SET SeatsInProgress = GREATEST(SeatsInProgress - 1, 0) WHERE EventID = ? AND ServiceID = ?"
        );
        $decSeats->bind_param('ss', $eventID, $serviceID);
        $decSeats->execute();
        $decSeats->close();
    }

    // Decrement CurrentAssigned
    $decStmt = $mysqli->prepare(
        "UPDATE tblEventServices SET CurrentAssigned = GREATEST(CurrentAssigned - 1, 0) WHERE EventID = ? AND ServiceID = ?"
    );
    $decStmt->bind_param('ss', $eventID, $serviceID);
    $decStmt->execute();
    $decStmt->close();

    echo json_encode(['success' => true, 'message' => 'Service removed.']);

} elseif ($action === 'checkin') {
    // Block check-in if client already has an In-Progress service
    $ipCheck = $mysqli->prepare(
        "SELECT VisitServiceID FROM tblVisitServices WHERE VisitID = ? AND ServiceStatus = 'In-Progress' LIMIT 1"
    );
    $ipCheck->bind_param('s', $visitID);
    $ipCheck->execute();
    $ipExists = $ipCheck->get_result()->fetch_assoc();
    $ipCheck->close();

    if ($ipExists) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Client already has a service in progress. Check out the current service first.']);
        exit;
    }

    // Check In: Pending -> In-Progress
    $findStmt = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceStatus FROM tblVisitServices WHERE VisitID = ? AND ServiceID = ? AND ServiceStatus = 'Pending' LIMIT 1"
    );
    $findStmt->bind_param('ss', $visitID, $serviceID);
    $findStmt->execute();
    $vs = $findStmt->get_result()->fetch_assoc();
    $findStmt->close();

    if (!$vs) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No pending visit service found to check in.']);
        exit;
    }

    $updateStmt = $mysqli->prepare(
        "UPDATE tblVisitServices SET ServiceStatus = 'In-Progress' WHERE VisitServiceID = ?"
    );
    $updateStmt->bind_param('s', $vs['VisitServiceID']);
    $updateStmt->execute();
    $updateStmt->close();

    // Increment SeatsInProgress
    $incSeats = $mysqli->prepare(
        "UPDATE tblEventServices SET SeatsInProgress = SeatsInProgress + 1 WHERE EventID = ? AND ServiceID = ?"
    );
    $incSeats->bind_param('ss', $eventID, $serviceID);
    $incSeats->execute();
    $incSeats->close();

    // Clear any skip flag when client gets checked into a service
    $clearSkip = $mysqli->prepare(
        "UPDATE tblVisits SET SkipCount = 0 WHERE VisitID = ? AND SkipCount > 0"
    );
    $clearSkip->bind_param('s', $visitID);
    $clearSkip->execute();
    $clearSkip->close();

    echo json_encode(['success' => true, 'message' => 'Service checked in (In-Progress).']);

} elseif ($action === 'checkout') {
    // Check Out: In-Progress -> Complete
    $findStmt = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceStatus FROM tblVisitServices WHERE VisitID = ? AND ServiceID = ? AND ServiceStatus = 'In-Progress' LIMIT 1"
    );
    $findStmt->bind_param('ss', $visitID, $serviceID);
    $findStmt->execute();
    $vs = $findStmt->get_result()->fetch_assoc();
    $findStmt->close();

    if (!$vs) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No in-progress visit service found to check out.']);
        exit;
    }

    $updateStmt = $mysqli->prepare(
        "UPDATE tblVisitServices SET ServiceStatus = 'Complete' WHERE VisitServiceID = ?"
    );
    $updateStmt->bind_param('s', $vs['VisitServiceID']);
    $updateStmt->execute();
    $updateStmt->close();

    // Decrement SeatsInProgress
    $decSeats = $mysqli->prepare(
        "UPDATE tblEventServices SET SeatsInProgress = GREATEST(SeatsInProgress - 1, 0) WHERE EventID = ? AND ServiceID = ?"
    );
    $decSeats->bind_param('ss', $eventID, $serviceID);
    $decSeats->execute();
    $decSeats->close();

    echo json_encode(['success' => true, 'message' => 'Service checked out (Complete).']);
}
