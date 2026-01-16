<?php
/**
 * Register API Endpoint
 * Handles client registration and stores data across normalized tables
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

/**
 * Generate a UUID v4
 */
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

try {
    // Include database connection
    require_once 'db.php';

    // Get JSON input
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        throw new Exception('Invalid JSON data received');
    }

    // Required fields validation
    $requiredFields = ['email', 'password_hash', 'first_name', 'last_name', 'sex', 'dob'];
    foreach ($requiredFields as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }

    // Check if email already exists
    $checkStmt = $pdo->prepare("SELECT Login_ID FROM tblClientLogin WHERE Email = ?");
    $checkStmt->execute([$data['email']]);
    if ($checkStmt->fetch()) {
        throw new Exception('An account with this email address already exists');
    }

    // Start transaction for data integrity
    $pdo->beginTransaction();

    // Generate UUIDs
    $clientID = generateUUID();
    $loginID = generateUUID();
    $addressID = generateUUID();
    $phoneID = generateUUID();
    $contactID = generateUUID();
    $registrationID = generateUUID();
    $waiverID = generateUUID();

    // Sanitize input data
    $email = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $passwordHash = $data['password_hash'];
    $firstName = htmlspecialchars(trim($data['first_name']), ENT_QUOTES, 'UTF-8');
    $middleName = !empty($data['middle_initial']) ? htmlspecialchars(trim($data['middle_initial']), ENT_QUOTES, 'UTF-8') : null;
    $lastName = htmlspecialchars(trim($data['last_name']), ENT_QUOTES, 'UTF-8');
    $sex = htmlspecialchars(trim($data['sex']), ENT_QUOTES, 'UTF-8');
    $dob = $data['dob']; // Keep as MM/DD/YYYY format to match schema (varchar)

    // 1. Insert into tblClients
    $stmt = $pdo->prepare("
        INSERT INTO tblClients (ClientID, FirstName, MiddleName, LastName, DateCreated, DOB, Sex)
        VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
    ");
    $stmt->execute([$clientID, $firstName, $middleName, $lastName, $dob, $sex]);

    // 2. Insert into tblClientLogin
    $stmt = $pdo->prepare("
        INSERT INTO tblClientLogin (Login_ID, ClientID, Email, Password)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$loginID, $clientID, $email, $passwordHash]);

    // 3. Insert into tblClientAddress (if not "no address")
    $noAddress = !empty($data['no_address']);
    if (!$noAddress && !empty($data['street_address'])) {
        $street1 = htmlspecialchars(trim($data['street_address']), ENT_QUOTES, 'UTF-8');
        $street2 = !empty($data['street_address2']) ? htmlspecialchars(trim($data['street_address2']), ENT_QUOTES, 'UTF-8') : null;
        $city = !empty($data['city']) ? htmlspecialchars(trim($data['city']), ENT_QUOTES, 'UTF-8') : null;
        $state = !empty($data['state']) ? htmlspecialchars(trim($data['state']), ENT_QUOTES, 'UTF-8') : null;
        $zip = !empty($data['zip']) ? htmlspecialchars(trim($data['zip']), ENT_QUOTES, 'UTF-8') : null;

        $stmt = $pdo->prepare("
            INSERT INTO tblClientAddress (AddressID, ClientID, Street1, Street2, City, State, ZIP, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
        ");
        $stmt->execute([$addressID, $clientID, $street1, $street2, $city, $state, $zip]);
    }

    // 4. Insert into tblClientPhone (if provided)
    if (!empty($data['phone'])) {
        $phone = preg_replace('/\D/', '', $data['phone']); // Remove non-digits
        if (strlen($phone) === 10) {
            $stmt = $pdo->prepare("
                INSERT INTO tblClientPhone (PhoneID, ClientID, Phone, Type, Status)
                VALUES (?, ?, ?, 'Primary', 'Active')
            ");
            $stmt->execute([$phoneID, $clientID, $phone]);
        }
    }

    // 5. Insert into tblClientEmergencyContacts (if not "no emergency contact")
    $noEmergencyContact = !empty($data['no_emergency_contact']);
    if (!$noEmergencyContact && !empty($data['emergency_first_name'])) {
        $emergencyName = htmlspecialchars(trim($data['emergency_first_name']), ENT_QUOTES, 'UTF-8');
        if (!empty($data['emergency_last_name'])) {
            $emergencyName .= ' ' . htmlspecialchars(trim($data['emergency_last_name']), ENT_QUOTES, 'UTF-8');
        }
        $emergencyPhone = !empty($data['emergency_phone']) ? preg_replace('/\D/', '', $data['emergency_phone']) : null;

        $stmt = $pdo->prepare("
            INSERT INTO tblClientEmergencyContacts (ContactID, ClientID, Name, Phone, Status)
            VALUES (?, ?, ?, ?, 'Active')
        ");
        $stmt->execute([$contactID, $clientID, $emergencyName, $emergencyPhone]);
    }

    // 6. Insert into tblWaiver first (required for foreign key)
    $signature = !empty($data['signature']) ? $data['signature'] : null;
    $stmt = $pdo->prepare("
        INSERT INTO tblWaiver (WaiverID, Content)
        VALUES (?, ?)
    ");
    $stmt->execute([$waiverID, 'Client signed waiver during registration']);

    // 7. Insert into tblClientRegistrations
    $services = !empty($data['services']) ? $data['services'] : [];
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental = in_array('dental', $services) ? 1 : 0;
    $hasHair = in_array('haircut', $services) ? 1 : 0;
    $waiverDate = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare("
        INSERT INTO tblClientRegistrations (RegistrationID, ClientID, DateTime, Medical, Optical, Dental, Hair, Signature, WaiverDate, WavierID)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$registrationID, $clientID, $hasMedical, $hasOptical, $hasDental, $hasHair, $signature, $waiverDate, $waiverID]);

    // Commit transaction
    $pdo->commit();

    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Registration successful',
        'client_id' => $clientID
    ]);

} catch (Exception $e) {
    // Rollback transaction on error
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    error_log('Registration error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
