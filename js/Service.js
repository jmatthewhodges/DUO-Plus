/*
 ============================================================
 File:           service.js
 Description:    Handles the JS of the service scan page.
 
 Last Modified By:  Cameron
 Last Modified On:  Mar 4 @ 10:00 PM
 Changes Made:      Created File and added QR Scanned logic
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

// Station ID to Service mapping - maps specific stations to their service type
const STATION_TO_SERVICE = {
    'station1': 'medical',
    'station2': 'optical',
    'station3': 'dental',
    'station4': 'haircut'
};

// Base URL configuration for deployed environments
// Test:
const BASE_URL = 'http://localhost:8000/pages/service-scan.html';
// Production:
// const BASE_URL = 'https://duotest.swollenhippo.com/pages/service-scan.html';

// Tracking state
let currentService = 'medical'; // Default service
let videoStream = null;
let isScanning = false;


// LocalStorage management for scanned service
const ServiceStorage = {
    key: 'duo_service_scan',
    
    save: function(serviceType, stationId = null) {
        const data = {
            service: serviceType,
            stationId: stationId,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(this.key, JSON.stringify(data));
    },
    
    get: function() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : null;
    },
    
    clear: function() {
        localStorage.removeItem(this.key);
    }
};

// Parse QR code data to extract service and station info
// Expected format: "/service-scan.html?pin=111111&stationId=station1"
function parseQRData(qrData) {
    const result = {
        service: null,
        stationId: null,
        pin: null,
        raw: qrData
    };

    // Try URL format first: "?pin=111111&stationId=station1"
    try {
        const url = new URL(qrData, BASE_URL);
        
        // Validate that this QR is for service-scan page
        const pathname = url.pathname.toLowerCase();
        if (!pathname.includes('service-scan')) {
            console.error('QR code is for a different page:', pathname);
            result.error = 'This QR code is not for the service scan page';
            return result;
        }
        
        result.pin = url.searchParams.get('pin');
        // Check both 'stationId' and 'stationid' for compatibility with PHP generator
        result.stationId = url.searchParams.get('stationId') || url.searchParams.get('stationid');
        
        // Map stationId to service if it exists in our mapping
        if (result.stationId) {
            const mappedService = STATION_TO_SERVICE[result.stationId.toLowerCase()];
            if (mappedService) {
                result.service = mappedService;
            }
        }
    } catch (e) {
        // Not a full URL, try other formats
        
        // Try URL parameter format: "pin=111111&stationId=station1"
        if (qrData.includes('=')) {
            const params = new URLSearchParams(qrData);
            result.pin = params.get('pin');
            // Check both 'stationId' and 'stationid' for compatibility with PHP generator
            result.stationId = params.get('stationId') || params.get('stationid');
            
            if (result.stationId) {
                const mappedService = STATION_TO_SERVICE[result.stationId.toLowerCase()];
                if (mappedService) {
                    result.service = mappedService;
                }
            }
        }
    }
    
    return result;
}


// Show a specific service section and hide others
function showService(serviceType) {
    if (!SERVICES[serviceType]) {
        console.error(`Unknown service type: ${serviceType}`);
        Swal.fire('Error', `Unknown service: ${serviceType}`, 'error');
        return;
    }

    currentService = serviceType;

    // Show the service content container
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent) {
        serviceContent.style.display = 'block';
    }

    console.log(`Switching to service: ${serviceType}`);
}

// Hide all service sections (for when no QR has been scanned)
function hideAllServices() {
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent) {
        serviceContent.style.display = 'none';
    }
    console.log('All services hidden');
}

// Update the header with current service info
// Once HTML is modular, this will update the service name and icon
function updateServiceHeader(serviceType) {
    const service = SERVICES[serviceType];
    if (!service) return;

    console.log(`Header updated for: ${service.name}`);
    
    // Example of what this will do:
    // document.querySelector('.service-header-name').textContent = service.name;
    // document.querySelector('.service-header').className = `card-header d-flex justify-content-between align-items-center bg-${service.color} p-3`;
}


// Handle successful QR code scan
function handleQRScan(qrData) {
    const parsed = parseQRData(qrData);
    
    // Check if QR code is for a different page
    if (parsed.error) {
        console.error('QR validation failed:', parsed.error);
        Swal.fire('Wrong QR Code', parsed.error, 'error');
        return;
    }
    
    if (!parsed.service) {
        console.error('No service mapped from QR code');
        Swal.fire('Invalid QR', 'Could not identify service from QR code', 'warning');
        return;
    }

    // Save to localStorage for page reload
    ServiceStorage.save(parsed.service, parsed.stationId);
    
    showService(parsed.service);
    updateServiceHeader(parsed.service);

    Swal.fire({
        title: 'Service Selected',
        text: `${SERVICES[parsed.service].name}${parsed.stationId ? ` - ${parsed.stationId}` : ''}`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
}


// Start camera for QR scanning
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

        // Create a full-screen overlay for camera
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="bi bi-x-lg"></i> Close';
        closeBtn.className = 'btn btn-light position-absolute top-0 end-0 m-3';
        closeBtn.title = 'Stop scanning and return to main screen';
        closeBtn.onclick = stopQRScanning;

        const hint = document.createElement('div');
        hint.style.cssText = `
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            max-width: 90%;
            width: 280px;
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            text-align: center;
            z-index: 10001;
        `;
        hint.setAttribute('role', 'status');
        hint.setAttribute('aria-live', 'polite');
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
        overlay.appendChild(hint);
        container.appendChild(overlay);

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

    const overlay = document.querySelector('div[style*="position: fixed"]');
    if (overlay && overlay.querySelector('video')) {
        overlay.remove();
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const scanAgainBtn = document.getElementById('btnScan');
    
    if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', function() {
            // Clear localStorage when scanning again
            ServiceStorage.clear();
            startQRScanning();
        });
    }

    // Check if a service was previously scanned
    const savedData = ServiceStorage.get();
    
    if (savedData && SERVICES[savedData.service]) {
        // Service was previously scanned, show it without scanning
        console.log('Showing previously scanned service:', savedData.service);
        showService(savedData.service);
        updateServiceHeader(savedData.service);
    } else {
        // No previous service, hide content and start scanning
        hideAllServices();
        startQRScanning();
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseQRData, showService, handleQRScan };
}
