<?php
/**
 * ============================================================
 * File:          pin-required.php
 * Description:   API endpoint for PIN code access restriction.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  Feb 26 11:00 PM
 * Changes Made:      Added exit statements so this file works properly 
 * Comments:          !!!!!!!!!This file should be included at the top of any API endpoint that needs to be 
 *                    protected by PIN verification.!!!!!!!!!!!
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
