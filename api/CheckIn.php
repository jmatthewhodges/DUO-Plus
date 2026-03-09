<?php
/**
 * ============================================================
 *  File:        CheckIn.php
 *  Purpose:     Update client info and check them into waiting room
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 7:53 PM
 *  Changes Made:      Renamed CheckInTime -> EnteredWaitingRoom (updates every check-in)
 *                     Added FirstCheckedIn (one-time insert, never overwritten)
 *                     Added checkedIn list to response for registration table
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
$clientID         = trim($body['clientID'] ?? '');
$services         = $body['services'] ?? [];
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

// Hardcoded EventID for now
$eventID = '4cbde538985861b9';

// Update TranslatorNeeded on tblClients
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

// Fetch the VisitID for this client + event
$visitStmt = $mysqli->prepare(
    "SELECT VisitID, FirstCheckedIn FROM tblVisits WHERE ClientID = ? AND EventID = ? LIMIT 1"
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

$visitID          = $visitRow['VisitID'];
$alreadyCheckedIn = !empty($visitRow['FirstCheckedIn']); // true if they've checked in before
$now              = date('Y-m-d H:i:s');

// Update tblVisits:
//   - EnteredWaitingRoom: always updated (tracks most recent entry)
//   - FirstCheckedIn: only set if it's null (one-time, never overwritten)
if ($alreadyCheckedIn) {
    // Only update EnteredWaitingRoom
    $updateVisit = $mysqli->prepare(
        "UPDATE tblVisits SET RegistrationStatus = 'CheckedIn', EnteredWaitingRoom = ? WHERE VisitID = ?"
    );
    if (!$updateVisit) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
        exit;
    }
    $updateVisit->bind_param('ss', $now, $visitID);
} else {
    // First time — set both EnteredWaitingRoom and FirstCheckedIn
    $updateVisit = $mysqli->prepare(
        "UPDATE tblVisits SET RegistrationStatus = 'CheckedIn', EnteredWaitingRoom = ?, FirstCheckedIn = ? WHERE VisitID = ?"
    );
    if (!$updateVisit) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
        exit;
    }
    $updateVisit->bind_param('sss', $now, $now, $visitID);
}

if (!$updateVisit->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update visit: ' . $updateVisit->error]);
    $updateVisit->close();
    exit;
}
$updateVisit->close();

// Insert rows into tblVisitServices for each service
$insertService = $mysqli->prepare(
    "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority)
     VALUES (?, ?, ?, ?, ?)"
);

if (!$insertService) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}

// Prepare update for tblEventServices
$updateEventService = $mysqli->prepare(
    "UPDATE tblEventServices
     SET CurrentAssigned = CurrentAssigned + 1
     WHERE EventID = ? AND ServiceID = ?"
);

if (!$updateEventService) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}

foreach ($services as $serviceID) {

    $serviceID = trim($serviceID);
    if (empty($serviceID)) continue;

    $visitServiceID = bin2hex(random_bytes(8));
    $queuePriority  = date('Y-m-d H:i:s');

    // Check capacity
    $capacityCheck = $mysqli->prepare(
        "SELECT CurrentAssigned, MaxCapacity
         FROM tblEventServices
         WHERE EventID = ? AND ServiceID = ?"
    );

    $capacityCheck->bind_param('ss', $eventID, $serviceID);
    $capacityCheck->execute();
    $capacity = $capacityCheck->get_result()->fetch_assoc();
    $capacityCheck->close();

    $status = 'Pending';

    if ($capacity && $capacity['CurrentAssigned'] >= $capacity['MaxCapacity']) {
        $status = 'Standby';
    }

    $insertService->bind_param(
        'sssss',
        $visitServiceID,
        $visitID,
        $serviceID,
        $status,
        $queuePriority
    );

    if ($insertService->execute()) {

        if ($status == 'Pending') {

            $update = $mysqli->prepare(
                "UPDATE tblEventServices
                 SET CurrentAssigned = CurrentAssigned + 1
                 WHERE EventID=? AND ServiceID=?"
            );

        } else {

            // Increment CurrentAssigned always, but only increment CurrentStandby if below StandbyLimit
            $update = $mysqli->prepare(
                "UPDATE tblEventServices
                SET CurrentAssigned = CurrentAssigned + 1,
                    CurrentStandby = CASE 
                                        WHEN CurrentStandby < StandbyLimit 
                                        THEN CurrentStandby + 1 
                                        ELSE CurrentStandby 
                                    END
                WHERE EventID=? AND ServiceID=?"
            );
        }

        $update->bind_param('ss', $eventID, $serviceID);
        $update->execute();
        $update->close();

        // Auto-close if CurrentStandby >= StandbyLimit
        $closeService = $mysqli->prepare(
            "UPDATE tblEventServices
            SET IsClosed = 1
            WHERE EventID=? AND ServiceID=? AND CurrentStandby >= StandbyLimit"
        );
        $closeService->bind_param('ss', $eventID, $serviceID);
        $closeService->execute();
        $closeService->close();
    

    } else {
        error_log('Failed to insert VisitService for ' . $serviceID . ': ' . $insertService->error);
    }
}
$insertService->close();

// Update clientsProcessed stat in tblAnalytics
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

// Fetch all checked-in clients for this event (for registration table)
$checkedIn = [];
$checkedInQuery = $mysqli->prepare(
    "SELECT c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, c.TranslatorNeeded,
            GROUP_CONCAT(vs.ServiceID ORDER BY vs.ServiceID SEPARATOR ', ') AS Services
     FROM tblVisits v
     JOIN tblClients c ON c.ClientID = v.ClientID
     JOIN tblVisitServices vs ON vs.VisitID = v.VisitID
     WHERE v.EventID = ? AND v.RegistrationStatus = 'CheckedIn'
     GROUP BY c.ClientID
     ORDER BY c.LastName ASC, c.FirstName ASC"
);
if ($checkedInQuery) {
    $checkedInQuery->bind_param('s', $eventID);
    $checkedInQuery->execute();
    $checkedIn = $checkedInQuery->get_result()->fetch_all(MYSQLI_ASSOC);
    $checkedInQuery->close();
}

$servicesQuery = $mysqli->prepare(
    "SELECT ServiceID, MaxCapacity, CurrentAssigned, StandbyLimit
     FROM tblEventServices
     WHERE EventID = ?"
);
$servicesQuery->bind_param('s', $eventID);
$servicesQuery->execute();
$servicesData = $servicesQuery->get_result()->fetch_all(MYSQLI_ASSOC);
$servicesQuery->close();

// Success
http_response_code(200);
echo json_encode([
    'success'          => true,
    'message'          => 'Client checked in successfully.',
    'visitID'          => $visitID,
    'firstCheckIn'     => !$alreadyCheckedIn,
    'clientsProcessed' => $clientsProcessed,
    'checkedIn'        => $checkedIn,
    'services'         => $servicesData
]);