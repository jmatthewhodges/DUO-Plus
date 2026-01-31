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
$loginGrab = $mysqli->prepare("SELECT ClientID, Password FROM tblclientlogin WHERE Email = ?");
$loginGrab->bind_param("s", $email);
$loginGrab->execute();
$loginGrab->bind_result($clientID, $hashedPassword);

if ($loginGrab->fetch() && password_verify($password, $hashedPassword)) {
    // Login successful
    http_response_code(200); 
    $msg = json_encode(['success' => true, 'message' => 'Successful login.']);
    echo $msg;
    error_log($msg); 
} else {
    // Login failed
    http_response_code(401);
    $msg = json_encode(['success' => false, 'message' => 'Failed login.']);
    echo $msg;
    error_log($msg); 
}