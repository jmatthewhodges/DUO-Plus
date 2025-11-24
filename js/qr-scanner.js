/**
 * QR Code Scanner JavaScript
 * Handles camera access, QR code detection, and UI updates
 * 
 * Dependencies:
 * - jsQR library for QR code detection
 * - SweetAlert2 for user notifications
 */

// =====================================================
// DOM Elements
// =====================================================
const overlay = document.getElementById('scannerOverlay');
const openBtn = document.querySelector('.scan-btn');
const closeBtn = document.getElementById('closeScanner');
const video = document.getElementById('videoPreview');
const scanMessage = document.getElementById('scanMessage');
const qrResult = document.getElementById('qrResult');

// =====================================================
// Scanner State Variables
// =====================================================
let stream = null;
let scanning = false;
let scanStartTime = null;
let lastScanTime = null;
let noScanTimeout = null;
let lastScannedCode = null;
let consecutiveFailures = 0;

// =====================================================
// Core Scanner Functions
// =====================================================

/**
 * Open Scanner Modal
 * Requests camera access and initializes QR scanning
 */
async function openScanner() {
    overlay.style.display = 'flex';
    
    try {
        // Request camera access if not already granted
        if (!stream) {
            // Force back-facing camera (environment) for mobile/tablet devices
            const constraints = {
                video: { facingMode: { exact: 'environment' } }
            };
            
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // Fallback to any available camera if back camera not found
                console.warn('Back camera not available, trying default camera');
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
            }
            
            // Set video source and start playback
            video.srcObject = stream;
            await video.play();
        }

        // Initialize scanner state
        scanning = true;
        scanStartTime = Date.now();
        lastScanTime = Date.now();
        lastScannedCode = null;
        consecutiveFailures = 0;
        qrResult.innerText = 'Scan a QR code...';
        qrResult.style.color = '#1f5fdd';
        
        // Start timeout monitoring and scan loop
        checkScanTimeout();
        scanLoop();

    } catch (err) {
        // Handle camera access errors
        console.error('Camera error:', err);
        overlay.style.display = 'none';
        
        // Show user-friendly error message
        Swal.fire({
            title: 'Camera Access Denied',
            text: 'Please enable camera permissions to scan QR codes.',
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#1f5fdd'
        });
    }
}

/**
 * Close Scanner Modal
 * Stops camera stream and resets scanner state
 */
function closeScannerOverlay() {
    // Hide overlay
    overlay.style.display = 'none';
    
    // Reset scanner state
    scanning = false;
    scanStartTime = null;
    lastScanTime = null;
    lastScannedCode = null;
    consecutiveFailures = 0;
    
    // Reset UI
    qrResult.innerText = 'Scan a QR code...';
    qrResult.style.color = '#1f5fdd';
    
    // Clear timeout
    if (noScanTimeout) {
        clearTimeout(noScanTimeout);
        noScanTimeout = null;
    }
    
    // Stop camera stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

/**
 * Check Scan Timeout
 * Monitors scanning progress and shows warning if no QR code detected
 */
function checkScanTimeout() {
    if (!scanning) return;
    
    const timeSinceLastScan = Date.now() - lastScanTime;
    
    // Show warning after 8 seconds of no QR detection
    if (timeSinceLastScan > 8000 && qrResult.innerText === 'Scan a QR code...') {
        qrResult.innerText = 'No QR code detected. Position camera over code.';
        qrResult.style.color = '#ff6b6b';
    }
    
    // Continue monitoring
    if (scanning) {
        noScanTimeout = setTimeout(checkScanTimeout, 2000);
    }
}

/**
 * Show Scan Message
 * Displays temporary success message
 * @param {string} text - Message to display
 */
function showScanMessage(text) {
    scanMessage.innerText = text;
    scanMessage.style.display = 'block';
    
    // Auto-hide after 1.5 seconds
    setTimeout(() => {
        scanMessage.style.display = 'none';
    }, 1500);
}

/**
 * Scan Loop
 * Continuously captures video frames and attempts to detect QR codes
 */
function scanLoop() {
    if (!scanning) return;
    
    // Create canvas for image processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Wait for video to be ready
    if (canvas.width === 0 || canvas.height === 0) {
        requestAnimationFrame(scanLoop);
        return;
    }
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Attempt to detect QR code
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
        
        // Continue scanning after 1 second delay
        setTimeout(scanLoop, 1000);
        return;
    } else {
        // No valid QR code found in this frame
        consecutiveFailures++;
    }
    
    // Continue scanning
    requestAnimationFrame(scanLoop);
}

// =====================================================
// Event Listeners
// =====================================================
openBtn.addEventListener('click', openScanner);
closeBtn.addEventListener('click', closeScannerOverlay);
