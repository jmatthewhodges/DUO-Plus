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
    <link href="../assets/css/hope-ui.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(to bottom, #7fb1d6, #cfe7f5);
            min-height: 100vh;
            max-height: 100vh;
            overflow-y: auto;
            padding: 20px;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .main-card {
            background: white;
            border-radius: 20px;
            padding: 25px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
            max-width: 480px;
            margin: auto;
        }
        .qr-box {
            background: #e9f0fb;
            border-radius: 18px;
            padding: 35px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .scan-btn {
            background-color: #1f5fdd;
            color: #fff;
            border-radius: 12px;
            padding: 14px;
            font-size: 18px;
            margin-top: 20px;
            width: 100%;
            border: none;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .scan-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(31, 95, 221, 0.4);
            cursor: pointer;
        }
        .scan-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 10px rgba(31, 95, 221, 0.3);
        }
        .header-bar {
            background: #1f5fdd;
            padding: 14px;
            border-radius: 16px 16px 0 0;
            color: white;
            font-size: 20px;
            font-weight: 600;
            text-align: left;
            margin-top: 40px;
        }
        .logo {
            width: 210px;
            display: block;
            margin: 0 auto 20px auto;
        }
        #scanMessage {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f5fdd;
            color: white;
            padding: 10px 18px;
            border-radius: 12px;
            font-weight: 600;
            display: none;
            z-index: 10001;
        }
        #qrResult {
            margin-top: 15px;
            background: #f5f7ff;
            border-radius: 12px;
            padding: 12px;
            font-weight: 600;
            color: #1f5fdd;
            min-height: 40px;
        }
        .back-btn {
            background-color: #1f5fdd;
            color: #fff;
            border-radius: 12px;
            padding: 14px;
            font-size: 18px;
            margin-top: 15px;
            width: 100%;
            border: none;
            transition: all 0.3s ease;
            text-decoration: none;
            display: block;
            text-align: center;
            font-weight: 600;
            position: relative;
            overflow: hidden;
        }
        .back-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(31, 95, 221, 0.4);
            color: #fff;
        }
        .back-btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 10px rgba(31, 95, 221, 0.3);
        }

        /* Mobile optimizations */
        @media (max-height: 700px) {
            body {
                padding: 10px;
            }
            .main-card {
                padding: 15px;
            }
            .logo {
                width: 140px !important;
                margin-bottom: 10px !important;
            }
            h5 {
                font-size: 1rem !important;
            }
            .row .col-6, .row .col-12 {
                margin-bottom: 8px !important;
            }
            .row .col-6 > div, .row .col-12 > div {
                padding: 10px !important;
            }
            .row h3, .row h4 {
                font-size: 1.2rem !important;
            }
            .row span {
                font-size: 12px !important;
            }
            .scan-btn, .back-btn {
                padding: 10px !important;
                font-size: 16px !important;
                margin-top: 10px !important;
            }
        }

        /* Tablet and larger screens */
        @media (min-width: 768px) {
            .main-card {
                max-width: 550px;
                padding: 35px;
            }
            .logo {
                width: 250px !important;
            }
        }

        /* Desktop */
        @media (min-width: 1200px) {
            .main-card {
                max-width: 600px;
            }
        }
    </style>
