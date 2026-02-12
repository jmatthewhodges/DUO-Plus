<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_GET = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Single query to get all client data
$registrationData = $mysqli->prepare("
    SELECT 
        c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DateCreated, c.DOB, c.Sex, c.Phone,
        a.Street1, a.Street2, a.City, a.State, a.ZIP,
        e.Name AS EmergencyName, e.Phone AS EmergencyPhone,
        r.DateTime AS RegistrationDate, r.Medical, r.Optical, r.Dental, r.Hair
    FROM tblClients c
    LEFT JOIN tblClientAddress a ON c.ClientID = a.ClientID
    LEFT JOIN tblClientEmergencyContacts e ON c.ClientID = e.ClientID
    LEFT JOIN tblClientRegistrations r ON c.ClientID = r.ClientID
    WHERE c.ClientID = ?
");

$registrationData->bind_param("i", $clientId);
$registrationData->execute();
$result = $registrationData->get_result();
$userData = $result->fetch_assoc();
$registrationData->close();

// Return data
if ($userData) {
    http_response_code(200);
    $msg = json_encode(['success' => true, 'message' => 'Data retrieved successfully.', 'data' => $userData]);
} else {
    http_response_code(404);
    $msg = json_encode(['success' => false, 'message' => 'Client not found.']);
}

echo $msg;
error_log($msg);

echo "making sure it still works!";