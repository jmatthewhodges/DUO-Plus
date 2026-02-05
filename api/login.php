<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// From request
$email = $_POST['email'] ?? null;
$password = $_POST['password'] ?? null;

// Check login
$loginGrab = $mysqli->prepare("SELECT ClientID, Password FROM tblClientLogin WHERE Email = ?");
$loginGrab->bind_param("s", $email);
$loginGrab->execute();
$loginGrab->bind_result($clientID, $hashedPassword);

if ($loginGrab->fetch() && password_verify($password, $hashedPassword)) {
    // Close the previous query
    $loginGrab->close();
    // Login successful
    http_response_code(200);
    
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
    $registrationData->bind_param("s", $clientID);
    $registrationData->execute();
    $result = $registrationData->get_result();
    $userData = $result->fetch_assoc();
    
    $msg = json_encode(['success' => true, 'message' => 'Successful login.', 'data' => $userData]);
    echo $msg;
    error_log($msg);
} else {
    // Close the previous query
    $loginGrab->close();
    // Login failed
    http_response_code(401);
    $msg = json_encode(['success' => false, 'message' => 'Failed login.']);
    echo $msg;
    error_log($msg); 
}