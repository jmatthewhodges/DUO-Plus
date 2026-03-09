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

// ServiceID can be comma-separated (e.g. "medicalExam,medicalFollowUp")
// The query will match the first Pending or In-Progress record for any of them.
$serviceIDs = array_map('trim', explode(',', $ServiceID));
$serviceIDs = array_filter($serviceIDs);

if (empty($serviceIDs)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ServiceID is empty after parsing.']);
    exit;
}

// Build parameterized IN clause
$placeholders = implode(',', array_fill(0, count($serviceIDs), '?'));
$types = 's' . str_repeat('s', count($serviceIDs)); // ClientID + each ServiceID
$params = array_merge([$ClientID], $serviceIDs);

$sql = "
    SELECT vs.VisitServiceID, vs.VisitID, vs.ServiceID, vs.ServiceStatus, vs.QueuePriority, vs.RegCode, v.EventID
    FROM tblVisitServices vs
    JOIN tblVisits v ON vs.VisitID = v.VisitID
    WHERE v.ClientID = ?
      AND vs.ServiceID IN ($placeholders)
      AND vs.ServiceStatus IN ('Pending', 'In-Progress')
    ORDER BY FIELD(vs.ServiceStatus, 'In-Progress', 'Pending')
    LIMIT 1
";

$stmt = $mysqli->prepare($sql);
$stmt->bind_param($types, ...$params);
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
$ServiceID = $visitService['ServiceID'];

$VisitServiceID = $visitService['VisitServiceID'];
$currentStatus = $visitService['ServiceStatus'];
$now = date('Y-m-d H:i:s');
$LogID = uniqid('log_', true);

if ($currentStatus === 'Pending') {
    // Block check-in if client already has another service In-Progress
    $ipCheck = $mysqli->prepare(
        "SELECT vs.ServiceID, s.ServiceName
         FROM tblVisitServices vs
         JOIN tblServices s ON s.ServiceID = vs.ServiceID
         WHERE vs.VisitID = ? AND vs.ServiceStatus = 'In-Progress' LIMIT 1"
    );
    $ipCheck->bind_param('s', $visitService['VisitID']);
    $ipCheck->execute();
    $ipRow = $ipCheck->get_result()->fetch_assoc();
    $ipCheck->close();
    if ($ipRow) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This client is currently being served at ' . $ipRow['ServiceName'] . '. They must be checked out of that service first.'
        ]);
        exit;
    }

    // Block check-in if all seats are full for this service
    $eventID = $visitService['EventID'];
    $seatCheck = $mysqli->prepare(
        "SELECT MaxSeats, SeatsInProgress FROM tblEventServices WHERE EventID = ? AND ServiceID = ? LIMIT 1"
    );
    if ($seatCheck) {
        $seatCheck->bind_param('ss', $eventID, $ServiceID);
        $seatCheck->execute();
        $seatRow = $seatCheck->get_result()->fetch_assoc();
        $seatCheck->close();
        if ($seatRow) {
            $maxSeats = (int)$seatRow['MaxSeats'];
            $seatsInUse = (int)$seatRow['SeatsInProgress'];
            if ($maxSeats > 0 && $seatsInUse >= $maxSeats) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'message' => 'All seats are currently full for this service. Please wait for an opening.'
                ]);
                exit;
            }
        }
    }

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

// Update SeatsInProgress in tblEventServices
$eventID = $visitService['EventID'];
if ($newStatus === 'In-Progress') {
    $incSeats = $mysqli->prepare(
        "UPDATE tblEventServices SET SeatsInProgress = SeatsInProgress + 1 WHERE EventID = ? AND ServiceID = ?"
    );
    if ($incSeats) {
        $incSeats->bind_param('ss', $eventID, $ServiceID);
        $incSeats->execute();
        $incSeats->close();
    }
} elseif ($newStatus === 'Complete') {
    $decSeats = $mysqli->prepare(
        "UPDATE tblEventServices SET SeatsInProgress = GREATEST(SeatsInProgress - 1, 0) WHERE EventID = ? AND ServiceID = ?"
    );
    if ($decSeats) {
        $decSeats->bind_param('ss', $eventID, $ServiceID);
        $decSeats->execute();
        $decSeats->close();
    }
}

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

