<?php
/**
 * ============================================================
 * File:          check-in.php
 * Description:   Updates database tables. Changes the client's 
 *                queue position and services requested, and 
 *                checks whether they need a language interpreter.
 * 
 * Last Modified By:  Lauren
 * Last Modified On:  Feb 19 @ 7:35 PM
 * Changes Made:      Updated endpoint to work with new database structure.
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type
if ($_SERVER['CONTENT_TYPE'] !== 'application/json') {
    http_response_code(415);
    exit(json_encode(['success' => false, 'error' => 'Invalid content type. Expected application/json.']));
}

// If above works, set POST request type for JSON data
$_POST = json_decode(file_get_contents('php://input'), true) ?? [];
$clientID = $_POST['clientID'] ?? null;

if (empty($clientID)) {
    http_response_code(400);
    exit(json_encode(['success' => false, 'error' => 'clientID is required']));
}

header('Content-Type: application/json');
$mysqli = $GLOBALS['mysqli'];

date_default_timezone_set('America/Chicago');
$now = date('Y-m-d H:i:s');


// -------------------------------------------------------------------------
//  DATA PREPARATION & TRANSLATOR FLAG
// -------------------------------------------------------------------------

$services = $_POST['services'] ?? [];

// Check if needsInterpreter flag exists in the database, if so, turn flag into 1 (true) or 0 (false)
// If it's missing (from pre-existing registrations) set it to null so we don't incorrectly overwrite existing data

$needsInterpreter = isset($_POST['needsInterpreter']) ? (int)$_POST['needsInterpreter'] : null;

// Update translation flag
if ($needsInterpreter !== null) {
    $stmtClient = $mysqli->prepare("UPDATE tblClients SET TranslatorNeeded = ? WHERE ClientID = ?");
    $stmtClient->bind_param("is", $needsInterpreter, $clientID);
    $stmtClient->execute();
    $stmtClient->close();
}

// Fetch active event
$eventResult = $mysqli->query("SELECT EventID FROM tblEvents WHERE IsActive = 1 LIMIT 1");
$eventID = $eventResult && $eventResult->num_rows > 0 ? $eventResult->fetch_object()->EventID : null;

if (!$eventID) {
    http_response_code(400);
    exit(json_encode(['success' => false, 'message' => 'No active event found.']));
}


// -------------------------------------------------------------------------
//  CLIENT VALIDATION
// -------------------------------------------------------------------------

$checkClient = $mysqli->prepare("SELECT ClientID FROM tblClients WHERE ClientID = ?");
$checkClient->bind_param("s", $clientID);
$checkClient->execute();
$checkClient->store_result();

if ($checkClient->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(['success' => false, 'message' => 'Profile not found. Please register first.']));
}
$checkClient->close();



// -------------------------------------------------------------------------
//  UPDATE REGISTRATION
// -------------------------------------------------------------------------

$regStatus = 'Registered';

// Insert new visit data for check-in
$visitID = $clientID . "_" . $eventID; 

$visitCheck = $mysqli->prepare("INSERT INTO tblVisits (VisitID, ClientID, EventID, RegistrationStatus, CheckInTime, QR_Code_Data) 
    VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
        RegistrationStatus = VALUES(RegistrationStatus), 
        CheckInTime = VALUES(CheckInTime)
");

$visitCheck->bind_param("ssssss", $visitID, $clientID, $eventID, $regStatus, $now, $clientID);

if (!$visitCheck->execute()) {
    http_response_code(500);
    exit(json_encode(['success' => false, 'message' => 'Visit failed: ' . $visitCheck->error]));
}
$visitCheck->close();

// -------------------------------------------------------------------------
//  SERVICE ASSIGNMENT
// -------------------------------------------------------------------------

// Remove old selections from previous visits
$mysqli->query("DELETE FROM tblVisitServices WHERE VisitID = '$visitID'");

if (!empty($services)) {
    $initialServiceStatus = 'Pending'; 
    $stmtInsertService = $mysqli->prepare("INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority) VALUES (?, ?, ?, ?, ?)");

    foreach ($services as $serviceID) {
        // Temporary service ID
        $visitServiceEntryID = $visitID . "_" . $serviceID; 
        $stmtInsertService->bind_param("sssss", $visitServiceEntryID, $visitID, $serviceID, $initialServiceStatus, $now);
        $stmtInsertService->execute();
    }
    $stmtInsertService->close();
}

// -------------------------------------------------------------------------
//  tblAnalytics UPDATE
// -------------------------------------------------------------------------

$analyticsStatKey = 'clientsProcessed';
$analyticsStatID = "stat_" . $eventID; 

$mysqli->query("INSERT INTO tblAnalytics (StatID, EventID, StatKey, StatValue, LastUpdated) 
    VALUES ('$analyticsStatID', '$eventID', '$analyticsStatKey', 1, '$now') 
    ON DUPLICATE KEY UPDATE StatValue = StatValue + 1, LastUpdated = '$now'
");

// -------------------------------------------------------------------------
//  UPDATE REGISTRATION STATS
// -------------------------------------------------------------------------

// Fetch the updated count to return in the response
$clientsProcessed = 0;
$resStat = $mysqli->query("SELECT StatValue FROM tblAnalytics WHERE EventID = '$eventID' AND StatKey = '$analyticsStatKey'");
if ($row = $resStat->fetch_assoc()) {
    $clientsProcessed = (int)$row['StatValue'];
}

// -------------------------------------------------------------------------
// SUCCESS RESPONSE
// -------------------------------------------------------------------------

// Only fetch and return client data if update was successful or data was already up to date
// (i.e., we did not exit above)

$clientData = [
    'clientID' => $clientID,
    'firstName' => null,
    'middleInitial' => null,
    'lastName' => null,
    'services' => $services, // Changed from [] to $services
    'needsInterpreter' => $needsInterpreter
];

// Get client name info
$stmtClient = $mysqli->prepare("SELECT FirstName, MiddleInitial, LastName FROM tblClients WHERE ClientID = ?");
$stmtClient->bind_param("s", $clientID);
if ($stmtClient->execute()) {
    $stmtClient->bind_result($firstName, $middleInitial, $lastName);
    if ($stmtClient->fetch()) {
        $clientData['firstName'] = $firstName;
        $clientData['middleInitial'] = $middleInitial;
        $clientData['lastName'] = $lastName;
    }
}
$stmtClient->close();


http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Client successfully checked in.',
    //  'client' => $clientData,
    // 'visitID' => $visitID,
    'clientsProcessed' => $clientsProcessed
]);
exit;
