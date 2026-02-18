<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];
}

header('Content-Type: application/json');
$mysqli = $GLOBALS['mysqli'];

date_default_timezone_set('America/Chicago');
$now = date('Y-m-d H:i:s');

$checkInStatus = 'waiting_room';
// Waiting_room -> SQL Queue column

$clientID = $_POST['clientID'] ?? null;

if (empty($clientID)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'clientID is required']);
    exit;
}

$services = $_POST['services'] ?? [];

// -------------------------------------------------------------------------
//  DATA PREPARATION
// -------------------------------------------------------------------------

// Check if needsInterpreter flag exists in the database, if so, turn flag into 1 (true) or 0 (false)
// If it's missing (from pre-existing registrations) set it to null so we don't incorrectly overwrite existing data
$needsInterpreter = array_key_exists('needsInterpreter', $_POST)
    ? ($_POST['needsInterpreter'] ? 1 : 0)
    : null;

$hasMedical = in_array('medical', $services) ? 1 : 0;
$hasOptical = in_array('optical', $services) ? 1 : 0;
$hasDental  = in_array('dental', $services) ? 1 : 0;
$hasHair    = in_array('haircut', $services) ? 1 : 0;

// -------------------------------------------------------------------------
//  UPDATE REGISTRATION
// -------------------------------------------------------------------------

$updateRegQuery = "UPDATE tblClientRegistrations
        SET DateTime = ?,
            Medical = ?,
            Optical = ?,
            Dental = ?,
            Hair = ?,
            Queue = ?
        WHERE ClientID = ?";

$stmtReg = $mysqli->prepare($updateRegQuery);

// SQL Failed (Crash or syntax error)


if (!$stmtReg) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration preparation failed: ' . $mysqli->error]);
    exit;
}


// 4 integers (Services) + 2 Strings (Queue column v(which is being bound to waiting_room) & ClientID)

$stmtReg->bind_param("siiiiss", $now, $hasMedical, $hasOptical, $hasDental, $hasHair, $checkInStatus, $clientID);
// Only execute and proceed if update is successful
if (!$stmtReg->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration update failed: ' . $stmtReg->error]);
    $stmtReg->close();
    exit;
}

// If no rows were updated, it means the ClientID does not exist in registrations or data hasn't changed
if ($stmtReg->affected_rows === 0) {
    // Check if the ID exists
    $checkId = $mysqli->prepare("SELECT ClientID FROM tblClientRegistrations WHERE ClientID = ?");
    $checkId->bind_param("s", $clientID);
    $checkId->execute();
    $checkId->store_result();
    if ($checkId->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Client ID not found.'
        ]);
        $checkId->close();
        $stmtReg->close();
        exit;
    }
    $checkId->close(); // The ID exists, but the data was already up to date.
}

$stmtReg->close();

// -------------------------------------------------------------------------
//  UPDATE REGISTRATION STATS
// -------------------------------------------------------------------------

$clientsProcessed = 0;
$stmtStats = $mysqli->prepare("UPDATE tblregistrationstats SET clientsProcessed = clientsProcessed + 1");
if ($stmtStats && $stmtStats->execute()) {
    $stmtStats->close();
    // Fetch the updated count
    $result = $mysqli->query("SELECT clientsProcessed FROM tblregistrationstats LIMIT 1");
    if ($result && $row = $result->fetch_assoc()) {
        $clientsProcessed = (int)$row['clientsProcessed'];
    }
} else {
    error_log("Stats update failed: " . $mysqli->error);
}

// -------------------------------------------------------------------------
//  LANGUAGE UPDATE
// -------------------------------------------------------------------------

// We only touch the language table if the frontend explicitly sent a value.
if ($needsInterpreter !== null) {

    // Check if a row exists for this client
    $checkLang = $mysqli->prepare("SELECT Language_ID FROM tblClientLang WHERE ClientID = ?");
    $checkLang->bind_param("s", $clientID);
    $checkLang->execute();
    $langResult = $checkLang->get_result();
    
    // Update or Insert based on result
    if ($langResult->num_rows > 0) {
        // Row exists: Update it
        $stmtLang = $mysqli->prepare("UPDATE tblClientLang SET NeedsInterpreter = ? WHERE ClientID = ?");
        $stmtLang->bind_param("is", $needsInterpreter, $clientID);
    } else {
        // Row missing: Insert new
        $stmtLang = $mysqli->prepare("INSERT INTO tblClientLang (NeedsInterpreter, ClientID) VALUES (?, ?)");
        $stmtLang->bind_param("is", $needsInterpreter, $clientID);
    }
    $checkLang->close();

    // Execute the update
    if (!$stmtLang->execute()) {
        error_log("Language update failed: " . $stmtLang->error);
    }
    $stmtLang->close();
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
    'services' => [],
    'needsInterpreter' => $needsInterpreter // default to what was set, will update below
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

// Get services info
$stmtServices = $mysqli->prepare("SELECT Medical, Optical, Dental, Hair FROM tblClientRegistrations WHERE ClientID = ?");
$stmtServices->bind_param("s", $clientID);
if ($stmtServices->execute()) {
    $stmtServices->bind_result($med, $opt, $dent, $hair);
    if ($stmtServices->fetch()) {
        $servicesArr = [];
        if ($med) $servicesArr[] = 'medical';
        if ($opt) $servicesArr[] = 'optical';
        if ($dent) $servicesArr[] = 'dental';
        if ($hair) $servicesArr[] = 'haircut';
        $clientData['services'] = $servicesArr;
    }
}
$stmtServices->close();

// Get needsInterpreter from DB if not set in this request
if ($needsInterpreter === null) {
    $stmtLang = $mysqli->prepare("SELECT NeedsInterpreter FROM tblClientLang WHERE ClientID = ?");
    $stmtLang->bind_param("s", $clientID);
    if ($stmtLang->execute()) {
        $stmtLang->bind_result($dbNeedsInterpreter);
        if ($stmtLang->fetch()) {
            $clientData['needsInterpreter'] = $dbNeedsInterpreter;
        }
    }
    $stmtLang->close();
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Client successfully checked in.',
    'client' => $clientData,
    'clientsProcessed' => $clientsProcessed
]);
exit;
