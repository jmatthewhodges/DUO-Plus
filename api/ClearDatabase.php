<?php
/**
 * ============================================================
 *  File:        ClearDatabase.php
 *  Purpose:     Clear all data from every table in the database
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 19 @ 9:08 PM
 *  Changes Made:      Initial creation 
 * ============================================================
 */

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

// List all tables to clear, in dependency-safe order
$tables = [
    'tblMovementLogs',
    'tblVisitServices',
    'tblVisits',
    'tblEventServices',
    'tblVisitServiceSelections',
    'tblAnalytics',
    'tblClientEmergencyContacts',
    'tblClientAddress',
    'tblClientAuth',
    'tblClients',
    'tblEvents',
    'tblServices',
    'tblFoodDistributionLog',
    'tblPinCodeLogs',
    'tblPinCode',
    'tblAPIKeys'
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
    echo json_encode(['success' => true, 'message' => 'All tables cleared successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Some tables could not be cleared.', 'errors' => $errors]);
}