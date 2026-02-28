<?php
/**
 * ============================================================
 *  File:        food-truck-stats.php
 *  Purpose:     Backend of food-truck.html, handles loading and saving the counter
 *
 *  Last Modified By:  Lauren
 *  Last Modified On:  Feb 27 @ 
 *  Changes Made:      Created file.
 * ============================================================
*/


// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, request type for JSON data (Array merges POST with jsonData)
if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' &&
    isset($_SERVER['CONTENT_TYPE']) &&
    str_contains($_SERVER['CONTENT_TYPE'], 'application/json')
) {
    $jsonData = json_decode(file_get_contents('php://input'), true) ?? [];
    $_POST = array_merge($_POST, $jsonData);
}

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];



// Map JS counters to database

$statConfig = [
    'clientsServed' => [
        'statID' => 'foodTruckClientsServed',
        'statKey' => 'clientsServed'
    ],
    'volunteersServed' => [
        'statID' => 'foodTruckVolunteersServed',
        'statKey' => 'volunteersServed'
    ]
];

// Decide which EventID to use. If a specific one is being sent through it uses that,
// otherwise it grabs the most recent active event. This is just for flexibility to make sure it works
// Even though they said they'd only have the one active event at a time.

function grabEventID(mysqli $mysqli): ?string
{
    // Check request for a specific eventID
    $requestEventID = $_GET['EventID'] ?? $_POST['EventID'] ?? '';
    if (!empty($requestEventID)) {
        return $requestEventID;
    }


    // Otherwise check most current event
    $activeEventCheck = $mysqli->prepare(
        'SELECT EventID 
        FROM tblEvents 
        WHERE IsActive = 1 
        ORDER BY EventDate DESC 
        LIMIT 1'
    );

    if (!$activeEventCheck) {
        return null;
    }


    $activeEventCheck->execute();
    // Fetch the first row
    $result = $activeEventCheck->get_result();
    // If a row exists, return EventID
    // If no row exists, event was not found
    $row = $result ? $result->fetch_assoc() : null;
    // close
    $activeEventCheck->close();

    return $row['EventID'] ?? null;
}

// Insert or update a stat. 
function saveStat(
    mysqli $mysqli,
    string $eventID,
    string $statID,
    string $statKey,
    int $value
): bool {
    $dataCollectQuery = $mysqli->prepare(
        'INSERT INTO tblAnalytics 
         (StatID, EventID, StatKey, StatValue, LastUpdated)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         StatValue = VALUES(StatValue),
         EventID = VALUES(EventID),
         StatKey = VALUES(StatKey),
         LastUpdated = NOW()'
    );

    if (!$dataCollectQuery) {
        return false;
    }

    // If the row doesn't exist, it is inserted. 

    // If it already exists, it's updated.

    $dataCollectQuery->bind_param('sssi', $statID, $eventID, $statKey, $value);
    $collectSuccess = $dataCollectQuery->execute();
    $dataCollectQuery->close();

    return $collectSuccess;
}


// If no id is provided and no active event is in database,
// return error because counter must attach to an event
$eventID = grabEventID($mysqli);
if (!$eventID) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No EventID provided and no active event found.'
    ]);
    exit;
}


// GET request. Return current counter values. Used when page loads or refreshes.

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    // Default values stay 0 when no stat rows are found
    $stats = [
        'clientsServed' => 0,
        'volunteersServed' => 0
    ];
    

    $readStats = $mysqli->prepare(
        'SELECT StatKey, StatValue
         FROM tblAnalytics
         WHERE EventID = ?
         AND StatKey IN (?, ?)'
    );

    if (!$readStats) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare stats query.']);
        exit;
    }

    $clientKey = $statConfig['clientsServed']['statKey'];
    $volKey = $statConfig['volunteersServed']['statKey'];


    // Bind event id and stats
    $readStats->bind_param('sss', $eventID, $clientKey, $volKey);
    // Execute query and retrieve the results
    $readStats->execute();
    $result = $readStats->get_result();


    // Update defaults if row is found
    while ($row = $result->fetch_assoc()) {
        $key = $row['StatKey'];
        if (array_key_exists($key, $stats)) {
            $stats[$key] = (int)$row['StatValue'];
        }
    }
    $readStats->close();

    echo json_encode([
        'success' => true,
        'eventID' => $eventID,
        'stats' => $stats,
        'lastRefreshed' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// POST request. Save the counter name and value. Called after each + or - click.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $counterName = $_POST['counterName'] ?? '';
    $valuePost = $_POST['value'] ?? null;

    // Validate correct counter is being sent
    if (!isset($statConfig[$counterName])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Counter not recognized.']);
        exit;
    }

    // Validate value
    if (!is_numeric($valuePost)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Value must be numeric.']);
        exit;
    }

    // Don't allow it to go below 0.
    $value = max(0, (int)$valuePost);

    $statInfo = $statConfig[$counterName];
    $collectSuccess = saveStat(
        $mysqli,
        $eventID,
        $statInfo['statID'],
        $statInfo['statKey'],
        $value
    );

    // If the save failed, return an error
    if (!$collectSuccess) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save stat counter.']);
        exit;
    }

    // Otherwise return success with new value
    echo json_encode([
        'success' => true,
        'eventID' => $eventID,
        'counterName' => $counterName,
        'value' => $value,
        'message' => 'Counter saved.'
    ]);
    exit;
}