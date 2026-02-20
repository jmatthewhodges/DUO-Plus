<?php
/**
 * ============================================================
 *  File:        login.php
 *  Description: Handles user authentication. Validates
 *               credentials against the database and returns
 *               client data on successful login.
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 19 @ 9:34 PM
 *  Changes Made:      Update for new DB
 * ============================================================
 */

header('Content-Type: application/json');

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

// Validate required fields
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = $_POST['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Check login credentials in tblClientAuth
$loginGrab = $mysqli->prepare("SELECT ClientID, Password FROM tblClientAuth WHERE Email = ?");
if (!$loginGrab) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error.']);
    exit;
}
$loginGrab->bind_param("s", $email);
$loginGrab->execute();
$loginGrab->bind_result($clientID, $hashedPassword);

if ($loginGrab->fetch() && password_verify($password, $hashedPassword)) {
    $loginGrab->close();
    http_response_code(200);

    // Get all client data from tblClients and related tables
    $registrationData = $mysqli->prepare("
        SELECT 
            c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DateCreated, c.DOB, c.Sex, c.Phone,
            c.TranslatorNeeded,
            a.Street1, a.Street2, a.City, a.State, a.ZIP,
            e.Name AS EmergencyName, e.Phone AS EmergencyPhone
        FROM tblClients c
        LEFT JOIN tblClientAddress a ON c.ClientID = a.ClientID
        LEFT JOIN tblClientEmergencyContacts e ON c.ClientID = e.ClientID
        WHERE c.ClientID = ?
    ");
    if (!$registrationData) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error.']);
        exit;
    }
    $registrationData->bind_param("s", $clientID);
    $registrationData->execute();
    $result = $registrationData->get_result();
    $userData = $result->fetch_assoc();

    $msg = json_encode(['success' => true, 'message' => 'Successful login.', 'data' => $userData]);
    echo $msg;
    error_log($msg);
} else {
    $loginGrab->close();
    http_response_code(401);
    $msg = json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    echo $msg;
    error_log($msg); 
}