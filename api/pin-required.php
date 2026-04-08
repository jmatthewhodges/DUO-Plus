<?php
/**
 * ============================================================
 * File:          pin-required.php
 * Description:   API endpoint for PIN code access restriction.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  April 7 11:00 PM
 * Changes Made:      Changed Pin code flow to have timeouts and pin verification reinforcement
 * Comments:          !!!!!!!!!This file should be included at the top of any API endpoint that needs to be 
 *                    protected by PIN verification.!!!!!!!!!!!
 * ============================================================
 */

session_start();
require_once __DIR__ . '/db.php';

// Keep the server-side PIN approval valid for one day unless the PIN is
// changed sooner; after that, the user must re-enter the code.
const PIN_SESSION_TTL_SECONDS = 86400; // 24 hours

// Pages can set `$requiredPinType = 'admin';` before including this file.
// If nothing is set, the route falls back to the general PIN requirement.
$requiredPinType = (isset($requiredPinType) && $requiredPinType === 'admin') ? 'admin' : 'general';
$sessionKey = ($requiredPinType === 'admin') ? 'admin_pin_verified' : 'pin_verified';
$sessionMetaKey = $sessionKey . '_meta';

// error handling for unauthorized access
function denyPinAccess(bool $isAPI, string $requiredPinType): void {
    if ($isAPI) {
        if (!headers_sent()) {
            header('Content-Type: application/json');
        }
        http_response_code(403);
        // Provide a specific error message based on the required PIN type for better client-side handling
        $error = ($requiredPinType === 'admin')
            ? 'Unauthorized - Admin PIN verification required'
            : 'Unauthorized - PIN verification required';
        echo json_encode(['success' => false, 'error' => $error]);
        exit;
    }

    // For non-API requests, redirect to the main page where the user can enter the PIN
    if (!headers_sent()) {
        header('Location: /index.html');
    }
    exit;
}

// Compare the saved session metadata with the current PIN row so we can
// reject expired sessions or sessions tied to an older PIN value.
function pinSessionIsCurrent($mysqli, string $requiredPinType, string $sessionKey, string $sessionMetaKey): bool {
    if (!isset($_SESSION[$sessionKey]) || $_SESSION[$sessionKey] !== true) {
        return false;
    }

    // The session metadata should contain the PIN ID, value, and last updated timestamp from when the user verified. 
    $meta = $_SESSION[$sessionMetaKey] ?? null;
    if (!is_array($meta) || !$mysqli || mysqli_connect_error()) {
        unset($_SESSION[$sessionKey], $_SESSION[$sessionMetaKey]);
        return false;
    }

    // Fetch the current PIN details for the required type from the database
    $stmt = $mysqli->prepare("SELECT PinID, PinValue, LastUpdated FROM tblPinCode WHERE PinType = ? LIMIT 1");
    if (!$stmt) {
        unset($_SESSION[$sessionKey], $_SESSION[$sessionMetaKey]);
        return false;
    }

    // Bind the pin type parameter and execute
    $stmt->bind_param('s', $requiredPinType);
    if (!$stmt->execute()) {
        $stmt->close();
        unset($_SESSION[$sessionKey], $_SESSION[$sessionMetaKey]);
        return false;
    }

    $row = $stmt->get_result()->fetch_assoc() ?: [];
    $stmt->close();

    $verifiedAt = (int) ($meta['verified_at'] ?? 0);
    $isExpired = $verifiedAt <= 0 || (time() - $verifiedAt) > PIN_SESSION_TTL_SECONDS;

    // The session is valid if it's not expired and all details match the current PIN record
    $matches = !$isExpired
        && !empty($row['PinID'])
        && hash_equals((string) ($meta['pin_id'] ?? ''), (string) $row['PinID'])
        && hash_equals((string) ($meta['last_updated'] ?? ''), (string) ($row['LastUpdated'] ?? ''))
        && hash_equals((string) ($meta['pin_value'] ?? ''), (string) ($row['PinValue'] ?? ''));

    // If the session doesn't match, clear it so the user has to verify again
    if (!$matches) {
        unset($_SESSION[$sessionKey], $_SESSION[$sessionMetaKey]);
    }

    return $matches;
}

// Determine if the current request is for an API endpoint based on the script filename.
$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_FILENAME'] ?? '');
$isAPI = strpos($scriptPath, '/api/') !== false;

// Check if the PIN session is current and valid for the required type. If not, deny access.
$mysqli = $GLOBALS['mysqli'] ?? null;
if (!pinSessionIsCurrent($mysqli, $requiredPinType, $sessionKey, $sessionMetaKey)) {
    denyPinAccess($isAPI, $requiredPinType);
}
