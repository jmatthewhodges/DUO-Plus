<?php
/**
 * Database Connection Configuration
 * Loads database credentials from .env file and establishes PDO connection
 */

// Suppress errors from being displayed (they'll be thrown as exceptions instead)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Load environment variables from .env file
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments and empty lines
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE format
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

// Get database credentials from environment variables with fallback defaults
$host = $_ENV['DB_HOST'];
$dbname = $_ENV['DB_NAME'];
$username = $_ENV['DB_USER'];
$password = $_ENV['DB_PASS'];

// Establish database connection using PDO
try {
    $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_PERSISTENT => true, // Use persistent connections for better performance
        PDO::ATTR_EMULATE_PREPARES => false, // Use native prepared statements
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4",
        PDO::ATTR_TIMEOUT => 5 // 5 second connection timeout
    ];
    $pdo = new PDO($dsn, $username, $password, $options);
    
} catch(PDOException $e) {
    // Log error but throw exception instead of die() to allow proper error handling
    error_log('Database connection failed: ' . $e->getMessage());
    throw new Exception('Database connection failed');
}
?>

