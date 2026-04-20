<?php
/**
 * ============================================================
 * File:            LogVolunteerBadgePrint.php
 * Description:     Record volunteer badge print events.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:20 PM
 * Changes Made:      Standardized readability structure and comments.
 * ============================================================
 */
header('Content-Type: application/json');

// Require PIN-verified session for dashboard operations.
require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

$mysqli = $GLOBALS['mysqli'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use POST.']);
    exit;
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'message' => 'Content-Type must be application/json.']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
    exit;
}

$volunteerName = trim((string)($payload['volunteerName'] ?? ''));
if ($volunteerName === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Volunteer name is required.']);
    exit;
}

if (strlen($volunteerName) > 64) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Volunteer name must be 64 characters or fewer.']);
    exit;
}

$printLogID = bin2hex(random_bytes(8));

// Link log entries to the active event when available.
$activeEventID = null;
$eventStmt = $mysqli->prepare(
    "SELECT EventID
     FROM tblEvents
     WHERE IsActive = 1
     ORDER BY EventDate DESC
     LIMIT 1"
);

if ($eventStmt) {
    $eventStmt->execute();
    $eventRow = $eventStmt->get_result()->fetch_assoc();
    $eventStmt->close();
    $activeEventID = $eventRow['EventID'] ?? null;
}

if ($activeEventID) {
    $insert = $mysqli->prepare(
        "INSERT INTO tblVolunteerBadgePrintLog (VolunteerPrintLogID, EventID, VolunteerName, PrintedAt)
         VALUES (?, ?, ?, NOW())"
    );

    if (!$insert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while preparing insert.']);
        exit;
    }

    $insert->bind_param('sss', $printLogID, $activeEventID, $volunteerName);
} else {
    $insert = $mysqli->prepare(
        "INSERT INTO tblVolunteerBadgePrintLog (VolunteerPrintLogID, VolunteerName, PrintedAt)
         VALUES (?, ?, NOW())"
    );

    if (!$insert) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while preparing insert.']);
        exit;
    }

    $insert->bind_param('ss', $printLogID, $volunteerName);
}

if (!$insert->execute()) {
    $insert->close();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save volunteer badge print log.']);
    exit;
}

$insert->close();

http_response_code(201);
echo json_encode([
    'success' => true,
    'message' => 'Volunteer badge print logged successfully.',
    'logID' => $printLogID,
    'eventID' => $activeEventID,
]);
