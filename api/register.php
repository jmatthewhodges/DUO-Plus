<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Generate a unique clientID
$clientID = bin2hex(random_bytes(8));
$firstName = $_POST['firstName'] ?? null;
$middleInitial = $_POST['middleInitial'] ?? null;
$lastName = $_POST['lastName'] ?? null;
// Get current date
$dateCreated = date('Y-m-d');
$dob = $_POST['dob'] ?? null;
$sex = $_POST['sex'] ?? null;
$phone = $_POST['phone'] ?? null;

// Prepare client info
$clientCreation = $mysqli->prepare("INSERT INTO tblclients(ClientID, FirstName, MiddleInitial, LastName, DateCreated, DOB, Sex, Phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
// Bind variables to placeholders
$clientCreation->bind_param("ssssssss", $clientID, $firstName, $middleInitial, $lastName, $dateCreated, $dob, $sex, $phone);
// Execute the statement
$clientCreation->execute();

$email = $_POST['email'] ?? null;
// Hash the password using bcrypt
$password = password_hash($_POST['password'], PASSWORD_BCRYPT) ?? null;

// Prepare client login info
$loginInsertion = $mysqli->prepare("INSERT INTO tblclientlogin(ClientID, Email, Password) VALUES (?, ?, ?)");
// Bind variables to placeholders
$loginInsertion->bind_param("sss", $clientID, $email, $password);
// Execute the statement
$loginInsertion->execute();

$noAddress = $_POST['noAddress'] ?? true;

// If client has address
if ($noAddress == false) {
    $address1 = $_POST['address1'];
    $address2 = $_POST['address2'] ?? null;
    $city = $_POST['city'];
    $state = $_POST['state'];
    $zipCode = $_POST['zipCode'];
} else {
    $address1 = null;
    $address2 = null;
    $city = null;
    $state = null;
    $zipCode = null;
}

$status = "Active";

// Prepare client address
$addressInsertion = $mysqli->prepare("INSERT INTO tblclientaddress(Street1, Street2, City, State, ZIP, Status, ClientID) VALUES (?, ?, ?, ?, ?, ?, ?)");

// Bind the variables to the placeholders
// "s" means string, "d" means double (float or number)
$addressInsertion->bind_param("sssssss", $address1, $address2, $city, $state, $zipCode, $status, $clientID);

$noEmergencyContact = $_POST['noEmergencyContact'] ?? true;

// If client has emergency contact
if (!$noEmergencyContact) {
    $emergencyFirstName = $_POST['emergencyFirstName'];
    $emergencyLastName = $_POST['emergencyLastName'];
    $emergencyPhone = $_POST['emergencyPhone'];
} else {
    $emergencyFirstName = null;
    $emergencyLastName = null;
    $emergencyPhone = null;
}

// String together first & last name
$emergencyFullName = $emergencyFirstName . " " . $emergencyLastName;

// Prepare client emergency contact
$emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblclientemergencycontacts(ClientID, Name, Phone, Status) VALUES (?, ?, ?, ?)");

// Bind the variables to the placeholders
$emergencyContactInsertion->bind_param("ssss", $clientID, $emergencyFullName, $emergencyPhone, $status);

// Execute the statement
$emergencyContactInsertion->execute();

// Get current date + time
$currentDateTime = date('Y-m-d H:i:s');
$services = $_POST['services'] ?? [];
// Check services array
$hasMedical = in_array('medical', $services);
$hasOptical = in_array('optical', $services);
$hasDental  = in_array('dental', $services);
$hasHair    = in_array('hair', $services);

// Prepare client services
$servicesInsertion = $mysqli->prepare("INSERT INTO tblclientregistrations(ClientID, DateTime, Medical, Optical, Dental, Hair) VALUES (?, ?, ?, ?, ?, ?)");

// Bind the variables to the placeholders
$servicesInsertion->bind_param("ssssss", $clientID, $currentDateTime, $hasMedical, $hasOptical, $hasDental, $hasHair);

// Execute the statement
$result = $servicesInsertion->execute();

if ($result) {
    http_response_code(201); // Created
    $msg = json_encode(['success' => true, 'message' => 'New client created.']);
    echo $msg;
    error_log($msg); // This will write to the PHP error log
} else {
    http_response_code(400); // Bad Request
    $msg = json_encode(['success' => false, 'message' => 'Insert failed']);
    echo $msg;
    error_log($msg); // This will write to the PHP error log
}