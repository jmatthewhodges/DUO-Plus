<?php
/**
 * ============================================================================
 * DUO+ CLIENT REGISTRATION API
 * ============================================================================
 * 
 * Handles client registration and stores data across normalized database tables.
 * 
 * ENDPOINT: POST /api/register.php
 * 
 * REQUEST BODY (JSON):
 *   - email           (required) Client's email address
 *   - password_hash   (required) SHA-256 hashed password from frontend
 *   - first_name      (required) Client's first name
 *   - last_name       (required) Client's last name
 *   - sex             (required) Client's sex (male/female/other)
 *   - dob             (required) Date of birth (MM/DD/YYYY format)
 *   - middle_initial  (optional) Middle initial
 *   - phone           (optional) Phone number
 *   - no_address      (optional) Boolean - client has no permanent address
 *   - street_address  (optional) Street address line 1
 *   - street_address2 (optional) Street address line 2
 *   - city            (optional) City
 *   - state           (optional) State code (e.g., "TN")
 *   - zip             (optional) 5-digit ZIP code
 *   - no_emergency_contact (optional) Boolean - no emergency contact
 *   - emergency_first_name (optional) Emergency contact first name
 *   - emergency_last_name  (optional) Emergency contact last name
 *   - emergency_phone      (optional) Emergency contact phone
 *   - services        (optional) Array of services: medical, dental, optical, haircut
 *   - dental_type     (optional) Dental type: hygiene or extraction
 *   - signature       (optional) Base64-encoded signature image
 * 
 * RESPONSE (JSON):
 *   Success: { success: true, message: "...", client_id: "UUID" }
 *   Error:   { success: false, message: "..." }
 * 
 * DATABASE TABLES AFFECTED:
 *   - tblClients
 *   - tblClientLogin
 *   - tblClientAddress (if address provided)
 *   - tblClientPhone (if phone provided)
 *   - tblClientEmergencyContacts (if emergency contact provided)
 *   - tblWaiver
 *   - tblClientRegistrations
 * 
 * @author DUO+ Development Team
 * @version 2.0.0
 */

declare(strict_types=1);


// ============================================================================
// CORS & HTTP HEADERS
// ============================================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
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


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a RFC 4122 compliant UUID v4
 * 
 * @return string UUID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID(): string
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Sanitize a string input for safe storage
 * 
 * @param string|null $value The input value
 * @return string|null Sanitized value or null if empty
 */
function sanitizeString(?string $value): ?string
{
    if (empty($value)) {
        return null;
    }
    return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
}

/**
 * Extract digits only from phone number
 * 
 * @param string|null $phone Raw phone input
 * @return string|null 10-digit phone or null
 */
function sanitizePhone(?string $phone): ?string
{
    if (empty($phone)) {
        return null;
    }
    $digits = preg_replace('/\D/', '', $phone);
    return strlen($digits) === 10 ? $digits : null;
}

/**
 * Send JSON response and exit
 * 
 * @param bool $success Success status
 * @param string $message Response message
 * @param array $data Additional data to include
 * @param int $httpCode HTTP status code
 */
function sendResponse(bool $success, string $message, array $data = [], int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit();
}


// ============================================================================
// MAIN REGISTRATION LOGIC
// ============================================================================

