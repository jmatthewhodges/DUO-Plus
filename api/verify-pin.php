<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');
session_start();

// Only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'error' => 'Method not allowed']));
}

// Simple rate limiting (max 5 attempts per 15 minutes)
$clientIP = $_SERVER['REMOTE_ADDR'];
$rateLimitKey = 'pin_attempts_' . $clientIP;

if (isset($_SESSION[$rateLimitKey])) {
    if (time() - $_SESSION[$rateLimitKey]['time'] < 900) {
        if ($_SESSION[$rateLimitKey]['count'] >= 10) {
            http_response_code(429);
            die(json_encode(['success' => false, 'error' => 'Too many attempts. Try again later.']));
        }
        if ($_SESSION[$rateLimitKey]['count'] >= 5) {
            http_response_code(429);
            die(json_encode(['success' => false, 'error' => 'please ask for the code before continuing.']));
        }
    } else {
        $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
    }
} else {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$pin = $input['pin'] ?? null;

// Validate PIN format
if (!$pin || !is_string($pin) || strlen($pin) !== 6 || !ctype_digit($pin)) {
    $_SESSION[$rateLimitKey]['count']++;
    http_response_code(400);
    die(json_encode(['success' => false, 'error' => 'Invalid PIN format']));
}

// Hardcoded PIN for testing (replace with database lookup)
$correctPin = '123456';

// Verify PIN
if ($pin !== $correctPin) {
    $_SESSION[$rateLimitKey]['count']++;
    http_response_code(401);
    die(json_encode(['success' => false, 'error' => 'Invalid PIN']));
}

// Success
$_SESSION[$rateLimitKey]['count'] = 0;
http_response_code(200);
echo json_encode(['success' => true, 'message' => 'PIN verified']);
?>
