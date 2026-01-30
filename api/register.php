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

// Prepare client info
$clientCreation = $mysqli->prepare("INSERT INTO tblclients(ClientID, FirstName, MiddleInitial, LastName, DateCreated, DOB, Sex) VALUES (?, ?, ?, ?, ?, ?, ?)");
// Bind variables to placeholders
$clientCreation->bind_param("sssssss", $clientID, $firstName, $middleInitial, $lastName, $dateCreated, $dob, $sex);
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
$phone = $_POST['phone'] ?? null;

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

$services = $_POST['services'] ?? null;
$status = "Active";

// Prepare client address
$addressInsertion = $mysqli->prepare("INSERT INTO tblclientaddress(Street1, Street2, City, State, ZIP, Status, ClientID) VALUES (?, ?, ?, ?, ?, ?, ?)");

// Bind the variables to the placeholders
// "s" means string, "d" means double (float or number)
$addressInsertion->bind_param("sssssss", $address1, $address2, $city, $state, $zipCode, $status, $clientID);

// Execute the statement
$result = $addressInsertion->execute();

if ($result) {
    http_response_code(201); // Created
    $msg = json_encode(['success' => true, 'message' => 'Insert successful']);
    echo $msg;
    error_log($msg); // This will write to the PHP error log
} else {
    http_response_code(400); // Bad Request
    $msg = json_encode(['success' => false, 'message' => 'Insert failed']);
    echo $msg;
    error_log($msg); // This will write to the PHP error log
}