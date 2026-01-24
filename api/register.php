<?php
/**
 * ============================================================================
 * CLIENT REGISTRATION API
 * ============================================================================
 * 
 * This file handles new client registrations from the registration form.
 * It receives JSON data from register.js and inserts it into multiple
 * database tables according to the normalized schema.
 * 
 * TABLES AFFECTED:
 * ----------------
 * 1. tblClients           - Main client info (name, DOB, sex)
 * 2. tblClientLogin       - Email and password for authentication
 * 3. tblClientPhone       - Client's phone number
 * 4. tblClientAddress     - Client's address (if provided)
 * 5. tblClientEmergencyContacts - Emergency contact (if provided)
 * 6. tblClientRegistrations     - Service selections and waiver info
 * 
 * DATA FLOW:
 * ----------
 * 1. Receive JSON from JavaScript fetch()
 * 2. Generate unique ClientID (UUID)
 * 3. Insert into each table using the same ClientID
 * 4. Return success/error response as JSON
 * 
 * @author DUO Mission Team
 */


/* ==========================================================================
   SETUP & CONFIGURATION
   ========================================================================== */

// Tell the browser we're returning JSON
header('Content-Type: application/json');

// Allow cross-origin requests (needed if frontend is on different domain)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Include the database connection file
// This gives us access to the $pdo variable for database queries
require_once 'db.php';


/* ==========================================================================
   HELPER FUNCTIONS
   ========================================================================== */

/**
 * Generates a unique ID (UUID v4 format)
 * Used for all primary keys in the database
 * 
 * @return string A unique 36-character UUID like "550e8400-e29b-41d4-a716-446655440000"
 */
function generateUUID() {
    // Generate 16 random bytes
    $data = random_bytes(16);
    
    // Set version to 0100 (UUID version 4)
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    
    // Set bits 6-7 to 10 (UUID variant)
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    
    // Format as UUID string
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Cleans phone number to just 10 digits
 * Removes formatting like (123) 456-7890 -> 1234567890
 * 
 * @param string $phone The formatted phone number
 * @return string Just the 10 digits
 */
function cleanPhoneNumber($phone) {
    // Remove everything except numbers
    return preg_replace('/[^0-9]/', '', $phone);
}

/**
 * Sends a JSON error response and stops execution
 * 
 * @param string $message The error message to send
 */
function sendError($message) {
    echo json_encode([
        'success' => false,
        'message' => $message
    ]);
    exit;
}

/**
 * Sends a JSON success response and stops execution
 * 
 * @param string $message The success message to send
 */
function sendSuccess($message) {
    echo json_encode([
        'success' => true,
        'message' => $message
    ]);
    exit;
}


/* ==========================================================================
   RECEIVE AND VALIDATE INPUT
   ========================================================================== */

// Get the raw JSON data sent from JavaScript
$jsonInput = file_get_contents('php://input');

// Convert JSON string into a PHP array
// The 'true' parameter makes it an array instead of an object
$data = json_decode($jsonInput, true);

// Check if we received valid data
if (!$data) {
    sendError('No data received or invalid JSON format.');
}

// Check for required fields (email and password are minimum required)
if (empty($data['email'])) {
    sendError('Email is required.');
}

if (empty($data['password'])) {
    sendError('Password is required.');
}


/* ==========================================================================
   PREPARE DATA FOR DATABASE
   ========================================================================== */

// Generate a unique ID for this new client
// This ID will be used in ALL tables to link the data together
$clientID = generateUUID();

// Hash the password for security
// NEVER store plain text passwords!
$hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);

// Get current date for DateCreated field
$currentDate = date('Y-m-d');

// Check the checkbox states sent from JavaScript
$hasAddress = !empty($data['noAddress']) ? false : true;
$hasEmergencyContact = !empty($data['noEmergencyContact']) ? false : true;


/* ==========================================================================
   DATABASE INSERTION (Using Transaction)
   ========================================================================== */

// A transaction ensures ALL inserts succeed or NONE of them do
// This prevents partial data if something fails halfway through

