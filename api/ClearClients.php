<?php
/**
 * ============================================================
 *  File:        ClearClients.php
 *  Purpose:     Clear all test/client-related data from the db
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:39 PM
 *  Changes Made:      Code cleanup
 * ============================================================
*/

// Set content-type and default timezone
header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

// Only allow POST requests for safety
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed. Use POST.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Disable foreign key checks to allow truncating tables with relationships
$mysqli->query("SET FOREIGN_KEY_CHECKS = 0");

// Only clear client/test-related tables
$tables = [
    'tblMovementLogs',
    'tblVisitServices',
    'tblVisits',
    'tblVisitServiceSelections',
    'tblClientEmergencyContacts',
    'tblClientAddress',
    'tblClientAuth',
    'tblClients'
];

$errors = [];

foreach ($tables as $table) {
    if (!$mysqli->query("TRUNCATE TABLE `$table`")) {
        $errors[] = "Failed to truncate $table: " . $mysqli->error;
    }
}

// Re-enable foreign key checks
$mysqli->query("SET FOREIGN_KEY_CHECKS = 1");

if (empty($errors)) {
    echo json_encode(['success' => true, 'message' => 'Test/client tables cleared successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Some tables could not be cleared.', 'errors' => $errors]);
}