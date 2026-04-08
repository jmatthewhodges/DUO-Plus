<?php
/**
 * ============================================================
 * File:          VerifyPin.php
 * Description:   Validates submitted PIN codes and reports whether
 *                the current browser session is still approved for a
 *                specific PIN type (`general` or `admin`).
 *
 * Last Modified By:  Cameron Jasper
 * Last Modified On:  Apr 7 11:00 PM
 * Changes Made:      Added per-pin-type session metadata validation and
 *                    a 24-hour PIN session timeout.
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

require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'] ?? null;

// A successful PIN check stays valid for up to 24 hours unless the PIN
// record itself changes sooner (for example, the admin updates the code).
const PIN_SESSION_TTL_SECONDS = 86400; // 24 hours

// Keep separate session keys for the general PIN and the admin PIN so a
// change to one code only invalidates the pages that depend on that code.
function getSessionKeysForPinType(string $pinType): array {
    $sessionKey = ($pinType === 'admin') ? 'admin_pin_verified' : 'pin_verified';
    return [$sessionKey, $sessionKey . '_meta'];
}

function clearPinSessionForType(string $pinType): void {
    [$sessionKey, $metaKey] = getSessionKeysForPinType($pinType);
    unset($_SESSION[$sessionKey], $_SESSION[$metaKey]);
}

// Re-validate the saved session against the current database row on every
// check so old sessions stop working if the PIN changes or the timeout expires.
function isExistingPinSessionValid($mysqli, string $pinType): bool {
    [$sessionKey, $metaKey] = getSessionKeysForPinType($pinType);

    if (!isset($_SESSION[$sessionKey]) || $_SESSION[$sessionKey] !== true) {
        return false;
    }

    // Check that the session metadata matches the current PIN record in the database
    $meta = $_SESSION[$metaKey] ?? null;
    if (!is_array($meta) || !$mysqli || mysqli_connect_error()) {
        clearPinSessionForType($pinType);
        return false;
    }

    // perpared statement to fetch current PIN details for the required type
    $stmt = $mysqli->prepare("SELECT PinID, PinValue, LastUpdated FROM tblPinCode WHERE PinType = ? LIMIT 1");
    if (!$stmt) {
        logError('prepare session validation', $mysqli->error);
        clearPinSessionForType($pinType);
        return false;
    }

    // Bind the pin type parameter and execute
    $stmt->bind_param('s', $pinType);
    if (!$stmt->execute()) {
        logError('execute session validation', $stmt->error);
        $stmt->close();
        clearPinSessionForType($pinType);
        return false;
    }

    // fetch
    $row = $stmt->get_result()->fetch_assoc() ?: [];
    $stmt->close();

    // Extract current PIN details and compare with session metadata
    $currentPinId       = (string) ($row['PinID'] ?? '');
    $currentLastUpdated = (string) ($row['LastUpdated'] ?? '');
    $currentPinValue    = (string) ($row['PinValue'] ?? '');
    $verifiedAt         = (int) ($meta['verified_at'] ?? 0);
    $isExpired          = $verifiedAt <= 0 || (time() - $verifiedAt) > PIN_SESSION_TTL_SECONDS;

    // The session is valid if it's not expired and all details match the current PIN record
    $matches = !$isExpired
        && $currentPinId !== ''
        && hash_equals((string) ($meta['pin_id'] ?? ''), $currentPinId)
        && hash_equals((string) ($meta['last_updated'] ?? ''), $currentLastUpdated)
        && hash_equals((string) ($meta['pin_value'] ?? ''), $currentPinValue);

    // If the session doesn't match, clear it so the user has to verify again
    if (!$matches) {
        clearPinSessionForType($pinType);
    }

    return $matches;
}

// Handle GET request: Check if user has valid session
// ?type=admin checks the admin session key; all others check the general key
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $checkType = (($_GET['type'] ?? 'general') === 'admin') ? 'admin' : 'general';
    $verified = isExistingPinSessionValid($mysqli, $checkType);
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
$pinType  = trim($input['pinType']  ?? 'general');

// Only allow known pin types
if (!in_array($pinType, ['general', 'admin'], true)) {
    $pinType = 'general';
}

// Validate PIN format (must be exactly 6 digits)
if (!$pin || !is_string($pin) || strlen($pin) !== 6 || !ctype_digit($pin)) {
    respond(400, ['success' => false, 'error' => 'Invalid PIN']);
}

// Validate name
if (empty($name) || !is_string($name)) {
    respond(400, ['success' => false, 'error' => 'Please enter your name.']);
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

// Database connection
if (!$mysqli || mysqli_connect_error()) {
    logError('DB connection', mysqli_connect_error() ?? 'mysqli not initialized');
    respond(503, ['success' => false, 'error' => 'Service temporarily unavailable. Please try again.']);
}

// Fetch PIN from database, matched by PinType
$correctPin     = null;
$pinId          = null;
$pinLastUpdated = '';

$stmt = $mysqli->prepare("SELECT PinID, PinValue, LastUpdated FROM tblPinCode WHERE PinType = ? LIMIT 1");
if (!$stmt) {
    logError('prepare tblPinCode', $mysqli->error);
    respond(500, ['success' => false, 'error' => 'Internal server error.']);
}

$stmt->bind_param('s', $pinType);
if (!$stmt->execute()) {
    logError('execute tblPinCode', $stmt->error);
    $stmt->close();
    respond(500, ['success' => false, 'error' => 'Internal server error.']);
}

$result = $stmt->get_result();
if ($row = $result->fetch_assoc()) {
    $correctPin     = $row['PinValue'];
    $pinId          = $row['PinID'];
    $pinLastUpdated = (string) ($row['LastUpdated'] ?? '');
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

// Rotate the PHP session ID after a successful PIN entry so the browser
// gets a fresh session identifier for the newly approved PIN session.
session_regenerate_id(true);

// ---------------------------------------------------------------
// 7. Set secure session flag — keyed by pin type
//    Store the current PIN record details so resets invalidate immediately
//    and expire the PIN verification after 24 hours
// ---------------------------------------------------------------
[$sessionKey, $sessionMetaKey] = getSessionKeysForPinType($pinType);
$_SESSION[$sessionKey] = true;
$_SESSION[$sessionMetaKey] = [
    'pin_id' => (string) $pinId,
    'last_updated' => $pinLastUpdated,
    'pin_value' => (string) $correctPin,
    'verified_at' => time(),
];
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