try {
    // Start the transaction
    $pdo->beginTransaction();
    
    
    /* ----------------------------------------------------------------------
       INSERT 1: tblClients (Main Client Record)
       ---------------------------------------------------------------------- */
    
    $sqlClient = "INSERT INTO tblClients (
        ClientID,
        FirstName,
        MiddleName,
        LastName,
        DateCreated,
        DOB,
        Sex
    ) VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    $stmtClient = $pdo->prepare($sqlClient);
    $stmtClient->execute([
        $clientID,                          // ClientID (our generated UUID)
        $data['firstName'] ?? '',           // FirstName
        $data['middleInitial'] ?? '',       // MiddleName (just the initial)
        $data['lastName'] ?? '',            // LastName
        $currentDate,                       // DateCreated (today)
        $data['dob'] ?? '',                 // DOB (date of birth)
        $data['sex'] ?? ''                  // Sex (male/female/intersex)
    ]);
    
    
    /* ----------------------------------------------------------------------
       INSERT 2: tblClientLogin (Email & Password)
       ---------------------------------------------------------------------- */
    
    $loginID = generateUUID();  // Each table needs its own unique ID
    
    $sqlLogin = "INSERT INTO tblClientLogin (
        Login_ID,
        ClientID,
        Email,
        Password
    ) VALUES (?, ?, ?, ?)";
    
    $stmtLogin = $pdo->prepare($sqlLogin);
    $stmtLogin->execute([
        $loginID,                           // Login_ID (unique for this table)
        $clientID,                          // ClientID (links to tblClients)
        $data['email'],                     // Email
        $hashedPassword                     // Password (hashed for security)
    ]);
    
    
    /* ----------------------------------------------------------------------
       INSERT 3: tblClientPhone (Phone Number)
       Only insert if a phone number was provided
       ---------------------------------------------------------------------- */
    
    if (!empty($data['phone'])) {
        $phoneID = generateUUID();
        $cleanPhone = cleanPhoneNumber($data['phone']);
        
        $sqlPhone = "INSERT INTO tblClientPhone (
            PhoneID,
            ClientID,
            Phone,
            Type,
            Status
        ) VALUES (?, ?, ?, ?, ?)";
        
        $stmtPhone = $pdo->prepare($sqlPhone);
        $stmtPhone->execute([
            $phoneID,                       // PhoneID
            $clientID,                      // ClientID (links to tblClients)
            $cleanPhone,                    // Phone (10 digits only)
            'Primary',                      // Type (Primary phone)
            'Active'                        // Status
        ]);
    }
    
    
    /* ----------------------------------------------------------------------
       INSERT 4: tblClientAddress (Address Information)
       Only insert if user has an address (checkbox was NOT checked)
       ---------------------------------------------------------------------- */
    
    if ($hasAddress && !empty($data['address1'])) {
        $addressID = generateUUID();
        
        $sqlAddress = "INSERT INTO tblClientAddress (
            AddressID,
            ClientID,
            Street1,
            Street2,
            City,
            County,
            State,
            ZIP,
            Status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmtAddress = $pdo->prepare($sqlAddress);
        $stmtAddress->execute([
            $addressID,                     // AddressID
            $clientID,                      // ClientID (links to tblClients)
            $data['address1'] ?? '',        // Street1
            $data['address2'] ?? '',        // Street2 (apt, suite, etc.)
            $data['city'] ?? '',            // City
            '',                             // County (not collected in form)
            $data['state'] ?? '',           // State (2-letter code like TX)
            $data['zipCode'] ?? '',         // ZIP (5 digits)
            'Active'                        // Status
        ]);
    }
    
    
    /* ----------------------------------------------------------------------
       INSERT 5: tblClientEmergencyContacts (Emergency Contact)
       Only insert if user has an emergency contact (checkbox was NOT checked)
       ---------------------------------------------------------------------- */
    
    if ($hasEmergencyContact && !empty($data['emergencyFirstName'])) {
        $contactID = generateUUID();
        
        // Combine first and last name for the Name field
        $emergencyName = trim($data['emergencyFirstName'] . ' ' . $data['emergencyLastName']);
        $emergencyPhone = cleanPhoneNumber($data['emergencyPhone'] ?? '');
        
        $sqlEmergency = "INSERT INTO tblClientEmergencyContacts (
            ContactID,
            ClientID,
            Name,
            Phone,
            Status
        ) VALUES (?, ?, ?, ?, ?)";
        
        $stmtEmergency = $pdo->prepare($sqlEmergency);
        $stmtEmergency->execute([
            $contactID,                     // ContactID
            $clientID,                      // ClientID (links to tblClients)
            $emergencyName,                 // Name (first + last combined)
            $emergencyPhone,                // Phone (10 digits)
            'Active'                        // Status
        ]);
    }
    
    
    /* ----------------------------------------------------------------------
       INSERT 6: tblClientRegistrations (Services & Waiver)
       Records which services the client signed up for
       ---------------------------------------------------------------------- */
    
    $registrationID = generateUUID();
    $waiverID = generateUUID();
    
    // Get selected services (array like ['medical', 'dental'])
    $services = $data['services'] ?? [];
    
    $sqlRegistration = "INSERT INTO tblClientRegistrations (
        RegistrationID,
        ClientID,
        DateTime,
        Medical,
        Optical,
        Dental,
        Hair,
        Signature,
        WaiverDate,
        WavierID
    ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)";
    
    $stmtRegistration = $pdo->prepare($sqlRegistration);
    $stmtRegistration->execute([
        $registrationID,                            // RegistrationID
        $clientID,                                  // ClientID (links to tblClients)
        // DateTime is set by NOW()
        in_array('medical', $services) ? 1 : 0,     // Medical (true/false)
        in_array('optical', $services) ? 1 : 0,     // Optical (true/false)
        in_array('dental', $services) ? 1 : 0,      // Dental (true/false)
        in_array('haircut', $services) ? 1 : 0,     // Hair (true/false)
        '',                                         // Signature (not collected yet)
        $currentDate,                               // WaiverDate
        $waiverID                                   // WavierID (links to tblWaiver)
    ]);
    
    
    /* ----------------------------------------------------------------------
       COMMIT THE TRANSACTION
       If we got here, all inserts were successful!
       ---------------------------------------------------------------------- */
    
    $pdo->commit();
    
    // Send success response back to JavaScript
    sendSuccess('Registration successful! You can now log in.');
    
    
} catch (PDOException $e) {
    /* ----------------------------------------------------------------------
       HANDLE ERRORS
       If anything failed, rollback ALL changes
       ---------------------------------------------------------------------- */
    
    // Undo any changes that were made
    $pdo->rollBack();
    
    // Log the actual error for debugging (check your PHP error log)
    error_log('Registration Error: ' . $e->getMessage());
    
    // Check for duplicate email error
    if ($e->getCode() == 23000) {
        sendError('This email is already registered. Please use a different email or log in.');
    }
    
    // Send generic error to user (don't expose database details)
    sendError('Registration failed. Please try again later.');
}
?>
