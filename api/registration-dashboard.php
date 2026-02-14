<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_GET = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Query to get all client data related to the dashboard (client names, DOBs, language flags, and pre-selected services.)
$clientDataStmt = $mysqli->prepare("
    SELECT 
        c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, r.Medical, r.Optical, r.Dental, r.Hair
    FROM tblClients c
    LEFT JOIN tblClientAddress a ON c.ClientID = a.ClientID
    LEFT JOIN tblClientEmergencyContacts e ON c.ClientID = e.ClientID
    LEFT JOIN tblClientRegistrations r ON c.ClientID = r.ClientID
    WHERE r.queue = 'registration'
");
//checks for if the connection to mysql is a success
if (! $clientDataStmt) {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'error' => $mysqli->error]);
    echo $msg;
    error_log($msg); 
    exit;
}
//executes prepared query akin to the mysql connection
if (! $clientDataStmt->execute()) {
    http_response_code(500);
    $msg =  json_encode(['success' => false, 'error' => $clientDataStmt->error]);
    echo $msg;
    error_log($msg); 
    $clientDataStmt->close();
    exit;
}
//gets result, fetches all rows, closes statement
$result = $clientDataStmt->get_result();
$rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$clientDataStmt->close();

//counting the number of rows to then pull a respone for each individual person
if (count($rows) > 0) {
    http_response_code(200);
    $msg = json_encode(['success' => true, 'count' => count($rows), 'data' => $rows]);
} else {
    http_response_code(200);
    $msg = json_encode(['success' => true, 'count' => 0, 'data' => []]);
}

echo $msg;
error_log($msg);