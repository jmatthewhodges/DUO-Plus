<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');
session_start();

// Include database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Only POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'error' => 'Method not allowed']));
}

// Simple rate limiting
$clientIP = $_SERVER['REMOTE_ADDR'];
$rateLimitKey = 'pin_attempts_' . $clientIP;

// Initialize or reset if expired
if (!isset($_SESSION[$rateLimitKey])) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
} elseif (time() - $_SESSION[$rateLimitKey]['time'] >= 900) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$pin = $input['pin'] ?? null;
$name = $input['name'] ?? null;

// Validate name
if (!$name || !is_string($name) || empty(trim($name))) {
    http_response_code(400);
    die(json_encode(['success' => false, 'error' => 'Please enter your name']));
}

// Validate PIN format
if (!$pin || !is_string($pin) || strlen($pin) !== 6 || !ctype_digit($pin)) {
    http_response_code(400);
    die(json_encode(['success' => false, 'error' => 'Invalid PIN format']));
}

// Fetch PIN from database based on client name
$correctPin = null;

try {
    if ($mysqli && !mysqli_connect_error()) {
        // Query database for PIN (assumes table "tblClientPIN" with columns "name" and "pin")
        $stmt = $mysqli->prepare("SELECT pin FROM tblClientPIN WHERE name = ? LIMIT 1");
        $stmt->bind_param("s", $name);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            $correctPin = $row['pin'];
        }
        $stmt->close();
    }
} catch (\Throwable $th) {
    // If DB query fails, correctPin will be null
}

// Use default if DB lookup failed
if (!$correctPin) {
    $correctPin = '123456';
}

// Verify PIN
if ($pin !== $correctPin) {
    $_SESSION[$rateLimitKey]['count']++;
    
    // Check if rate limit exceeded after incrementing
    if ($_SESSION[$rateLimitKey]['count'] >= 5) {
        http_response_code(429);
        die(json_encode(['success' => false, 'error' => 'Please ask for the code before continuing.']));
    }
    
    http_response_code(401);
    die(json_encode(['success' => false, 'error' => 'Invalid PIN']));
}

// Success - reset counter
$_SESSION[$rateLimitKey]['count'] = 0;
http_response_code(200);
echo json_encode(['success' => true, 'message' => 'PIN verified']);
?>
