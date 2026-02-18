<?php
/**
 * ============================================================
 *  File:        register.php
 *  Description: Handles client registration. Supports both
 *               new user creation and existing user updates
 *               including address, emergency contacts, and
 *               service selections.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 18 @ 2:42 PM
 *  Changes Made:      Added multi-line comment header and cleaned up code
 * ============================================================
*/

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

// Request method check
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use POST.']);
    exit;
}

// Content-Type check
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'message' => 'Content-Type must be application/json.']);
    exit;
}

// Decode JSON body
$rawBody = file_get_contents('php://input');
$_POST = json_decode($rawBody, true);

if (!is_array($_POST)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Defaults
$status = "Active";
$queue = "registration";

// Check if existing user or new user
$clientID = $_POST['clientId'] ?? null;

if ($clientID) {
    // EXISTING USER - UPDATE
    
    $firstName = isset($_POST['firstName']) ? ucfirst(strtolower(trim($_POST['firstName']))) : null;
    $middleInitial = isset($_POST['middleInitial']) && $_POST['middleInitial'] !== '' ? strtoupper(trim($_POST['middleInitial'])) : null;
    $lastName = isset($_POST['lastName']) ? ucfirst(strtolower(trim($_POST['lastName']))) : null;
    $dob = $_POST['dob'] ?? null;
    $sex = $_POST['sex'] ?? null;
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Update client info
    $clientUpdate = $mysqli->prepare("UPDATE tblClients SET FirstName = ?, MiddleInitial = ?, LastName = ?, DOB = ?, Sex = ?, Phone = ? WHERE ClientID = ?");
    if (!$clientUpdate) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $clientUpdate->bind_param("sssssss", $firstName, $middleInitial, $lastName, $dob, $sex, $phone, $clientID);
    $clientUpdate->execute();

    $noAddress = $_POST['noAddress'] ?? true;

    // Address
    if ($noAddress == false) {
        $address1 = $_POST['address1'] ?? '';
        $address2 = $_POST['address2'] ?? null;
        $city = isset($_POST['city']) ? ucfirst(strtolower(trim($_POST['city']))) : '';
        $state = $_POST['state'] ?? '';
        $zipCode = $_POST['zipCode'] ?? '';

        if (empty($address1) || empty($city) || empty($state) || empty($zipCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Address fields (address1, city, state, zipCode) are required when noAddress is false.']);
            exit;
        }

        // Check if address exists
        $checkAddress = $mysqli->prepare("SELECT ClientID FROM tblClientAddress WHERE ClientID = ? AND Status = 'Active'");
        $checkAddress->bind_param("s", $clientID);
        $checkAddress->execute();
        $addressResult = $checkAddress->get_result();

        if ($addressResult->num_rows > 0) {
            // Update existing address
            $addressUpdate = $mysqli->prepare("UPDATE tblClientAddress SET Street1 = ?, Street2 = ?, City = ?, State = ?, ZIP = ? WHERE ClientID = ? AND Status = 'Active'");
            $addressUpdate->bind_param("ssssss", $address1, $address2, $city, $state, $zipCode, $clientID);
            $addressUpdate->execute();
        } else {
            // Insert new address
            $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(Street1, Street2, City, State, ZIP, Status, ClientID) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $addressInsertion->bind_param("sssssss", $address1, $address2, $city, $state, $zipCode, $status, $clientID);
            $addressInsertion->execute();
        }
    }

    $noEmergencyContact = $_POST['noEmergencyContact'] ?? true;

    // Emergency contact
    if (!$noEmergencyContact) {
        $emergencyFirstName = isset($_POST['emergencyFirstName']) ? ucfirst(strtolower(trim($_POST['emergencyFirstName']))) : '';
        $emergencyLastName = isset($_POST['emergencyLastName']) ? ucfirst(strtolower(trim($_POST['emergencyLastName']))) : '';
        $emergencyPhone = $_POST['emergencyPhone'] ?? '';

        if (empty($emergencyFirstName) || empty($emergencyLastName) || empty($emergencyPhone)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Emergency contact fields (emergencyFirstName, emergencyLastName, emergencyPhone) are required when noEmergencyContact is false.']);
            exit;
        }
        $emergencyFullName = $emergencyFirstName . " " . $emergencyLastName;

        // Check if emergency contact exists
        $checkEmergency = $mysqli->prepare("SELECT ClientID FROM tblClientEmergencyContacts WHERE ClientID = ? AND Status = 'Active'");
        $checkEmergency->bind_param("s", $clientID);
        $checkEmergency->execute();
        $emergencyResult = $checkEmergency->get_result();

        if ($emergencyResult->num_rows > 0) {
            // Update existing emergency contact
            $emergencyUpdate = $mysqli->prepare("UPDATE tblClientEmergencyContacts SET Name = ?, Phone = ? WHERE ClientID = ? AND Status = 'Active'");
            $emergencyUpdate->bind_param("sss", $emergencyFullName, $emergencyPhone, $clientID);
            $emergencyUpdate->execute();
        } else {
            // Insert new emergency contact
            $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ClientID, Name, Phone, Status) VALUES (?, ?, ?, ?)");
            $emergencyContactInsertion->bind_param("ssss", $clientID, $emergencyFullName, $emergencyPhone, $status);
            $emergencyContactInsertion->execute();
        }
    }

    // Services and registration
    $currentDateTime = date('Y-m-d H:i:s');
    $services = $_POST['services'] ?? [];
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental  = in_array('dental', $services) ? 1 : 0;
    $hasHair    = in_array('haircut', $services) ? 1 : 0;

    // Update registration
    $servicesUpdate = $mysqli->prepare("UPDATE tblClientRegistrations SET DateTime = ?, Medical = ?, Optical = ?, Dental = ?, Hair = ?, Queue = ? WHERE ClientID = ?");
    $servicesUpdate->bind_param("siiiiss", $currentDateTime, $hasMedical, $hasOptical, $hasDental, $hasHair, $queue, $clientID);
    $result = $servicesUpdate->execute();

    if ($result) {
        http_response_code(200);
        $msg = json_encode(['success' => true, 'message' => 'Information updated successfully.']);
        echo $msg;
        error_log($msg);
    } else {
        http_response_code(400);
        $msg = json_encode(['success' => false, 'message' => 'Update failed']);
        echo $msg;
        error_log($msg);
    }

} else {
    // NEW USER - INSERT

    // Validate required fields
    $required = ['firstName', 'lastName', 'dob', 'sex', 'email', 'password'];
    $missing = [];
    foreach ($required as $field) {
        if (!isset($_POST[$field]) || trim($_POST[$field]) === '') {
            $missing[] = $field;
        }
    }
    if (!empty($missing)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields: ' . implode(', ', $missing)]);
        exit;
    }

    // Validate email format
    if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
        exit;
    }

    // Validate sex value
    if (!in_array($_POST['sex'], ['Male', 'Female', 'Intersex'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Sex must be Male, Female, or Intersex.']);
        exit;
    }

    // Generate unique clientID and prepare data
    $clientID = bin2hex(random_bytes(8));
    $firstName = ucfirst(strtolower(trim($_POST['firstName'])));
    $middleInitial = isset($_POST['middleInitial']) && $_POST['middleInitial'] !== '' ? strtoupper(trim($_POST['middleInitial'])) : null;
    $lastName = ucfirst(strtolower(trim($_POST['lastName'])));
    $dateCreated = date('Y-m-d');
    $dob = $_POST['dob'];
    $sex = $_POST['sex'];
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Insert client
    $clientCreation = $mysqli->prepare("INSERT INTO tblClients(ClientID, FirstName, MiddleInitial, LastName, DateCreated, DOB, Sex, Phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$clientCreation) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $clientCreation->bind_param("ssssssss", $clientID, $firstName, $middleInitial, $lastName, $dateCreated, $dob, $sex, $phone);
    if (!$clientCreation->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create client: ' . $clientCreation->error]);
        exit;
    }

    // Insert login credentials
    $email = trim($_POST['email']);
    $password = password_hash($_POST['password'], PASSWORD_BCRYPT);


    $loginInsertion = $mysqli->prepare("INSERT INTO tblClientLogin(ClientID, Email, Password) VALUES (?, ?, ?)");
    if (!$loginInsertion) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $loginInsertion->bind_param("sss", $clientID, $email, $password);
    if (!$loginInsertion->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create login: ' . $loginInsertion->error]);
        exit;
    }

    $noAddress = $_POST['noAddress'] ?? true;

    // Address
    if ($noAddress == false) {
        $address1 = $_POST['address1'] ?? '';
        $address2 = $_POST['address2'] ?? null;
        $city = isset($_POST['city']) ? ucfirst(strtolower(trim($_POST['city']))) : '';
        $state = $_POST['state'] ?? '';
        $zipCode = $_POST['zipCode'] ?? '';

        if (empty($address1) || empty($city) || empty($state) || empty($zipCode)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Address fields (address1, city, state, zipCode) are required when noAddress is false.']);
            exit;
        }

        // Insert address
        $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(Street1, Street2, City, State, ZIP, Status, ClientID) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $addressInsertion->bind_param("sssssss", $address1, $address2, $city, $state, $zipCode, $status, $clientID);
        $addressInsertion->execute();
    }

    $noEmergencyContact = $_POST['noEmergencyContact'] ?? true;

    // Emergency contact
    if (!$noEmergencyContact) {
        $emergencyFirstName = isset($_POST['emergencyFirstName']) ? ucfirst(strtolower(trim($_POST['emergencyFirstName']))) : '';
        $emergencyLastName = isset($_POST['emergencyLastName']) ? ucfirst(strtolower(trim($_POST['emergencyLastName']))) : '';
        $emergencyPhone = $_POST['emergencyPhone'] ?? '';

        if (empty($emergencyFirstName) || empty($emergencyLastName) || empty($emergencyPhone)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Emergency contact fields (emergencyFirstName, emergencyLastName, emergencyPhone) are required when noEmergencyContact is false.']);
            exit;
        }

        $emergencyFullName = $emergencyFirstName . " " . $emergencyLastName;

        // Insert emergency contact
        $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ClientID, Name, Phone, Status) VALUES (?, ?, ?, ?)");
        $emergencyContactInsertion->bind_param("ssss", $clientID, $emergencyFullName, $emergencyPhone, $status);
        $emergencyContactInsertion->execute();
    }

    // Services and registration
    $currentDateTime = date('Y-m-d H:i:s');
    $services = $_POST['services'] ?? [];
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental  = in_array('dental', $services) ? 1 : 0;
    $hasHair    = in_array('haircut', $services) ? 1 : 0;

    // Insert registration
    $servicesInsertion = $mysqli->prepare("INSERT INTO tblClientRegistrations(ClientID, DateTime, Medical, Optical, Dental, Hair, Queue) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $servicesInsertion->bind_param("ssiiiis", $clientID, $currentDateTime, $hasMedical, $hasOptical, $hasDental, $hasHair, $queue);
    $result = $servicesInsertion->execute();

    if ($result) {
        http_response_code(201);
        $msg = json_encode(['success' => true, 'message' => 'New client created.']);
        echo $msg;
        error_log($msg); 
    } else {
        http_response_code(400);
        $msg = json_encode(['success' => false, 'message' => 'Insert failed']);
        echo $msg;
        error_log($msg); 
    }
}