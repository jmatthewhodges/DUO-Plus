<?php
/**
 * ============================================================
 *  File:        reprint.php
 *  Description: Updates service selections for a checked-in
 *               patient and allows badge reprinting.
 *               Deletes existing tblVisitServices records for
 *               the active visit and inserts updated ones.
 *               Also updates TranslatorNeeded on tblClients.
 *
 *  Last Modified By:  Skyler
 *  Last Modified On:  Mar 4
 *  Changes Made:      Reprint functionality
 * ============================================================
*/

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/pin-required.php';

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];

// Parse JSON body
$input = json_decode(file_get_contents('php://input'), true);

$clientID         = $input['clientID']         ?? null;
$services         = $input['services']         ?? [];
$needsInterpreter = $input['needsInterpreter'] ?? false;

// --- Validate inputs ---
if (!$clientID || empty($services)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing clientID or services.']);
    exit;
}

$EventID = "4cbde538985861b9"; // Hardcoded eventID — must match GrabQueue.php

// --- Look up the active VisitID for this client scoped to the active event ---
$visitStmt = $mysqli->prepare(
    "SELECT VisitID FROM tblVisits 
     WHERE ClientID = ? 
       AND EventID = ?
       AND RegistrationStatus = 'CheckedIn' 
     ORDER BY FirstCheckedIn DESC, VisitID DESC 
     LIMIT 1"
);

if (!$visitStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Prepare failed (visit lookup): ' . $mysqli->error]);
    exit;
}

$visitStmt->bind_param('ss', $clientID, $EventID);
$visitStmt->execute();
$visitResult = $visitStmt->get_result();
$visitRow    = $visitResult->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'No active checked-in visit found for this client.',
        'debug'   => ['clientID' => $clientID, 'eventID' => $EventID]
    ]);
    exit;
}

$visitID = $visitRow['VisitID'];

// --- Begin transaction ---
$mysqli->begin_transaction();

try {

    // 1. Delete existing VisitServices for this visit
    $deleteStmt = $mysqli->prepare("DELETE FROM tblVisitServices WHERE VisitID = ?");
    if (!$deleteStmt) throw new Exception('Prepare failed (delete): ' . $mysqli->error);

    $deleteStmt->bind_param('s', $visitID);
    if (!$deleteStmt->execute()) throw new Exception('Execute failed (delete): ' . $deleteStmt->error);
    $deleteStmt->close();

    // 2. Insert updated service records
    $insertStmt = $mysqli->prepare(
        "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority, RegCode)
         VALUES (?, ?, ?, 'Pending', NOW(), ?)"
    );
    if (!$insertStmt) throw new Exception('Prepare failed (insert): ' . $mysqli->error);

    foreach ($services as $serviceID) {
        $serviceID      = trim($serviceID);
        $visitServiceID = bin2hex(random_bytes(8));
        $regCode        = strtoupper(substr($visitServiceID, 0, 4));

        $insertStmt->bind_param('ssss', $visitServiceID, $visitID, $serviceID, $regCode);
        if (!$insertStmt->execute()) throw new Exception('Execute failed (insert service "' . $serviceID . '"): ' . $insertStmt->error);
    }
    $insertStmt->close();

    // 3. Update TranslatorNeeded on tblClients
    $translatorValue = $needsInterpreter ? 1 : 0;
    $translatorStmt  = $mysqli->prepare("UPDATE tblClients SET TranslatorNeeded = ? WHERE ClientID = ?");
    if (!$translatorStmt) throw new Exception('Prepare failed (translator): ' . $mysqli->error);

    $translatorStmt->bind_param('is', $translatorValue, $clientID);
    if (!$translatorStmt->execute()) throw new Exception('Execute failed (translator): ' . $translatorStmt->error);
    $translatorStmt->close();

    $mysqli->commit();

    echo json_encode([
        'success'  => true,
        'message'  => 'Services updated and badge ready to reprint.',
        'visitID'  => $visitID,
        'clientID' => $clientID
    ]);

} catch (Exception $e) {
    $mysqli->rollback();
    http_response_code(500);
    error_log('Reprint.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}