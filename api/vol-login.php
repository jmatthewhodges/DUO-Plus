<?php
/**
 * Volunteer Login API Endpoint
 * Handles volunteer login authentication with hashed password verification
 * 
 * Database Table: tblUsers
 * - UserID VARCHAR(50) PRIMARY KEY
 * - Email VARCHAR(250)
 * - FirstName VARCHAR(50)
 * - LastName VARCHAR(50)
 * - Password VARCHAR(400) - Stores SHA-256 hash
 * - CreateDate DATE
 * - LastUsed DATE
 * - Status VARCHAR(10)
 */

// Turn off error display, but keep error logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set content type to JSON and prevent any output before JSON
header('Content-Type: application/json');

// Start output buffering to catch any accidental output
ob_start();

// Include database connection
try {
    require_once __DIR__ . '/db.php';
    // Verify $pdo was created
    if (!isset($pdo)) {
        throw new Exception('Database connection not established');
    }
    // Clear output buffer in case db.php output anything
    ob_clean();
} catch (Exception $e) {
    // End output buffering and discard any content, then send JSON error
    ob_end_clean();
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed. Please try again later.'
    ]);
    exit;
}

// Helper function to send JSON response and exit
function sendJsonResponse($data, $statusCode = 200) {
    ob_end_clean(); // End output buffering and discard any content
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Method not allowed. Only POST requests are accepted.'
    ], 405);
}

// Get and sanitize input
$email = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
$passwordHash = filter_input(INPUT_POST, 'password_hash', FILTER_SANITIZE_STRING);

// Validate input
if (empty($email) || empty($passwordHash)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Email and password are required.'
    ], 400);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Invalid email format.'
    ], 400);
}

try {
    // Query database for user with matching email
    $stmt = $pdo->prepare("
        SELECT UserID, Email, FirstName, LastName, Password, Status 
        FROM tblUsers 
        WHERE Email = :email 
        LIMIT 1
    ");
    
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if user exists, is active, and password hash matches
    if ($user && $user['Password'] === $passwordHash) {
        // Check if user account is active (assuming 'Active' or similar status)
        if (!empty($user['Status']) && strtolower($user['Status']) !== 'active') {
            sendJsonResponse([
                'success' => false,
                'message' => 'Your account is not active. Please contact administrator.'
            ], 403);
        }
        
        // Update LastUsed date (suppress errors if update fails)
        try {
            $updateStmt = $pdo->prepare("
                UPDATE tblUsers 
                SET LastUsed = CURDATE() 
                WHERE UserID = :userID
            ");
            $updateStmt->execute(['userID' => $user['UserID']]);
        } catch (PDOException $e) {
            // Log but don't fail login if LastUsed update fails
            error_log('Failed to update LastUsed: ' . $e->getMessage());
        }
        
        // Login successful - start session
        session_start();
        $_SESSION['user_id'] = $user['UserID'];
        $_SESSION['user_email'] = $user['Email'];
        $_SESSION['user_name'] = trim($user['FirstName'] . ' ' . $user['LastName']);
        $_SESSION['logged_in'] = true;
        
        // Return success response
        sendJsonResponse([
            'success' => true,
            'message' => 'Login successful.',
            'redirect' => '../pages/volunteer-dashboard.html',
            'user' => [
                'id' => $user['UserID'],
                'email' => $user['Email'],
                'name' => trim($user['FirstName'] . ' ' . $user['LastName'])
            ]
        ]);
    } else {
        // Invalid credentials
        sendJsonResponse([
            'success' => false,
            'message' => 'Invalid email or password.'
        ], 401);
    }
    
} catch (PDOException $e) {
    // Database error - log but don't expose details to client
    error_log('Login database error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'An error occurred during login. Please try again later.'
    ], 500);
} catch (Exception $e) {
    // General error - log but don't expose details to client
    error_log('Login error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'An error occurred during login. Please try again later.'
    ], 500);
}
?>

