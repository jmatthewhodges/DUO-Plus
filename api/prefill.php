<?php

// Database connection from other file
// Buffer output from db.php (it prints debug messages) so responses/redirects remain clean
ob_start();
require_once __DIR__ . '/db.php';
if (function_exists('ob_end_clean')) {
    @ob_end_clean();
}

// Ensure mysqli is available
$mysqli = isset($GLOBALS['mysqli']) ? $GLOBALS['mysqli'] : null;
if (!$mysqli) {
    http_response_code(500);
    echo "Database connection not available.";
    exit;
}

// Only accept GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo "Method not allowed.";
    exit;
}

// Check for email parameter
if (empty($_GET['email'])) {
    http_response_code(400);
    echo "Missing email parameter.";
    exit;
}

// validate email
$email = trim($_GET['email']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo "Invalid email format.";
    exit;
}

try {
    // 1) Find client ID Based on email
    $stmt = $mysqli->prepare("SELECT ClientID, Email, Password FROM tblClientLogin WHERE Email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $res = $stmt->get_result();
    $login = $res->fetch_assoc();

    // If no user found, return 404
    if (!$login) {
        http_response_code(404);
        echo "No user found for that email.";
        exit;
    }

    // Extract client ID
    $clientID = $login['ClientID'];

    // ALL INFO EXTRACTED USING CLIENT ID

    // 2) Get client basic info 
    $stmt = $mysqli->prepare("SELECT FirstName, MiddleName, LastName, DOB, Sex FROM tblClients WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $res = $stmt->get_result();
    $client = $res->fetch_assoc() ?: [];

    // 3) Get one phone if available
    $phone = null;
    $stmt = $mysqli->prepare("SELECT Phone FROM tblClientPhone WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) $phone = $row['Phone'];

    // 4) Get one address if available
    $address = [];
    $stmt = $mysqli->prepare("SELECT Street1, Street2, City, County, State, ZIP FROM tblClientAddress WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) $address = $row;

    // 5) Get one emergency contact if available
    $em = [];
    $stmt = $mysqli->prepare("SELECT Name, Phone FROM tblClientEmergencyContacts WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) $em = $row;

    // Normalize emergency name into first/last
    $emFirst = null; $emLast = null;
    if (!empty($em['Name'])) {
        $parts = preg_split('/\s+/', trim($em['Name']), 2);
        $emFirst = $parts[0] ?? null;
        $emLast = $parts[1] ?? null;
    }

    // pulling data together and set for output
    $out = [
        'Email' => $login['Email'],
        'Password' => $login['Password'] ?? null, 
        'FirstName' => $client['FirstName'] ?? null,
        'MiddleName' => $client['MiddleName'] ?? null,
        'LastName' => $client['LastName'] ?? null,
        'Sex' => $client['Sex'] ?? null,
        'DOB' => $client['DOB'] ?? null,
        'Phone' => $phone,
        'Street1' => $address['Street1'] ?? null,
        'Street2' => $address['Street2'] ?? null,
        'City' => $address['City'] ?? null,
        'Country' => $address['County'] ?? null,
        'State' => $address['State'] ?? null,
        'ZIP' => $address['ZIP'] ?? null,
        'emergencyContactFirstName' => $emFirst,
        'emergencyContactLastName' => $emLast,
        'emergencyContactPhone' => $em['Phone'] ?? null,
        'noAddress' => empty($address['Street1']),
        'noEmergencyContact' => empty($em['Name'])
    ];

    // If caller asks for JSON, return it; otherwise redirect to register page with prefill flag + email
    if (isset($_GET['format']) && $_GET['format'] === 'json') {
        header('Content-Type: application/json');
        echo json_encode($out);
        exit;
    }

    // Redirect to register page which will fetch JSON and autofill
    $url = '../pages/register.html?prefill=1&email=' . urlencode($login['Email']);
    header('Location: ' . $url);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo "Server error.";
    exit;
}

