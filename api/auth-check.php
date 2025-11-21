<?php
/**
 * Authentication Check
 * Verifies that a user is logged in before allowing access to protected pages
 * Also verifies session exists in database (tblSessions) for additional security
 * 
 * This file MUST be included at the very top of protected pages, before any output
 */

// CRITICAL: No output before this point
// Turn off error display
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);

// Clear any existing output buffers
while (ob_get_level() > 0) {
    ob_end_clean();
}
// Start fresh output buffer
ob_start();

// Start session
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    session_start();
}

// Check authentication - start with FALSE
$authenticated = false;

// Only authenticate if ALL required session variables exist:
// 1. logged_in must be true
// 2. user_id must exist (proves login happened)
if (isset($_SESSION['logged_in']) && 
    $_SESSION['logged_in'] === true && 
    !empty($_SESSION['user_id'])) {
    $authenticated = true;
    
    // Additional security: verify session in database
    try {
        require_once __DIR__ . '/db.php';
        
        if (isset($pdo) && !empty($_SESSION['user_id']) && !empty($_SESSION['session_id'])) {
            $stmt = $pdo->prepare("SELECT SessionID FROM tblSessions WHERE SessionID = :sessionID AND UserID = :userID LIMIT 1");
            $stmt->execute([
                'sessionID' => $_SESSION['session_id'],
                'userID' => $_SESSION['user_id']
            ]);
            
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                // Session not found in database - not authenticated
                $authenticated = false;
            }
        }
    } catch (Exception $e) {
        // Database error - fall back to PHP session check only
        error_log('Auth check DB error: ' . $e->getMessage());
        // $authenticated remains true if PHP session says logged in
    }
}

// If not authenticated, redirect to login
if (!$authenticated) {
    // Clean all buffers
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    
    // Clear session
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    @session_destroy();
    
    // Redirect path - login page is in pages/ directory
    $loginUrl = 'vol-login.html';
    
    // Send redirect
    header('HTTP/1.1 302 Found');
    header('Location: ' . $loginUrl);
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    exit;
}

// Authenticated - clean buffer and continue
ob_end_clean();
?>
