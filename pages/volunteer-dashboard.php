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

    <!-- Responsive Layout Styles -->
    <style>
        body {
            position: relative;
            overflow: hidden;
            height: 100vh;
        }

        .dashboard-container {
            max-width: 400px;
            width: 90%;
        }

        /* Mobile optimizations */
        @media (max-height: 700px) {
            .logo-section img {
                width: 120px !important;
                margin-bottom: 0.5rem !important;
            }
            .welcome-text {
                font-size: 1rem !important;
                margin-bottom: 0.75rem !important;
            }
            .card-body {
                padding: 1.5rem !important;
            }
            .mb-3 {
                margin-bottom: 0.75rem !important;
            }
            .mb-4 {
                margin-bottom: 1rem !important;
            }
        }

        /* Tablet and larger screens */
        @media (min-width: 768px) {
            .dashboard-container {
                max-width: 500px;
            }
            .card-body {
                padding: 3rem !important;
            }
            .logo-section img {
                width: 240px !important;
            }
            .welcome-text {
                font-size: 1.25rem !important;
            }
        }

        /* Desktop and larger */
        @media (min-width: 1200px) {
            .dashboard-container {
                max-width: 550px;
            }
        }

        /* Button hover effect */
        .btn-primary {
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .btn-primary:hover {
            background-color: #0f3468 !important;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(23, 69, 147, 0.4) !important;
        }

        .btn-primary:active {
            transform: translateY(0);
            box-shadow: 0 2px 10px rgba(23, 69, 147, 0.3) !important;
        }
    </style>
</head>
<body class="d-flex align-items-center justify-content-center vh-100">

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
