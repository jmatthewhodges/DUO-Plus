/*
 ============================================================
 File:           Service.js
 Description:    Handles service-specific content display
                 based on stationId from QR code URL params.
                 stationId values: medical, optical, dental, haircut
                 Works with pinCode.js security layer.
 
 Last Modified By:  Cameron
 Last Modified On:  Mar 4 @ 11:00 PM
 Changes Made:      Updated to use station names as stationId values
 ============================================================
*/

// Service configuration
const SERVICES = {
    medical: {
        name: 'Medical',
        icon: 'bi-heart-pulse',
        color: 'primary'
    },
    optical: {
        name: 'Optical',
        icon: 'bi-eye',
        color: 'info'
    },
    dental: {
        name: 'Dental',
        icon: 'bi-brightness-high',
        color: 'warning'
    },
    haircut: {
        name: 'Haircut',
        icon: 'bi-scissors',
        color: 'success'
    }
};

// Valid station names: medical, optical, dental, haircut

let videoStream = null;
let isScanning = false;
let currentOverlay = null;

/**
 * Show a specific service's content section
 */
function showService(serviceKey) {
    console.log(`showService called with: ${serviceKey}`);
    
    // Service data configuration
    const serviceData = {
        medical: {
            title: 'Medical',
            color: 'primary',
            stat1: { label: 'Waitlist', value: '23' },
            stat2: { label: 'In Progress', value: '4' },
            stat3: { label: 'Completed', value: '15' },
            avgTime: '20 minutes',
            pastAvgTime: '34 minutes'
        },
        optical: {
            title: 'Optical',
            color: 'primary',
            stat1: { label: 'Waitlist', value: '12' },
            stat2: { label: 'In Progress', value: '2' },
            stat3: { label: 'Completed', value: '8' },
            avgTime: '15 minutes',
            pastAvgTime: '18 minutes'
        },
        dental: {
            title: 'Dental',
            color: 'primary',
            stat1: { label: 'Waitlist', value: '18' },
            stat2: { label: 'In Progress', value: '3' },
            stat3: { label: 'Completed', value: '22' },
            avgTime: '45 minutes',
            pastAvgTime: '52 minutes'
        },
        haircut: {
            title: 'Haircut',
            color: 'primary',
            stat1: { label: 'Waitlist', value: '9' },
            stat2: { label: 'In Progress', value: '1' },
            stat3: { label: 'Completed', value: '11' },
            avgTime: '20 minutes',
            pastAvgTime: '22 minutes'
        }
    };

    const data = serviceData[serviceKey];
    if (!data) {
        console.error('Invalid service:', serviceKey);
        return;
    }

    // Update the service title
    const titleEl = document.getElementById('serviceTitle');
    if (titleEl) titleEl.textContent = data.title;

    // Update the service header background color
    const headerEl = document.getElementById('serviceHeader');
    if (headerEl) {
        headerEl.className = `card-header d-flex justify-content-between align-items-center bg-${data.color} p-3`;
    }

    // Update stats
    const stat1LabelEl = document.getElementById('stat1Label');
    const stat1ValueEl = document.getElementById('stat1Value');
    if (stat1LabelEl) stat1LabelEl.textContent = data.stat1.label;
    if (stat1ValueEl) stat1ValueEl.textContent = data.stat1.value;

    const stat2LabelEl = document.getElementById('stat2Label');
    const stat2ValueEl = document.getElementById('stat2Value');
    if (stat2LabelEl) stat2LabelEl.textContent = data.stat2.label;
    if (stat2ValueEl) stat2ValueEl.textContent = data.stat2.value;

    const stat3LabelEl = document.getElementById('stat3Label');
    const stat3ValueEl = document.getElementById('stat3Value');
    if (stat3LabelEl) stat3LabelEl.textContent = data.stat3.label;
    if (stat3ValueEl) stat3ValueEl.textContent = data.stat3.value;

    // Update times
    const avgTimeEl = document.getElementById('avgTime');
    const pastAvgTimeEl = document.getElementById('pastAvgTime');
    if (avgTimeEl) avgTimeEl.textContent = data.avgTime;
    if (pastAvgTimeEl) pastAvgTimeEl.textContent = data.pastAvgTime;

    // Update waitlist title
    const waitlistTitleEl = document.getElementById('waitlistTitle');
    if (waitlistTitleEl) waitlistTitleEl.textContent = `${data.title} - Waitlist`;

    // Show the service content if it's hidden
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent && serviceContent.style.display === 'none') {
        serviceContent.style.display = 'block';
    }

    // Scroll to top so user can see the service
    window.scrollTo(0, 0);

    console.log(`Service displayed: ${serviceKey}`);
}




// Show service selection dropdown for manual entry
function showServiceSelectionDropdown() {
    // Stop QR scanning first
    stopQRScanning();
    
    let html = '<div class="d-grid gap-2">';
    Object.entries(SERVICES).forEach(([serviceKey, serviceData]) => {
        html += `<button class="btn btn-outline-primary service-select-btn" data-service="${serviceKey}">${serviceData.name}</button>`;
    });
    html += '</div>';

    Swal.fire({
        title: 'Select Service',
        html: html,
        showConfirmButton: false,
        allowOutsideClick: true,
        allowEscapeKey: true,
        didOpen: (modal) => {
            // Add click handlers to buttons
            modal.querySelectorAll('.service-select-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const serviceKey = this.getAttribute('data-service');
                    Swal.close();
                    selectServiceManual(serviceKey);
                });
            });
        }
    });
}

// Select service from manual dropdown
function selectServiceManual(serviceKey) {
    console.log('selectServiceManual called for:', serviceKey);
    Swal.close();
    showService(serviceKey);
}


