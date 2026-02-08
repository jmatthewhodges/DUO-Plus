<?php

ob_start(); // Buffer any output from db.php
session_start();
require_once __DIR__ . '/db.php';
ob_end_clean(); // Discard the buffered output (db.php echo messages)

// Ensure mysqli is available
$mysqli = $GLOBALS['mysqli'] ?? null;
if (!$mysqli) {
    header("Location: ../index.html?error=db");
    exit;
}

// Accept GET or POST
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    // Log what method was actually sent
    error_log("Prefill: Invalid method: " . $_SERVER['REQUEST_METHOD']);
    header("Location: ../index.html?error=method");
    exit;
}

// Get email from GET or POST parameter
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = isset($_GET['email']) ? trim($_GET['email']) : '';
} else {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = isset($input['email']) ? trim($input['email']) : '';
}

// Check for email parameter
if (!$email) {
    header("Location: ../index.html?error=noemail");
    exit;
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    header("Location: ../index.html?error=bademail");
    exit;
}

try {
    // 1) Find client ID based on email (no password verification needed)
    $stmt = $mysqli->prepare("SELECT ClientID, Email FROM tblClientLogin WHERE Email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $res = $stmt->get_result();
    $login = $res->fetch_assoc();

    // If no user found, redirect with error
    if (!$login) {
        header("Location: ../index.html?error=notfound");
        exit;
    }

    // ALL INFO EXTRACTED USING CLIENT ID
    // 2) Get client basic info 
    // Extract client ID
    $clientID = $login['ClientID'];

    $stmt = $mysqli->prepare("SELECT FirstName, MiddleName, LastName, DOB, Sex FROM tblClients WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $client = $stmt->get_result()->fetch_assoc() ?: [];

    // 3) Get one phone if available
    $stmt = $mysqli->prepare("SELECT Phone FROM tblClientPhone WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $phone = ($stmt->get_result()->fetch_assoc()['Phone']) ?? null;

    // 4) Get one address if available
    $stmt = $mysqli->prepare("SELECT Street1, Street2, City, County, State, ZIP FROM tblClientAddress WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $address = $stmt->get_result()->fetch_assoc() ?? [];

    // 5) Get one emergency contact if available
    $stmt = $mysqli->prepare("SELECT Name, Phone FROM tblClientEmergencyContacts WHERE ClientID = ? LIMIT 1");
    $stmt->bind_param('s', $clientID);
    $stmt->execute();
    $em = $stmt->get_result()->fetch_assoc() ?? [];

    // Normalize emergency name into first/last
    $emFirst = null; $emLast = null;
    if (!empty($em['Name'])) {
        $parts = preg_split('/\s+/', trim($em['Name']), 2);
        $emFirst = $parts[0] ?? null;
        $emLast = $parts[1] ?? null;
    }

    // pulling data together
    $out = [
        'Email' => $login['Email'],
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
    
    // Pass prefill data via URL as JSON
    $json = json_encode($out);
    header("Location: ../pages/register.html?prefill=1&data=" . urlencode($json));
    exit;

// Server error
} catch (Exception $e) {
    header("Location: ../index.html?error=server");
    exit;
}

