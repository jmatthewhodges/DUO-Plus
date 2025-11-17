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
    <title>DUO QR Code</title>
    <link href="../assets/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/hope-ui.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(to bottom, #7fb1d6, #cfe7f5);
            min-height: 100vh;
            padding: 20px;
            font-family: 'Inter', sans-serif;
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
    <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
    <script>
        const overlay = document.getElementById('scannerOverlay');
        const openBtn = document.querySelector('.scan-btn');
        const closeBtn = document.getElementById('closeScanner');
        const video = document.getElementById('videoPreview');
        const scanMessage = document.getElementById('scanMessage');
        const qrResult = document.getElementById('qrResult');
        let stream; let scanning = false;
        async function openScanner() {
            overlay.style.display = 'flex';
            try {
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    video.srcObject = stream; await video.play();
                }
                scanning = true; qrResult.innerText = 'Scan a QR code...'; scanLoop();
            } catch (err) {
                alert('Camera access denied or unavailable. Use HTTPS or localhost.');
                overlay.style.display = 'none';
            }
        }
        function closeScannerOverlay() {
            overlay.style.display = 'none'; scanning = false; qrResult.innerText = 'Scan a QR code...';
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        }
        function showScanMessage(text) { scanMessage.innerText = text; scanMessage.style.display='block'; setTimeout(()=>{scanMessage.style.display='none';},1500); }
        function scanLoop() {
            if (!scanning) return;
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video,0,0,canvas.width,canvas.height);
            const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            if (code) { qrResult.innerText = code.data; showScanMessage('QR Code Scanned!'); setTimeout(scanLoop,1000); return; }
            requestAnimationFrame(scanLoop);
        }
        openBtn.addEventListener('click', openScanner); closeBtn.addEventListener('click', closeScannerOverlay);
    </script>
</body>
</html>