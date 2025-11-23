<?php
/**
 * Client Login API Endpoint - Handles Client Login authentication with hashed password verification
 *
 * Database Table: tblClients
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

// Helper to log login attempts to a file
function logLoginAttempt($email, $ip, $userAgent, $status, $note = '') {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logFile = $logDir . '/login_attempts.log';
    $time = date('Y-m-d H:i:s');
    $entry = sprintf("[%s] IP=%s Email=%s Status=%s Note=%s UA=%s\n", $time, $ip, $email, $status, $note, $userAgent);
    @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
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

// Validate input
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
    $stmt = $pdo->prepare("SELECT ClientID, Email, FirstName, LastName, Password, Status FROM tblClients WHERE Email = :email LIMIT 1");
    $stmt->execute(['email' => $email]);
    $client = $stmt->fetch(PDO::FETCH_ASSOC);

    // Prepare info used for logging
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

    // Check if client exists and verify password using timing-safe compare
    $storedHash = $client['Password'] ?? '';
    $passwordMatch = false;
    if ($client && $storedHash !== '') {
        // Use lowercase to avoid case differences in hex and use hash_equals for timing-safe compare
        $passwordMatch = hash_equals(strtolower($storedHash), strtolower($passwordHash));
    }

    // Check if client exists, is active, and password hash matches
    if ($client && $passwordMatch) {
        if (!empty($client['Status']) && strtolower($client['Status']) !== 'active') {
            // Log inactive attempts
            logLoginAttempt($email, $ip, $userAgent, 'inactive', 'Account not active');
            sendJsonResponse([
                'success' => false,
                'message' => 'Your account is not active. Please contact administrator. / Su cuenta no está activa. Por favor, contacte al administrador.'
            ], 403);
        }

        // Start session and generate unique client session ID
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        // Generate a cryptographically secure token for the session
        try {
            $clientSessionID = bin2hex(random_bytes(32)); // 64-char token
        } catch (Exception $e) {
            // Fallback to less-secure token if random_bytes fails
            $clientSessionID = 'C' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT) . substr(time(), -6);
        }

        // Token expiry (1 hour)
        $tokenExpiry = time() + 3600;

        // Store session data
        $_SESSION['client_id'] = $client['ClientID'];
        $_SESSION['client_email'] = $client['Email'];
        $_SESSION['client_name'] = trim($client['FirstName'] . ' ' . $client['LastName']);
        $_SESSION['logged_in'] = true;
        $_SESSION['client_session_id'] = $clientSessionID;
        $_SESSION['client_session_expires'] = $tokenExpiry;

        // Update LastUsed date
        try {
            $updateStmt = $pdo->prepare("UPDATE tblClients SET LastUsed = CURDATE() WHERE ClientID = :clientID");
            $updateStmt->execute(['clientID' => $client['ClientID']]);
        } catch (PDOException $e) {
            // Log but don't fail login if LastUsed update fails
            error_log('Failed to update LastUsed: ' . $e->getMessage());
        }

        // Try to insert session record into tblSessions (best-effort)
        try {
            $sessionStmt = $pdo->prepare("INSERT INTO tblSessions (SessionID, UserID, Date) VALUES (:sessionID, :userID, NOW())");
            $sessionStmt->execute(['sessionID' => $clientSessionID, 'userID' => $client['ClientID']]);
        } catch (PDOException $e) {
            // Not fatal — log for diagnostics
            error_log('Failed to write session record: ' . $e->getMessage());
        }

        // Log successful login
        logLoginAttempt($email, $ip, $userAgent, 'success', 'Login successful');

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
        // Invalid credentials — log attempt
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        logLoginAttempt($email, $ip, $userAgent, 'failure', 'Invalid credentials');

        // Generic failure response to avoid user enumeration
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