try {
    // -------------------------------------------------------------------------
    // Database Connection
    // -------------------------------------------------------------------------
    
    require_once 'db.php';

    // -------------------------------------------------------------------------
    // Parse & Validate Input
    // -------------------------------------------------------------------------
    
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        throw new Exception('Invalid JSON data received');
    }

    // Validate required fields
    $requiredFields = ['email', 'password_hash', 'first_name', 'last_name', 'sex', 'dob'];
    foreach ($requiredFields as $field) {
        if (empty($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }

    // -------------------------------------------------------------------------
    // Check for Duplicate Email (DISABLED - allowing duplicate emails)
    // -------------------------------------------------------------------------
    
    // $checkStmt = $pdo->prepare("SELECT Login_ID FROM tblClientLogin WHERE Email = ?");
    // $checkStmt->execute([$data['email']]);
    // 
    // if ($checkStmt->fetch()) {
    //     throw new Exception('An account with this email address already exists');
    // }

    // -------------------------------------------------------------------------
    // Begin Database Transaction
    // -------------------------------------------------------------------------
    
    $pdo->beginTransaction();

    // -------------------------------------------------------------------------
    // Generate UUIDs for All Records
    // -------------------------------------------------------------------------
    
    $clientID       = generateUUID();
    $addressID      = generateUUID();
    $phoneID        = generateUUID();
    $contactID      = generateUUID();
    $registrationID = generateUUID();
    $waiverID       = generateUUID();

    // -------------------------------------------------------------------------
    // Sanitize Input Data
    // -------------------------------------------------------------------------
    
    $email        = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
    $passwordHash = $data['password_hash'];
    $firstName    = sanitizeString($data['first_name']);
    $middleName   = sanitizeString($data['middle_initial'] ?? null);
    $lastName     = sanitizeString($data['last_name']);
    $sex          = sanitizeString($data['sex']);
    $dob          = $data['dob']; // Keep as MM/DD/YYYY to match schema (VARCHAR)

    // -------------------------------------------------------------------------
    // 1. Insert Client Record
    // -------------------------------------------------------------------------
    
    $stmt = $pdo->prepare("
        INSERT INTO tblClients (ClientID, FirstName, MiddleName, LastName, DateCreated, DOB, Sex)
        VALUES (?, ?, ?, ?, CURDATE(), ?, ?)
    ");
    $stmt->execute([$clientID, $firstName, $middleName, $lastName, $dob, $sex]);

    // -------------------------------------------------------------------------
    // 2. Insert Login Credentials
    // -------------------------------------------------------------------------
    
    $stmt = $pdo->prepare("
        INSERT INTO tblClientLogin (ClientID, Email, Password)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$clientID, $email, $passwordHash]);

    // -------------------------------------------------------------------------
    // 3. Insert Address (if provided)
    // -------------------------------------------------------------------------
    
    $noAddress = !empty($data['no_address']);
    
    if (!$noAddress && !empty($data['street_address'])) {
        $street1 = sanitizeString($data['street_address']);
        $street2 = sanitizeString($data['street_address2'] ?? null);
        $city    = sanitizeString($data['city'] ?? null);
        $state   = sanitizeString($data['state'] ?? null);
        $zip     = sanitizeString($data['zip'] ?? null);

        $stmt = $pdo->prepare("
            INSERT INTO tblClientAddress (AddressID, ClientID, Street1, Street2, City, State, ZIP, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
        ");
        $stmt->execute([$addressID, $clientID, $street1, $street2, $city, $state, $zip]);
    }

    // -------------------------------------------------------------------------
    // 4. Insert Phone Number (if provided)
    // -------------------------------------------------------------------------
    
    $phone = sanitizePhone($data['phone'] ?? null);
    
    if ($phone) {
        $stmt = $pdo->prepare("
            INSERT INTO tblClientPhone (PhoneID, ClientID, Phone, Type, Status)
            VALUES (?, ?, ?, 'Primary', 'Active')
        ");
        $stmt->execute([$phoneID, $clientID, $phone]);
    }

    // -------------------------------------------------------------------------
    // 5. Insert Emergency Contact (if provided)
    // -------------------------------------------------------------------------
    
    $noEmergencyContact = !empty($data['no_emergency_contact']);
    
    if (!$noEmergencyContact && !empty($data['emergency_first_name'])) {
        // Build full name
        $emergencyName = sanitizeString($data['emergency_first_name']);
        if (!empty($data['emergency_last_name'])) {
            $emergencyName .= ' ' . sanitizeString($data['emergency_last_name']);
        }
        
        $emergencyPhone = sanitizePhone($data['emergency_phone'] ?? null);

        $stmt = $pdo->prepare("
            INSERT INTO tblClientEmergencyContacts (ContactID, ClientID, Name, Phone, Status)
            VALUES (?, ?, ?, ?, 'Active')
        ");
        $stmt->execute([$contactID, $clientID, $emergencyName, $emergencyPhone]);
    }

    // -------------------------------------------------------------------------
    // 6. Insert Waiver Record
    // -------------------------------------------------------------------------
    
    $signature = $data['signature'] ?? null;
    
    $stmt = $pdo->prepare("
        INSERT INTO tblWaiver (WaiverID, Content)
        VALUES (?, ?)
    ");
    $stmt->execute([$waiverID, 'Client signed waiver during registration']);

    // -------------------------------------------------------------------------
    // 7. Insert Registration Record with Services
    // -------------------------------------------------------------------------
    
    $services   = $data['services'] ?? [];
    $hasMedical = in_array('medical', $services) ? 1 : 0;
    $hasOptical = in_array('optical', $services) ? 1 : 0;
    $hasDental  = in_array('dental', $services) ? 1 : 0;
    $hasHair    = in_array('haircut', $services) ? 1 : 0;
    $waiverDate = date('Y-m-d H:i:s');

    $stmt = $pdo->prepare("
        INSERT INTO tblClientRegistrations 
            (RegistrationID, ClientID, DateTime, Medical, Optical, Dental, Hair, Signature, WaiverDate, WavierID)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $registrationID,
        $clientID,
        $hasMedical,
        $hasOptical,
        $hasDental,
        $hasHair,
        $signature,
        $waiverDate,
        $waiverID
    ]);

    // -------------------------------------------------------------------------
    // Commit Transaction & Return Success
    // -------------------------------------------------------------------------
    
    $pdo->commit();

    sendResponse(true, 'Registration successful', ['client_id' => $clientID]);

} catch (Exception $e) {
    // -------------------------------------------------------------------------
    // Error Handling
    // -------------------------------------------------------------------------
    
    // Rollback transaction if in progress
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    // Log error for debugging
    error_log('Registration error: ' . $e->getMessage());
    
    // Return error response
    sendResponse(false, $e->getMessage(), [], 400);
}