</head>
<body>
    <div class="main-card text-center">
        <img src="../assets/images/DUOPlusDropLogo.png" alt="DUO Logo" class="logo">
        <div class="p-3 mb-4" style="background:white; border-radius:20px; box-shadow:0 6px 20px rgba(0,0,0,0.1); text-align:left;">
            <h5 style="color:#1f5fdd; font-weight:600;">Medical</h5>
            <div class="row mt-3">
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Waitlist</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">23</h3>
                    </div>
                </div>
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">In Progress</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">4</h3>
                    </div>
                </div>
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Completed</span>
                        <h3 class="mt-1" style="color:#1f5fdd; font-weight:700;">15</h3>
                    </div>
                </div>
                <div class="col-6 mb-3">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Avg. Service Time</span>
                        <h4 class="mt-1" style="color:#1f5fdd; font-weight:700;">20 min</h4>
                    </div>
                </div>
                <div class="col-12">
                    <div style="background:#f5f7ff; padding:14px; border-radius:14px; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                        <span style="font-size:14px; color:#637081;">Past Avg. Service Time</span>
                        <h4 class="mt-1" style="color:#1f5fdd; font-weight:700;">34 min</h4>
                    </div>
                </div>
            </div>
        </div>
        <button class="scan-btn">Open Scanner</button>
        <a href="volunteer-dashboard.php" class="back-btn">Back to Dashboard</a>
    </div>
    <div id="scannerOverlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55); backdrop-filter:blur(3px); z-index:9999; align-items:center; justify-content:center;">
        <div style="background:white; width:90%; max-width:420px; padding:20px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.25); text-align:center; position:relative;">
            <h4 style="color:#1f5fdd; font-weight:700; margin-bottom:18px;">QR Scanner</h4>
            <video id="videoPreview" style="width:100%; border-radius:14px; background:black;"></video>
            <div id="qrResult">Scan a QR code...</div>
            <button id="closeScanner" style="margin-top:18px; background:#1f5fdd; border:none; padding:12px 18px; border-radius:10px; color:white; width:100%; font-size:17px; font-weight:600;">Close</button>
            <div id="scanMessage"></div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
    <script>
        const overlay = document.getElementById('scannerOverlay');
        const openBtn = document.querySelector('.scan-btn');
        const closeBtn = document.getElementById('closeScanner');
        const video = document.getElementById('videoPreview');
        const scanMessage = document.getElementById('scanMessage');
        const qrResult = document.getElementById('qrResult');
        let stream;
        let scanning = false;
        let scanStartTime = null;
        let lastScanTime = null;
        let noScanTimeout = null;
        let lastScannedCode = null;
        let consecutiveFailures = 0;

        async function openScanner() {
            overlay.style.display = 'flex';
            try {
                if (!stream) {
                    // Force back-facing camera (environment) for mobile/tablet
                    const constraints = {
                        video: {
                            facingMode: { exact: 'environment' }
                        }
                    };
                    
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                    } catch (err) {
                        // Fallback if exact environment camera not available
                        console.warn('Exact environment camera not available, trying default');
                        stream = await navigator.mediaDevices.getUserMedia({ 
                            video: { facingMode: 'environment' } 
                        });
                    }
                    
                    video.srcObject = stream;
                    await video.play();
                }
                scanning = true;
                scanStartTime = Date.now();
                lastScanTime = Date.now();
                lastScannedCode = null;
                consecutiveFailures = 0;
                qrResult.innerText = 'Scan a QR code...';
                qrResult.style.color = '#1f5fdd';
                
                // Start timeout checker
                checkScanTimeout();
                scanLoop();
            } catch (err) {
                console.error('Camera error:', err);
                overlay.style.display = 'none';
                
                // Show SweetAlert for camera access denial
                Swal.fire({
                    title: 'Camera Access Denied',
                    text: 'Please enable camera permissions to scan QR codes.',
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#1f5fdd'
                });
            }
        }

        function closeScannerOverlay() {
            overlay.style.display = 'none';
            scanning = false;
            scanStartTime = null;
            lastScanTime = null;
            lastScannedCode = null;
            consecutiveFailures = 0;
            qrResult.innerText = 'Scan a QR code...';
            qrResult.style.color = '#1f5fdd';
            
            if (noScanTimeout) {
                clearTimeout(noScanTimeout);
                noScanTimeout = null;
            }
            
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                stream = null;
            }
        }

        function checkScanTimeout() {
            if (!scanning) return;
            
            const timeSinceStart = Date.now() - scanStartTime;
            const timeSinceLastScan = Date.now() - lastScanTime;
            
            // After 8 seconds of no QR detection, show warning
            if (timeSinceLastScan > 8000 && qrResult.innerText === 'Scan a QR code...') {
                qrResult.innerText = 'No QR code detected. Position camera over code.';
                qrResult.style.color = '#ff6b6b';
            }
            
            if (scanning) {
                noScanTimeout = setTimeout(checkScanTimeout, 2000);
            }
        }

        function showScanMessage(text) {
            scanMessage.innerText = text;
            scanMessage.style.display = 'block';
            setTimeout(() => {
                scanMessage.style.display = 'none';
            }, 1500);
        }

        function scanLoop() {
            if (!scanning) return;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (canvas.width === 0 || canvas.height === 0) {
                requestAnimationFrame(scanLoop);
                return;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            
            if (code && code.data && code.data.trim().length > 0) {
                // Valid QR code found with actual data
                consecutiveFailures = 0;
                
                // Only show message and update if it's a new/different code
                if (lastScannedCode !== code.data) {
                    lastScannedCode = code.data;
                    qrResult.innerText = code.data;
                    qrResult.style.color = '#1f5fdd';
                    showScanMessage('QR Code Scanned!');
                    lastScanTime = Date.now();
                    
                    // Log for debugging
                    console.log('QR Code Scanned:', code.data);
                }
                
                // Continue scanning after 1 second
                setTimeout(scanLoop, 1000);
                return;
            } else {
                // No valid QR code found in this frame
                consecutiveFailures++;
            }
            
            requestAnimationFrame(scanLoop);
        }

        openBtn.addEventListener('click', openScanner);
        closeBtn.addEventListener('click', closeScannerOverlay);
    </script>
</body>
</html>