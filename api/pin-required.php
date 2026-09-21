<?php
/**
 * ============================================================
 * File:            pin-required.php
 * Description:     Enforce PIN-verified access for protected endpoints.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  Sept 20, 2026
 * Changes Made:      Fixed an conflict with new client ping system
 * ============================================================
 */
session_start();

if (!isset($_SESSION['pin_verified']) || $_SESSION['pin_verified'] !== true) {
    // Check if this is an API request (not HTML)
    // Determine if the request is for an API endpoint by checking the script path
    $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_FILENAME'] ?? '');
    $isAPI = (strpos($scriptPath, '/api/') !== false);
    
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
