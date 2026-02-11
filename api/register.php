<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Set active status?
$status = "Active";

// Check if clientId was passed (existing user)
$clientID = $_POST['clientId'] ?? null;

// Get language preference, default to English if not provided
$language = $_POST['language'] ?? 'en';

if ($clientID) {
    // ============================================================================
    // EXISTING USER - UPDATE
    // ============================================================================
    
    $firstName = $_POST['firstName'] ?? null;
    $middleInitial = isset($_POST['middleInitial']) && $_POST['middleInitial'] !== '' ? $_POST['middleInitial'] : null;
    $lastName = $_POST['lastName'] ?? null;
    $dob = $_POST['dob'] ?? null;
    $sex = $_POST['sex'] ?? null;
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Update client info
    $clientUpdate = $mysqli->prepare("UPDATE tblClients SET FirstName = ?, MiddleInitial = ?, LastName = ?, DOB = ?, Sex = ?, Phone = ?, Lang = ? WHERE ClientID = ?");
    $clientUpdate->bind_param("ssssssss", $firstName, $middleInitial, $lastName, $dob, $sex, $phone, $language, $clientID);
    $clientUpdate->execute();

    $noAddress = $_POST['noAddress'] ?? true;

    // If client has address
    if ($noAddress == false) {
        $address1 = $_POST['address1'];
        $address2 = $_POST['address2'] ?? null;
        $city = $_POST['city'];
        $state = $_POST['state'];
        $zipCode = $_POST['zipCode'];

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

    // If client has emergency contact
    if (!$noEmergencyContact) {
        $emergencyFirstName = $_POST['emergencyFirstName'];
        $emergencyLastName = $_POST['emergencyLastName'];
        $emergencyPhone = $_POST['emergencyPhone'];
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

    // Get current date + time
    $currentDateTime = date('Y-m-d H:i:s');
    $services = $_POST['services'] ?? [];
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental  = in_array('dental', $services) ? 1 : 0;
    $hasHair    = in_array('haircut', $services) ? 1 : 0;

    // Update existing registration
    $servicesUpdate = $mysqli->prepare("UPDATE tblClientRegistrations SET DateTime = ?, Medical = ?, Optical = ?, Dental = ?, Hair = ? WHERE ClientID = ?");
    $servicesUpdate->bind_param("siiiis", $currentDateTime, $hasMedical, $hasOptical, $hasDental, $hasHair, $clientID);
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
    // ============================================================================
    // NEW USER - INSERT
    // ============================================================================
    
    // Generate a unique clientID
    $clientID = bin2hex(random_bytes(8));
    $firstName = $_POST['firstName'] ?? null;
    $middleInitial = isset($_POST['middleInitial']) && $_POST['middleInitial'] !== '' ? $_POST['middleInitial'] : null;
    $lastName = $_POST['lastName'] ?? null;
    // Get current date
    $dateCreated = date('Y-m-d');
    $dob = $_POST['dob'] ?? null;
    $sex = $_POST['sex'] ?? null;
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Prepare client info
    $clientCreation = $mysqli->prepare("INSERT INTO tblClients(ClientID, FirstName, MiddleInitial, LastName, DateCreated, DOB, Sex, Phone, Lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $clientCreation->bind_param("sssssssss", $clientID, $firstName, $middleInitial, $lastName, $dateCreated, $dob, $sex, $phone, $language);
    // Execute the statement
    $clientCreation->execute();

    $email = $_POST['email'] ?? null;
    // Hash the password using bcrypt
    $password = isset($_POST['password']) ? password_hash($_POST['password'], PASSWORD_BCRYPT) : null;

    // Prepare client login info
    $loginInsertion = $mysqli->prepare("INSERT INTO tblClientLogin(ClientID, Email, Password) VALUES (?, ?, ?)");
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

        // Prepare client address
        $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(Street1, Street2, City, State, ZIP, Status, ClientID) VALUES (?, ?, ?, ?, ?, ?, ?)");

        // Bind the variables to the placeholders
        // "s" means string, "d" means double (float or number)
        $addressInsertion->bind_param("sssssss", $address1, $address2, $city, $state, $zipCode, $status, $clientID);

        // Execute the statement
        $addressInsertion->execute();
    }

    $noEmergencyContact = $_POST['noEmergencyContact'] ?? true;

    // If client has emergency contact
    if (!$noEmergencyContact) {
        $emergencyFirstName = $_POST['emergencyFirstName'];
        $emergencyLastName = $_POST['emergencyLastName'];
        $emergencyPhone = $_POST['emergencyPhone'];

        // String together first & last name
        $emergencyFullName = $emergencyFirstName . " " . $emergencyLastName;

        // Prepare client emergency contact
        $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ClientID, Name, Phone, Status) VALUES (?, ?, ?, ?)");

        // Bind the variables to the placeholders
        $emergencyContactInsertion->bind_param("ssss", $clientID, $emergencyFullName, $emergencyPhone, $status);

        // Execute the statement
        $emergencyContactInsertion->execute();
    }

    // Get current date + time
    $currentDateTime = date('Y-m-d H:i:s');
    $services = $_POST['services'] ?? [];
    // Check services array - cast to int for database
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental  = in_array('dental', $services) ? 1 : 0;
    $hasHair    = in_array('haircut', $services) ? 1 : 0;

    // Prepare client services
    $servicesInsertion = $mysqli->prepare("INSERT INTO tblClientRegistrations(ClientID, DateTime, Medical, Optical, Dental, Hair) VALUES (?, ?, ?, ?, ?, ?)");

    // Bind the variables to the placeholders (use "i" for integers)
    $servicesInsertion->bind_param("ssiiii", $clientID, $currentDateTime, $hasMedical, $hasOptical, $hasDental, $hasHair);

    // Execute the statement 
    $result = $servicesInsertion->execute();

    if ($result) {
        http_response_code(201); // Created
        $msg = json_encode(['success' => true, 'message' => 'New client created.']);
        echo $msg;
        error_log($msg); 
    } else {
        http_response_code(400); // Bad Request
        $msg = json_encode(['success' => false, 'message' => 'Insert failed']);
        echo $msg;
        error_log($msg); 
    }
}