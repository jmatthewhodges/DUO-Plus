<?php
/**
 * Volunteer Dashboard
 * Protected page - requires authentication
 */

// CRITICAL: Authentication check MUST be first, before any output
require_once __DIR__ . '/../api/auth-check.php';

// Get user information from session
$userName = $_SESSION['user_name'] ?? 'Volunteer';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DUO+ | Volunteer Dashboard</title>
    <link rel="icon" type="image/x-icon" href="../assets/favicon.ico">

    <!-- Bootstrap + HopeUI CSS -->
    <link href="../assets/css/hope-ui.min.css" rel="stylesheet">
    <link href="../assets/css/custom.css" rel="stylesheet">

    <!-- Inline page styles moved to custom.css -->
</head>
<body class="d-flex align-items-center justify-content-center vh-100 v-center-page">

    <div class="container text-center dashboard-container">
        <!-- Logo Section -->
        <div class="logo-section mb-3">
            <img src="../assets/images/DUOvolunteerlogo.png"
                 alt="DUO Volunteer Logo"
                 class="mb-3"
                 style="width: 200px;">
        </div>

        <!-- Welcome Message -->
        <h5 class="welcome-text fw-medium mb-4" style="color: #174593;">
            Welcome, <?php echo htmlspecialchars($userName); ?>!
        </h5>

        <!-- Dashboard Card -->
        <div class="card shadow-lg border-0 rounded-4 mb-4">
            <div class="card-body p-5">
                <p class="text-muted mb-4">Access volunteer tools and features</p>
                
                <a href="qrcode.php" 
                   style="background-color: #174593;" 
                   class="btn btn-primary w-100 rounded-2 mb-3 text-decoration-none">
                    Scan QR Code
                </a>
            </div>
        </div>

        <!-- Back Link -->
        <!-- <div class="back-section">
            <a href="../index.html" 
               style="color: #174593;" 
               class="fw-semibold d-block text-decoration-none">
                Back to Login
            </a>
        </div> -->
    </div>

    <!-- JS Dependencies -->
</body>
</html>
