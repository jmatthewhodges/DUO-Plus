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
$clientID = $_POST['clientID'] ?? null;

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
        $checkAddress = $mysqli->prepare("SELECT ClientID FROM tblClientAddress WHERE ClientID = ?");
        $checkAddress->bind_param("s", $clientID);
        $checkAddress->execute();
        $addressResult = $checkAddress->get_result();

        if ($addressResult->num_rows > 0) {
            // Update existing address
            $addressUpdate = $mysqli->prepare("UPDATE tblClientAddress SET Street1 = ?, Street2 = ?, City = ?, State = ?, ZIP = ? WHERE ClientID = ?");
            $addressUpdate->bind_param("ssssss", $address1, $address2, $city, $state, $zipCode, $clientID);
            $addressUpdate->execute();
        } else {
            // Insert new address
            // Generate unique AddressID
            $AddressID = bin2hex(random_bytes(8));

            $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(AddressID, ClientID, Street1, Street2, City, State, ZIP) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $addressInsertion->bind_param("sssssss", $AddressID, $clientID, $address1, $address2, $city, $state, $zipCode);
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
        $checkEmergency = $mysqli->prepare("SELECT ClientID FROM tblClientEmergencyContacts WHERE ClientID = ?");
        $checkEmergency->bind_param("s", $clientID);
        $checkEmergency->execute();
        $emergencyResult = $checkEmergency->get_result();

        if ($emergencyResult->num_rows > 0) {
            // Update existing emergency contact
            $emergencyUpdate = $mysqli->prepare("UPDATE tblClientEmergencyContacts SET Name = ?, Phone = ? WHERE ClientID = ?");
            $emergencyUpdate->bind_param("sss", $emergencyFullName, $emergencyPhone, $clientID);
            $emergencyUpdate->execute();
        } else {
            // Insert new emergency contact
            // Generate unique ContactID
            $ContactID = bin2hex(random_bytes(8));

            $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ContactID, ClientID, Name, Phone) VALUES (?, ?, ?, ?)");
            $emergencyContactInsertion->bind_param("ssss", $ContactID, $clientID, $emergencyFullName, $emergencyPhone);
            $emergencyContactInsertion->execute();
        }
    }

    // Insert selected services into tblVisitServiceSelections for existing client
    $EventID = $_POST['EventID'] ?? null; 
    $services = $_POST['services'] ?? [];

    if (!$EventID) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'EventID is required.']);
        exit;
    }

    if (empty($services) || !is_array($services)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one service must be selected.']);
        exit;
    }

    // Check if EventID exists
    $eventCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblEvents WHERE EventID = ?");
    $eventCheck->bind_param("s", $EventID);
    $eventCheck->execute();
    $eventCheck->bind_result($eventCount);
    $eventCheck->fetch();
    $eventCheck->close();

    if ($eventCount == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'EventID does not exist.']);
        exit;
    }

    // Check if each ServiceID is valid
    foreach ($services as $service) {
        $serviceCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ServiceID = ?");
        $serviceCheck->bind_param("s", $service);
        $serviceCheck->execute();
        $serviceCheck->bind_result($serviceCount);
        $serviceCheck->fetch();
        $serviceCheck->close();

        if ($serviceCount == 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => "ServiceID '$service' does not exist."]);
            exit;
        }
    }

    // (Optional) Remove previous selections for this client/event
    $deleteOld = $mysqli->prepare("DELETE FROM tblVisitServiceSelections WHERE ClientID = ? AND EventID = ?");
    $deleteOld->bind_param("ss", $clientID, $EventID);
    $deleteOld->execute();

    // Insert new selections
    foreach ($services as $service) {
        $selectionID = bin2hex(random_bytes(8));
        $stmt = $mysqli->prepare("INSERT INTO tblVisitServiceSelections (SelectionID, ClientID, EventID, ServiceID, DateSelected) VALUES (?, ?, ?, ?, NOW())");
        $stmt->bind_param("ssss", $selectionID, $clientID, $EventID, $service);
        $stmt->execute();
    }

    http_response_code(200);
    $msg = json_encode(['success' => true, 'message' => 'Information and services updated successfully.']);
    echo $msg;
    error_log($msg);

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
    $dateCreated = date('Y-m-d H:i:s');
    $dob = $_POST['dob'];
    $sex = $_POST['sex'];
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Insert client
    $clientCreation = $mysqli->prepare("INSERT INTO tblClients(ClientID, FirstName, MiddleInitial, LastName, DOB, Sex, Phone, DateCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$clientCreation) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $clientCreation->bind_param("ssssssss", $clientID, $firstName, $middleInitial, $lastName, $dob, $sex, $phone, $dateCreated);
    if (!$clientCreation->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create client: ' . $clientCreation->error]);
        exit;
    }

    // Insert login credentials
    // Generate unique AuthID
    $AuthID = bin2hex(random_bytes(8));
    $email = trim($_POST['email']);
    $password = password_hash($_POST['password'], PASSWORD_BCRYPT);

    $loginInsertion = $mysqli->prepare("INSERT INTO tblClientAuth(AuthID, ClientID, Email, Password) VALUES (?, ?, ?, ?)");
    if (!$loginInsertion) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $loginInsertion->bind_param("ssss", $AuthID, $clientID, $email, $password);
    if (!$loginInsertion->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create login: ' . $loginInsertion->error]);
        exit;
    }

    $noAddress = $_POST['noAddress'] ?? true;

    // Address
    if ($noAddress == false) {
        // Generate unique AddressID
        $AddressID = bin2hex(random_bytes(8));
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
        $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(AddressID, ClientID, Street1, Street2, City, State, ZIP) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $addressInsertion->bind_param("sssssss", $AddressID, $clientID, $address1, $address2, $city, $state, $zipCode);
        $addressInsertion->execute();
    }

    $noEmergencyContact = $_POST['noEmergencyContact'] ?? true;

    // Emergency contact
    if (!$noEmergencyContact) {
        // Generate unique ContactID
        $ContactID = bin2hex(random_bytes(8));
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
        $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ContactID, ClientID, Name, Phone) VALUES (?, ?, ?, ?)");
        $emergencyContactInsertion->bind_param("ssss", $ContactID, $clientID, $emergencyFullName, $emergencyPhone);
        $emergencyContactInsertion->execute();
    }

    /// Insert selected services into tblVisitServiceSelections
    $EventID = $_POST['EventID'] ?? null; 
    $services = $_POST['services'] ?? [];

    if (!$EventID) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'EventID is required.']);
        exit;
    }

    if (empty($services) || !is_array($services)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'At least one service must be selected.']);
        exit;
    }

    // Check if EventID exists
    $eventCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblEvents WHERE EventID = ?");
    $eventCheck->bind_param("s", $EventID);
    $eventCheck->execute();
    $eventCheck->bind_result($eventCount);
    $eventCheck->fetch();
    $eventCheck->close();

    if ($eventCount == 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'EventID does not exist.']);
        exit;
    }

    // Check if each ServiceID is valid
    foreach ($services as $service) {
        $serviceCheck = $mysqli->prepare("SELECT COUNT(*) FROM tblServices WHERE ServiceID = ?");
        $serviceCheck->bind_param("s", $service);
        $serviceCheck->execute();
        $serviceCheck->bind_result($serviceCount);
        $serviceCheck->fetch();
        $serviceCheck->close();

        if ($serviceCount == 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => "ServiceID '$service' does not exist."]);
            exit;
        }
    }

    foreach ($services as $service) {
        $selectionID = bin2hex(random_bytes(8));
        $stmt = $mysqli->prepare("INSERT INTO tblVisitServiceSelections (SelectionID, ClientID, EventID, ServiceID, DateSelected) VALUES (?, ?, ?, ?, NOW())");
        $stmt->bind_param("ssss", $selectionID, $clientID, $EventID, $service);
        $stmt->execute();
    }

    http_response_code(201);
    $msg = json_encode(['success' => true, 'message' => 'New client created and services selected.']);
    echo $msg;
    error_log($msg);
}