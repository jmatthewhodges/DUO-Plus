<?php
/**
 * ============================================================
 *  File:        db.php
 *  Description: Database connection configuration and setup.
 *               Loads environment variables and establishes
 *               a MySQLi connection for use across API endpoints.
 *
 *  Last Modified By:  Matthew 
 *  Last Modified On:  Feb 18 @ 2:41 PM 
 *  Changes Made:      Added multi-line comment header and cleaned up code
 * ============================================================
*/

// Throw exceptions on mysqli errors
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Load .env from root
require_once __DIR__ . '/../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->safeLoad();

// Database credentials
$dbHost = $_ENV['DB_HOST'];
$dbName = $_ENV['DB_NAME'];
$dbUser = $_ENV['DB_USER'];
$dbPass = $_ENV['DB_PASS'];
$dbPort = $_ENV['DB_PORT'];

// Connect to database
try {
    $GLOBALS['mysqli'] = new mysqli($dbHost, $dbUser, $dbPass, $dbName, (int)$dbPort);
} catch (\Throwable $th) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $th->getMessage()]);
}
