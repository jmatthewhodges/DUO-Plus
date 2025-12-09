<?php
/**
 * Client Login API Endpoint - Handles Client Login authentication with hashed password verification
 * recall php -S localhost:8000 to start program
 * Database Table: tblClientLogin
 * - ClientID VARCHAR(50) PRIMARY KEY
 * - Email VARCHAR(250)
 * - Password VARCHAR(400) - Stores SHA-256 hash
 */

// Turn off error display, keep error logging
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
        'message' => 'Method not allowed. Only POST requests are accepted. / Método no permitido. Solo se aceptan solicitudes POST.'
    ], 405);
}

// Get and sanitize input
$email = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
$passwordHash = filter_input(INPUT_POST, 'password_hash', FILTER_SANITIZE_STRING);

// Validate input presence
if (empty($email) || empty($passwordHash)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Email and password are required. / Correo electrónico y contraseña son requeridos.'
    ], 400);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Invalid email format. / Formato de correo electrónico no válido.'
    ], 400);
}

try {
    // Query database for client with matching email
    $stmt = $pdo->prepare("
        SELECT LoginID, ClientID, Email, Password
        FROM tblClientLogin 
        WHERE Email = :email 
        LIMIT 1
    ");

    $stmt->execute(['email' => $email]);
    $client = $stmt->fetch(PDO::FETCH_ASSOC);

    // Check if user exists, is active, and password hash matches
    if ($user && $user['Password'] === $passwordHash) {
        // Check if user account is active (assuming 'Active' or similar status)
        if (!empty($user['Status']) && strtolower($user['Status']) !== 'active') {
            sendJsonResponse([
                'success' => false,
                'message' => 'Your account is not active. Please contact administrator. / Su cuenta no está activa. Por favor, contacte al administrador.'
            ], 403);
        }

        // Login successful - start session FIRST (before DB operations)
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Generate unique session ID (format: S + 3 digits + timestamp for uniqueness)
        $sessionID = 'S' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT) . substr(time(), -6);

        // Store session data
        $_SESSION['client_id'] = $client['ClientID'];
        $_SESSION['client_email'] = $client['Email'];
        $_SESSION['logged_in'] = true;
        $_SESSION['user_id'] = $client['UserID'];
        $_SESSION['session_id'] = $sessionID;

        // Update LastUsed and create session record in a single transaction (async-friendly)
        try {
            $pdo->beginTransaction();

            $updateStmt = $pdo->prepare("UPDATE tblClientLogin SET LastUsed = CURDATE() WHERE ClientID = :clientID");
            $updateStmt->execute(['clientID' => $client['ClientID']]);

            $sessionStmt = $pdo->prepare("INSERT INTO tblSessions (SessionID, UserID, Date) VALUES (:sessionID, :userID, CURDATE())");
            $sessionStmt->execute(['sessionID' => $sessionID, 'userID' => $user['UserID']]);
            
            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            // Log but don't fail login if DB updates fail
            error_log('Failed to update session data: ' . $e->getMessage());
        }
        
        // Return success response
        sendJsonResponse([
            'success' => true,
            'message' => 'Login successful. / Inicio de sesión exitoso.',
            'redirect' => '../pages/client-dashboard.php',
            'client' => [
                'id' => $client['ClientID'],
                'email' => $client['Email'],
                'name' => trim($client['FirstName'] . ' ' . $client['LastName'])
            ]
        ]);
    } else {
        // Password does not match
        sendJsonResponse([
            'success' => false,
            'message' => 'Invalid email or password. / Correo electrónico o contraseña inválidos.'
        ], 401);
    }

} catch (PDOException $e) {
    // Database error - log but don't expose details to client
    error_log('Login database error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'An error occurred during login. Please try again later. / Se produjo un error durante el inicio de sesión. Por favor, inténtelo de nuevo más tarde.'
    ], 500);
} catch (Exception $e) {
    // General error - log but don't expose details to client
    error_log('Login error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'An error occurred during login. Please try again later. / Se produjo un error durante el inicio de sesión. Por favor, inténtelo de nuevo más tarde.'
    ], 500);
}
?>

