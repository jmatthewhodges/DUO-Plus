<?php

// Tell mysqli to throw exceptions
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// phpdotenv library
require_once DIR . '/../vendor/autoload.php';

// Point to .env in root folder
$dotenv = Dotenv\Dotenv::createImmutable(DIR . '/../');
// Load it -> use safeLoad() to ignore exception for no .env found
$dotenv->safeLoad();

// Credentials from .env
$dbHost = $_ENV['DB_HOST'];
$dbName = $_ENV['DB_NAME'];
$dbUser = $_ENV['DB_USER'];
$dbPass = $_ENV['DB_PASS'];

// Using mysqli (catch error if db connection failed)
try {
    $GLOBALS['mysqli'] = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
    //echo json_encode(['success' => true, 'message' => 'Database connection established.']);
} catch (\Throwable $th) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $th->getMessage()]);
} 

/*
For all API endpoints:

// Grab database connection from file
require_once DIR . '/db.php';

// Always set content type (not always the same)
header('Content-Type: application/json');

// Declare mysqli to use connection
$mysqli = $GLOBALS['mysqli'];

*/