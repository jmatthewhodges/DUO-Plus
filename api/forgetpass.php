<?php
/**
 * ============================================================
 *  File:        ForgetPass.php
 *  Purpose:     Backend of forgetpass.html, handles password reset functionality
 *
 *  Last Modified By:  Lauren
 *  Last Modified On:  March 3 @ 
 *  Changes Made:      Created file.
 * ============================================================
*/

// Set content-type
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
    echo json_encode(['success' => false, 'message' => 'Invalid JSON.']);
    exit;
}

// Validate required fields
$action = isset($_POST['action']) ? trim($_POST['action']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$dob = isset($_POST['dob']) ? trim($_POST['dob']) : '';
$password = $_POST['password'] ?? '';

if (!$action || !$email || !$dob) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and date of birth are required.']);
    exit;
}

if (!in_array($action, ['verify', 'reset'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
    exit;
}

$dateObj = date_create($dob);
if (!$dateObj) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid date of birth format.']);
    exit;
}
$dobNormalized = date_format($dateObj, 'Y-m-d');

if ($action === 'reset' && !preg_match('/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\S{8,}$/', $password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password does not meet requirements.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'] ?? null;

if (!$mysqli) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

// Check login credentials in tblClientAuth
$clientLookup = $mysqli->prepare(
    "SELECT a.ClientID
     FROM tblClientAuth a
     INNER JOIN tblClients c ON a.ClientID = c.ClientID
     WHERE LOWER(a.Email) = LOWER(?) AND DATE(c.DOB) = ?"
);
$clientLookup->bind_param('ss', $email, $dobNormalized);
$clientLookup->execute();
$result = $clientLookup->get_result();
$row = $result->fetch_assoc();
$clientLookup->close();

if (!$row || empty($row['ClientID'])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Account not found.']);
    exit;
}

if ($action === 'verify') {
    echo json_encode(['success' => true, 'message' => 'Account verified.']);
    exit;
}

$clientID = $row['ClientID'];
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

$updatePassword = $mysqli->prepare('UPDATE tblClientAuth SET Password = ? WHERE ClientID = ?');
$updatePassword->bind_param('ss', $passwordHash, $clientID);
$updatePassword->execute();
$updatePassword->close();

echo json_encode(['success' => true, 'message' => 'Password reset successful.']);
