<?php
/**
 * ============================================================
 * File:            pin-required.php
 * Description:     Enforce PIN-verified access for protected endpoints.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:20 PM
 * Changes Made:      Standardized readability structure and comments.
 * ============================================================
 */
session_start();

if (!isset($_SESSION['pin_verified']) || $_SESSION['pin_verified'] !== true) {
    // Check if this is an API request (not HTML)
    $isAPI = (strpos($_SERVER['SCRIPT_FILENAME'] ?? '', '/api/') !== false);
    
    if ($isAPI) {
        // API request - return JSON error
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized - PIN verification required']);
        exit;
    } else {
        // HTML page - redirect to login
        header('Location: /index.html');
        exit;
    }
}
