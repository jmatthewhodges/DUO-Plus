<?php
/**
 * ============================================================
 * File:          VerifyPin.php
 * Description:   API endpoint for PIN code access restriction.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  Feb 26 11:00 PM
 * Changes Made:      Added session creation and validation
 * ============================================================
*/

error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

// Send a JSON response and exit
function respond(int $code, array $payload): void {
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

// Log errors without exposing internals to client
function logError(string $context, string $detail): void {
    error_log("[Verify-Pin] $context: $detail");
}

// Session & method guard
session_start();

// Handle GET request: Check if user has valid session
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $verified = isset($_SESSION['pin_verified']) && $_SESSION['pin_verified'] === true;
    respond(200, ['verified' => $verified]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Method not allowed. Use POST or GET.']);
}

// Parse & validate JSON body BEFORE rate limit check
// (avoids burning attempts on malformed requests)
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respond(400, ['success' => false, 'error' => 'Invalid JSON body.']);
}

$pin      = $input['pin']      ?? null;
$name     = trim($input['name']     ?? '');
$pageName = trim($input['pageName'] ?? '');

// Validate name
if (empty($name) || !is_string($name)) {
    respond(400, ['success' => false, 'error' => 'Please enter your name.']);
}

// Validate PIN format (must be exactly 6 digits)
if (!$pin || !is_string($pin) || strlen($pin) !== 6 || !ctype_digit($pin)) {
    respond(400, ['success' => false, 'error' => 'PIN must be exactly 6 digits.']);
}

// Sanitize pageName — allow only alphanumeric, dashes, underscores
if (!empty($pageName) && !preg_match('/^[a-zA-Z0-9_\-]{0,64}$/', $pageName)) {
    respond(400, ['success' => false, 'error' => 'Invalid page name.']);
}

// Rate limiting — checked AFTER input validation
$clientIP     = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitKey = 'pin_attempts_' . $clientIP;
$maxAttempts  = 5;
$windowSecs   = 900; // 15 minutes

if (!isset($_SESSION[$rateLimitKey])) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
} elseif (time() - $_SESSION[$rateLimitKey]['time'] >= $windowSecs) {
    // Window expired — reset
    $_SESSION[$rateLimitKey] = ['count' => 0, 'time' => time()];
}

// Block before even hitting the DB if already locked out
if ($_SESSION[$rateLimitKey]['count'] >= $maxAttempts) {
    respond(429, ['success' => false, 'error' => 'Too many failed attempts. Please ask for the code before continuing.']);
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'] ?? null;

if (!$mysqli || mysqli_connect_error()) {
    logError('DB connection', mysqli_connect_error() ?? 'mysqli not initialized');
    respond(503, ['success' => false, 'error' => 'Service temporarily unavailable. Please try again.']);
}

// Fetch PIN from database
$correctPin = null;
$pinId      = null;

$stmt = $mysqli->prepare("SELECT PinID, PinValue FROM tblPinCode LIMIT 1");
if (!$stmt) {
    logError('prepare tblPinCode', $mysqli->error);
    respond(500, ['success' => false, 'error' => 'Internal server error.']);
}

if (!$stmt->execute()) {
    logError('execute tblPinCode', $stmt->error);
    $stmt->close();
    respond(500, ['success' => false, 'error' => 'Internal server error.']);
}

$result = $stmt->get_result();
if ($row = $result->fetch_assoc()) {
    $correctPin = $row['PinValue'];
    $pinId      = $row['PinID'];
}
$stmt->close();

if (empty($correctPin)) {
    logError('PIN lookup', 'No PIN found in tblPinCode — access blocked.');
    respond(503, ['success' => false, 'error' => 'Access is not currently available. Please contact an administrator.']);
}

// Verify PIN
if ($pin !== $correctPin) {
    $_SESSION[$rateLimitKey]['count']++;
    $remaining = $maxAttempts - $_SESSION[$rateLimitKey]['count'];

    if ($remaining <= 0) {
        respond(429, ['success' => false, 'error' => 'Too many failed attempts. Please ask for the code before continuing.']);
    }

    respond(401, [
        'success'           => false,
        'error'             => 'Incorrect PIN.',
        'attemptsRemaining' => $remaining
    ]);
}

// PIN correct — reset rate limit counter
$_SESSION[$rateLimitKey]['count'] = 0;

// ---------------------------------------------------------------
// 7. Set secure session flag
// ---------------------------------------------------------------
$_SESSION['pin_verified'] = true;
session_write_close();  // Ensure session is saved before responding

// Debug: Log what we just set
error_log("PIN verified for $name. Session ID: " . session_id());

// ---------------------------------------------------------------
// 8. Log successful access to tblPinCodeLogs
// ---------------------------------------------------------------
$pinCodeLogID = bin2hex(random_bytes(8)); // 16-char hex, consistent with rest of codebase
$currentTime  = date('Y-m-d H:i:s');

$logStmt = $mysqli->prepare(
    "INSERT INTO tblPinCodeLogs (PinCodeLogID, PinID, Name, DateUsed, PageName)
     VALUES (?, ?, ?, ?, ?)"
);

if (!$logStmt) {
    // Non-fatal — PIN was valid, log the issue but don't block the user
    logError('prepare tblPinCodeLogs', $mysqli->error);
} else {
    $logStmt->bind_param('sssss', $pinCodeLogID, $pinId, $name, $currentTime, $pageName);
    if (!$logStmt->execute()) {
        logError('execute tblPinCodeLogs', $logStmt->error);
    }
    $logStmt->close();
}

// ---------------------------------------------------------------
// 9. Success
// ---------------------------------------------------------------
respond(200, ['success' => true, 'message' => 'PIN verified successfully.']);