<?php
/**
 * QR Code Scanning Page
 * Protected page - requires authentication
 */

require_once __DIR__ . '/../api/auth-check.php';
$userName = $_SESSION['user_name'] ?? 'Volunteer';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DUO+ | Check-in</title>
    <link rel="icon" type="image/x-icon" href="../assets/favicon.ico">
    
    <!-- External CSS -->
    <link href="../assets/css/hope-ui.min.css" rel="stylesheet">
    <link href="../assets/css/custom.css" rel="stylesheet">
</head>

<body class="page-qrcode">
    <!-- Main Dashboard Card -->
    <div class="main-card text-center">
        <!-- Logo -->
        <img src="../assets/images/DUOPlusDropLogo.png" alt="DUO Logo" class="logo">
        
        <!-- Medical Statistics Dashboard -->
        <div class="p-3 mb-4" style="background:white; border-radius:20px; box-shadow:0 6px 20px rgba(0,0,0,0.1); text-align:left;">
            <h5 style="color:#1f5fdd; font-weight:600;">Medical</h5>
            <!-- Statistics Grid -->
            <div class="row mt-3">
                <!-- Waitlist Count -->
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Waitlist</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">23</h3>
                    </div>
                </div>

                <!-- In Progress Count -->
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">In Progress</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">4</h3>
                    </div>
                </div>

                <!-- Completed Count -->
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Completed</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">15</h3>
                    </div>
                </div>

                <!-- Average Service Time -->
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Avg. Service Time</span>
                        <h4 class="mt-1" style="color:#1f5fdd; font-weight:700;">20 min</h4>
                    </div>
                </div>

                <!-- Past Average Service Time -->
                <div class="col-12">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Past Avg. Service Time</span>
                        <h4 class="mt-1" style="color:#1f5fdd; font-weight:700;">34 min</h4>
                    </div>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <button class="scan-btn">Open Scanner</button>
        <button class="back-btn" onclick="window.location.href='volunteer-dashboard.php'">Back to Dashboard</button>
    </div>

    <!-- QR Scanner Overlay Modal -->
    <div id="scannerOverlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); backdrop-filter:blur(3px); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:white; width:90%; max-width:420px; padding:20px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.25); text-align:center; position:relative;">
            <h4 style="color:#1f5fdd; font-weight:700; margin-bottom:18px;">QR Scanner</h4>
            
            <!-- Video Preview -->
            <video id="videoPreview" style="width:100%; border-radius:14px; background:black;"></video>
            
            <!-- Scan Result Display -->
            <div id="qrResult">Scan a QR code...</div>
            
            <!-- Close Button -->
            <button id="closeScanner" style="margin-top:18px; background:#1f5fdd; border:none; padding:12px 18px; border-radius:10px; color:white; width:100%; font-size:17px; font-weight:600;">Close</button>
            
            <!-- Scan Status Message -->
            <div id="scanMessage"></div>
        </div>
    </div>
    <!-- External JavaScript Libraries -->
    <script src="../assets/js/alerts/sweetalert2.all.min.js"></script>
    <script src="../assets/js/jsQR.js"></script>
    <script src="../js/qr-scanner.js"></script>
</body>
</html>