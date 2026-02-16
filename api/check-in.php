<?php

// Database connection from other file

require_once __DIR__ . '/db.php';


// Get header type, set POST request type for JSON data

if ($_SERVER['CONTENT_TYPE'] === 'application/json') {

    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];

}

header('Content-Type: application/json');
$mysqli = $GLOBALS['mysqli'];

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
        SET DateTime = NOW(),
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
$stmtReg->bind_param("iiiiss", $hasMedical, $hasOptical, $hasDental, $hasHair, $checkInStatus, $clientID);
if ($stmtReg->affected_rows === 0) {
    // 0 rows affected could mean ID not found 
    // or data hasn't changed. So we check if the ID exists
    $checkId = $mysqli->prepare("SELECT ClientID FROM tblClientRegistrations WHERE ClientID = ?");
    $checkId->bind_param("s", $clientID);
    $checkId->execute();
    $checkId->store_result();

// Checking execution
if (!$stmtReg->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration update failed: ' . $stmtReg->error]);
    $stmtReg->close();
    exit;
    }
}

// If no rows were updated, it means the ClientID 
// does not exist in registrations. We check if they exist.
if ($stmtReg->affected_rows === 0) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Client ID not found.']);
    // We stop execution here so we don't try to insert into Language table for a ghost user
    $checkId->close();
    $stmtReg->close();
    exit;
}

$checkId->close(); // The ID exists, but the data was already up to date.

$stmtReg->close();

// -------------------------------------------------------------------------
//  DATABASE UPDATE
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

http_response_code(200);
echo json_encode(['success' => true, 'message' => 'Client successfully checked in.']);
exit;