// Start QR code camera scanning
function startQRScanning() {
    if (isScanning) return;
    
    isScanning = true;
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    const container = document.body;

    // Request camera access
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
    }).then(stream => {
        videoStream = stream;
        video.srcObject = stream;
        video.play();

        // Create full-screen overlay for camera
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="bi bi-x-lg"></i> Close';
        closeBtn.className = 'btn btn-light position-absolute top-0 end-0 m-3';
        closeBtn.title = 'Stop scanning';
        closeBtn.style.pointerEvents = 'auto';
        closeBtn.type = 'button';
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            stopQRScanning();
        };

        const manualBtn = document.createElement('button');
        manualBtn.innerHTML = 'Manual Entry';
        manualBtn.className = 'btn btn-secondary position-absolute bottom-0 start-0 m-3';
        manualBtn.title = 'Select service manually';
        manualBtn.style.pointerEvents = 'auto';
        manualBtn.type = 'button';
        manualBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Manual Entry button clicked');
            showServiceSelectionDropdown();
        };

        const hint = document.createElement('div');
        hint.style.cssText = `
            position: absolute;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            max-width: 90%;
            width: 280px;
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            text-align: center;
        `;
        hint.innerHTML = `
            <div style="margin-bottom: 12px;">
                <i class="bi bi-qr-code-scan" style="font-size: 32px; color: #174593;"></i>
            </div>
            <h2 style="font-size: 18px; margin: 0 0 8px 0; font-weight: 600; color: #174593;">Scan QR Code</h2>
            <p style="font-size: 14px; margin: 0; color: #666; line-height: 1.4;">Point camera at QR code</p>
        `;

        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;

        overlay.appendChild(video);
        overlay.appendChild(closeBtn);
        overlay.appendChild(manualBtn);
        overlay.appendChild(hint);
        container.appendChild(overlay);
        
        // Store reference so we can reliably remove it later
        currentOverlay = overlay;

        // Scanning loop
        const scanLoop = setInterval(() => {
            if (!isScanning) {
                clearInterval(scanLoop);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code) {
                stopQRScanning();
                handleQRScan(code.data);
            }
        }, 100);

    }).catch(err => {
        isScanning = false;
        Swal.fire('Camera Error', 'Unable to access camera. Check permissions.', 'error');
        console.error('Camera error:', err);
    });
}

// Stop QR scanning and clean up
function stopQRScanning() {
    isScanning = false;
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    // Remove overlay using stored reference
    if (currentOverlay) {
        console.log('Removing overlay');
        currentOverlay.remove();
        currentOverlay = null;
    }

    // Fallback if overlay wasn't stored for some reason
    const overlay = document.querySelector('div[style*="position: fixed"][style*="z-index: 9999"]');
    if (overlay) {
        console.log('Removing overlay via selector');
        overlay.remove();
    }
}

// Handle QR code scan
function handleQRScan(qrData) {
    console.log('QR scanned:', qrData);
    
    try {
        // Try to parse as URL
        const url = new URL(qrData, window.location.href);
        
        // Get stationId from URL parameters
        const stationId = url.searchParams.get('stationId') || url.searchParams.get('stationid');
        const pathname = url.pathname.toLowerCase();
        
        // Check if URL is for service-scan page
        if (!pathname.includes('service-scan')) {
            console.error('Not a service-scan URL');
            Swal.fire('Invalid QR', 'QR code is not for service selection', 'warning');
            startQRScanning();
            return;
        }
        
        // Check if stationId is present
        if (!stationId) {
            console.error('Missing stationId in QR');
            Swal.fire('Invalid QR', 'QR code missing station information', 'warning');
            startQRScanning();
            return;
        }

        // Check if station exists in SERVICES config
        if (!SERVICES[stationId.toLowerCase()]) {
            console.error('Unknown station:', stationId);
            Swal.fire('Invalid QR', 'Unknown station: ' + stationId, 'warning');
            startQRScanning();
            return;
        }

        // Use stationId directly as service key
        const serviceKey = stationId.toLowerCase();

        showService(serviceKey);

    } catch (e) {
        console.error('QR parse error:', e);
        Swal.fire('Invalid QR', 'Could not parse QR code', 'warning');
        startQRScanning();
    }
}

// Start scanning after PIN verification
document.addEventListener('pinVerified', function() {
    console.log('PIN verified - checking for stationId');
    
    // Get stationId from URL if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const stationId = urlParams.get('stationId') || urlParams.get('stationid');
    
    if (stationId) {
        // Direct to service based on URL parameter
        console.log('StationId found in URL:', stationId);
        handleServiceSelection(stationId);
    } else {
        // No stationId, start QR scanner
        console.log('No stationId - starting QR scanner');
        startQRScanning();
    }
});


// Handle service selection from stationId
function handleServiceSelection(stationId) {
    const serviceKey = stationId.toLowerCase();

    // Check if station exists in SERVICES config
    if (!SERVICES[serviceKey]) {
        console.error('Unknown station:', stationId);
        Swal.fire('Invalid Station', 'Unknown station: ' + stationId, 'warning');
        startQRScanning();
        return;
    }

    // Show the service directly
    showService(serviceKey);
}


// If page reloads after PIN verification, check for stationId
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - Service.js loaded');
    
    if (document.body.classList.contains('pin-verified')) {
        console.log('Already pin-verified, checking for stationId');
        const urlParams = new URLSearchParams(window.location.search);
        const stationId = urlParams.get('stationId') || urlParams.get('stationid');
        
        if (stationId) {
            setTimeout(() => handleServiceSelection(stationId), 100);
        } else {
            setTimeout(startQRScanning, 100);
        }
    }
});


