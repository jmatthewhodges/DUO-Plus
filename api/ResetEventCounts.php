<?php
/**
 * ============================================================
 *  File:        ResetEventCounts.php
 *  Purpose:     Reset per-event counters without touching core client data.
 *               - GET: return event list for portal dropdown
 *               - POST: reset analytics + availability counters for EventID
 * ============================================================
 */

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $eventsStmt = $mysqli->prepare(
        "SELECT EventID, EventDate, LocationName, IsActive
         FROM tblEvents
         ORDER BY EventDate DESC, LocationName ASC"
    );

    if (!$eventsStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare events query: ' . $mysqli->error]);
        exit;
    }

    $eventsStmt->execute();
    $rows = $eventsStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $eventsStmt->close();

    $events = [];
    foreach ($rows as $row) {
        $datePart = $row['EventDate'] ?: 'No Date';
        $locationPart = trim((string)($row['LocationName'] ?? ''));
        $label = $locationPart !== '' ? ($datePart . ' - ' . $locationPart) : $datePart;
        if ((int)($row['IsActive'] ?? 0) === 1) {
            $label .= ' (Active)';
        }

        $events[] = [
            'EventID' => $row['EventID'],
            'EventDate' => $row['EventDate'],
            'LocationName' => $row['LocationName'],
            'IsActive' => (int)($row['IsActive'] ?? 0),
            'label' => $label
        ];
    }

    echo json_encode([
        'success' => true,
        'events' => $events
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use GET or POST.']);
    exit;
}

$body = [];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $_POST = array_merge($_POST, $body);
}

$eventID = trim((string)($_POST['EventID'] ?? ''));
if ($eventID === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required field: EventID']);
    exit;
}

$eventCheck = $mysqli->prepare(
    "SELECT EventID, EventDate, LocationName
     FROM tblEvents
     WHERE EventID = ?
     LIMIT 1"
);
if (!$eventCheck) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to prepare event check query: ' . $mysqli->error]);
    exit;
}

$eventCheck->bind_param('s', $eventID);
$eventCheck->execute();
$eventRow = $eventCheck->get_result()->fetch_assoc();
$eventCheck->close();

if (!$eventRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Event not found for provided EventID.']);
    exit;
}

$mysqli->begin_transaction();

try {
    $analyticsReset = $mysqli->prepare(
        "UPDATE tblAnalytics
         SET StatValue = 0,
             LastUpdated = NOW()
         WHERE EventID = ?"
    );
    if (!$analyticsReset) {
        throw new RuntimeException('Failed to prepare analytics reset query: ' . $mysqli->error);
    }
    $analyticsReset->bind_param('s', $eventID);
    $analyticsReset->execute();
    $analyticsRows = $analyticsReset->affected_rows;
    $analyticsReset->close();

    $availabilityReset = $mysqli->prepare(
        "UPDATE tblEventServices
         SET CurrentAssigned = 0,
             SeatsInProgress = 0,
             CurrentStandby = 0
         WHERE EventID = ?"
    );
    if (!$availabilityReset) {
        throw new RuntimeException('Failed to prepare availability reset query: ' . $mysqli->error);
    }
    $availabilityReset->bind_param('s', $eventID);
    $availabilityReset->execute();
    $availabilityRows = $availabilityReset->affected_rows;
    $availabilityReset->close();

    $mysqli->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Event counters reset successfully.',
        'event' => [
            'EventID' => $eventRow['EventID'],
            'EventDate' => $eventRow['EventDate'],
            'LocationName' => $eventRow['LocationName']
        ],
        'reset' => [
            'analyticsRows' => $analyticsRows,
            'eventServiceRows' => $availabilityRows
        ]
    ]);
} catch (Throwable $e) {
    $mysqli->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to reset event counters. Transaction rolled back.',
        'error' => $e->getMessage()
    ]);
}
