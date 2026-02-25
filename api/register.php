<?php
/**
 * ============================================================
 *  File:        Register.php
 *  Purpose:     Handles client registration. Supports both
 *               new user creation and existing user updates
 *               including address, emergency contacts, and
 *               service selections.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:46 PM
 *  Changes Made:      Code cleanup
 * ============================================================
*/

// Set content-type and default timezone
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

// Check if existing user or new user
$clientID = $_POST['clientID'] ?? null;

if ($clientID) {
    $mysqli->begin_transaction();
    // EXISTING USER - UPDATE
    
    $firstName = isset($_POST['firstName']) ? ucfirst(strtolower(trim($_POST['firstName']))) : null;
    $middleInitial = isset($_POST['middleInitial']) && $_POST['middleInitial'] !== '' ? strtoupper(trim($_POST['middleInitial'])) : null;
    $lastName = isset($_POST['lastName']) ? ucfirst(strtolower(trim($_POST['lastName']))) : null;
    $dob = $_POST['dob'] ?? null;
    $sex = strtolower(trim($_POST['sex']));
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Update client info
    $clientUpdate = $mysqli->prepare("UPDATE tblClients SET FirstName = ?, MiddleInitial = ?, LastName = ?, DOB = ?, Sex = ?, Phone = ? WHERE ClientID = ?");
    if (!$clientUpdate) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $clientUpdate->bind_param("sssssss", $firstName, $middleInitial, $lastName, $dob, $sex, $phone, $clientID);
    if (!$clientUpdate->execute()) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update client: ' . $clientUpdate->error]);
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

        // Check if address exists
        $checkAddress = $mysqli->prepare("SELECT ClientID FROM tblClientAddress WHERE ClientID = ?");
        $checkAddress->bind_param("s", $clientID);
        $checkAddress->execute();
        $addressResult = $checkAddress->get_result();

        if ($addressResult->num_rows > 0) {
            // Update existing address
            $addressUpdate = $mysqli->prepare("UPDATE tblClientAddress SET Street1 = ?, Street2 = ?, City = ?, State = ?, ZIP = ? WHERE ClientID = ?");
            if (!$addressUpdate) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
                exit;
            }
            $addressUpdate->bind_param("ssssss", $address1, $address2, $city, $state, $zipCode, $clientID);
            if (!$addressUpdate->execute()) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update address: ' . $addressUpdate->error]);
                exit;
            }
        } else {
            // Insert new address
            // Generate unique AddressID
            $AddressID = bin2hex(random_bytes(8));
            $addressInsertion = $mysqli->prepare("INSERT INTO tblClientAddress(AddressID, ClientID, Street1, Street2, City, State, ZIP) VALUES (?, ?, ?, ?, ?, ?, ?)");
            if (!$addressInsertion) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
                exit;
            }
            $addressInsertion->bind_param("sssssss", $AddressID, $clientID, $address1, $address2, $city, $state, $zipCode);
            if (!$addressInsertion->execute()) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to insert address: ' . $addressInsertion->error]);
                exit;
            }
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
            if (!$emergencyUpdate) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
                exit;
            }
            $emergencyUpdate->bind_param("sss", $emergencyFullName, $emergencyPhone, $clientID);
            if (!$emergencyUpdate->execute()) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update emergency contact: ' . $emergencyUpdate->error]);
                exit;
            }
        } else {
            // Insert new emergency contact
            // Generate unique ContactID
            $ContactID = bin2hex(random_bytes(8));
            $emergencyContactInsertion = $mysqli->prepare("INSERT INTO tblClientEmergencyContacts(ContactID, ClientID, Name, Phone) VALUES (?, ?, ?, ?)");
            if (!$emergencyContactInsertion) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
                exit;
            }
            $emergencyContactInsertion->bind_param("ssss", $ContactID, $clientID, $emergencyFullName, $emergencyPhone);
            if (!$emergencyContactInsertion->execute()) {
                $mysqli->rollback();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to insert emergency contact: ' . $emergencyContactInsertion->error]);
                exit;
            }
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

    // Remove previous selections for this client/event
    $deleteOld = $mysqli->prepare("DELETE FROM tblVisitServiceSelections WHERE ClientID = ? AND EventID = ?");
    if (!$deleteOld) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $deleteOld->bind_param("ss", $clientID, $EventID);
    if (!$deleteOld->execute()) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to clear previous service selections: ' . $deleteOld->error]);
        exit;
    }

    // Insert new selections
    foreach ($services as $service) {
        $selectionID = bin2hex(random_bytes(8));
        $stmt = $mysqli->prepare("INSERT INTO tblVisitServiceSelections (SelectionID, ClientID, EventID, ServiceID, DateSelected) VALUES (?, ?, ?, ?, NOW())");
        if (!$stmt) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
            exit;
        }
        $stmt->bind_param("ssss", $selectionID, $clientID, $EventID, $service);
        if (!$stmt->execute()) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to insert service selection: ' . $stmt->error]);
            exit;
        }
    }

    // Insert/Update visit record to put client in registration queue
    $checkVisit = $mysqli->prepare("SELECT VisitID FROM tblVisits WHERE ClientID = ? AND EventID = ?");
    $checkVisit->bind_param("ss", $clientID, $EventID);
    $checkVisit->execute();
    $visitResult = $checkVisit->get_result();

    if ($visitResult->num_rows > 0) {
        // Visit already exists — update status back to Registered
        $existingVisit = $visitResult->fetch_assoc();
        $existingVisitID = $existingVisit['VisitID'];
        $visitUpdate = $mysqli->prepare("UPDATE tblVisits SET RegistrationStatus = 'Registered' WHERE VisitID = ?");
        if ($visitUpdate) {
            $visitUpdate->bind_param("s", $existingVisitID);
            $visitUpdate->execute();
        }
    } else {
        // No visit record yet — insert one
        $visitID = bin2hex(random_bytes(8));
        $registrationStatus = 'Registered';
        $checkInTime = null;
        $qrCodeData = null;
        $visitInsert = $mysqli->prepare("INSERT INTO tblVisits (VisitID, ClientID, EventID, RegistrationStatus, CheckInTime, QR_Code_Data) VALUES (?, ?, ?, ?, ?, ?)");
        if ($visitInsert) {
            $visitInsert->bind_param("ssssss", $visitID, $clientID, $EventID, $registrationStatus, $checkInTime, $qrCodeData);
            $visitInsert->execute();
        }
    }

    $mysqli->commit();
    http_response_code(200);
    $msg = json_encode(['success' => true, 'message' => 'Information and services updated successfully.']);
    echo $msg;
    error_log($msg);

} else {
    // NEW USER - INSERT

    $isNewUser = empty($_POST['clientID']);
    $required = ['firstName', 'lastName', 'dob', 'sex'];
    if ($isNewUser) {
        $required[] = 'email';
        $required[] = 'password';
    }
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

    // Validate sex value (case-insensitive)
    $validSex = ['male', 'female', 'intersex'];
    if (!in_array(strtolower($_POST['sex']), $validSex)) {
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
    $sex = strtolower(trim($_POST['sex']));
    $phone = isset($_POST['phone']) && $_POST['phone'] !== '' ? $_POST['phone'] : null;

    // Insert client
    $mysqli->begin_transaction();
    $clientCreation = $mysqli->prepare("INSERT INTO tblClients(ClientID, FirstName, MiddleInitial, LastName, DOB, Sex, Phone, DateCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$clientCreation) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $clientCreation->bind_param("ssssssss", $clientID, $firstName, $middleInitial, $lastName, $dob, $sex, $phone, $dateCreated);
    if (!$clientCreation->execute()) {
        $mysqli->rollback();
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
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
        exit;
    }
    $loginInsertion->bind_param("ssss", $AuthID, $clientID, $email, $password);
    if (!$loginInsertion->execute()) {
        $mysqli->rollback();
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
        if (!$addressInsertion) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
            exit;
        }
        $addressInsertion->bind_param("sssssss", $AddressID, $clientID, $address1, $address2, $city, $state, $zipCode);
        if (!$addressInsertion->execute()) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to insert address: ' . $addressInsertion->error]);
            exit;
        }
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
        if (!$emergencyContactInsertion) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
            exit;
        }
        $emergencyContactInsertion->bind_param("ssss", $ContactID, $clientID, $emergencyFullName, $emergencyPhone);
        if (!$emergencyContactInsertion->execute()) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to insert emergency contact: ' . $emergencyContactInsertion->error]);
            exit;
        }
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
        if (!$stmt) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $mysqli->error]);
            exit;
        }
        $stmt->bind_param("ssss", $selectionID, $clientID, $EventID, $service);
        if (!$stmt->execute()) {
            $mysqli->rollback();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to insert service selection: ' . $stmt->error]);
            exit;
        }
    }

    // Insert visit record to put client in registration queue
    $visitID = bin2hex(random_bytes(8));
    $registrationStatus = 'Registered';
    $FirstCheckedIn = null;
    $qrCodeData = null;
    $visitInsert = $mysqli->prepare("INSERT INTO tblVisits (VisitID, ClientID, EventID, RegistrationStatus, FirstCheckedIn, QR_Code_Data) VALUES (?, ?, ?, ?, ?, ?)");
    if ($visitInsert) {
        $visitInsert->bind_param("ssssss", $visitID, $clientID, $EventID, $registrationStatus, $FirstCheckedIn, $qrCodeData);
        $visitInsert->execute();
    }

    $mysqli->commit();
    http_response_code(201);
    $msg = json_encode(['success' => true, 'message' => 'New client created and services selected.']);
    echo $msg;
    error_log($msg);
}