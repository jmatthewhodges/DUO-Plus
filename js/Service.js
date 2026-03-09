/*
 ============================================================
 File:           Service.js
 Description:    Handles service-specific content display based on 
                 ServiceID from QR code URL params. Also handles
                 client check-in/check-out via QR code scanning or
                 manual client ID entry through Update buttons.
                 ServiceID values: medical, optical, dental, haircut
                 Works with pinCode.js security layer.
 
 Last Modified By:  Cameron
 Last Modified On:  Mar 5 @ 6:00 PM
 Changes Made:      Added API endpoint guidance IDK if its needed but its there
 
=============================================================

 API ENDPOINTS TO BE IMPLEMENTED:
 
 1. SEARCH CLIENTS (lines ~920)
    Purpose: Search waiting room for available clients by name/ID
    Current temp call path: /api/searchWaitingRoomClients.php
    Expected returns: { success: true, clients: [{id, name, dob}, ...] }
    
 2. CHECK CLIENT ASSIGNMENT (lines ~1030)
    Purpose: Verify if client is already assigned to another service
    Current temp call path: /api/checkClientAssignment.php
    Expected returns: { assigned: false } or { assigned: true, assignedService: "{service}" }
    
 3. ADD CLIENT TO SERVICE (lines ~1055)
    Purpose: Add waiting room client to a service, remove from pool
    Current temp call path: /api/addClientToService.php
    Expected request: POST with body { clientId, serviceKey }
    Expected returns: { success: true, message: "Client added" }
    
 4. GET SERVICE STATS — IMPLEMENTED via /api/GrabService.php
    Purpose: Fetch stats (counts + avg time) and waitlist for one or more services
    Endpoint: /api/GrabService.php?ServiceID=medicalExam,medicalFollowUp
    Returns: { success, pendingCount, inProgressCount, completedCount, avgServiceTime, waitList }
    
 5. SERVICE SCAN (CHECK-IN / CHECK-OUT) — IMPLEMENTED via /api/ServiceScan.php
    Purpose: Auto-progress a client's service status (Pending→In-Progress or In-Progress→Complete)
    Endpoint: POST /api/ServiceScan.php  body: { ClientID, ServiceID }
    Returns: { success, message, VisitServiceID, newStatus }
    
 NOTE: All endpoint paths above are placeholders.
       Backend developer should implement with preferred naming/structure.
       Update the fetch URLs in comments throughout the file to match actual endpoints.
 
 ============================================================
*/

// Spin a refresh button's arrow icon while a promise is pending, then restore it
function spinRefreshBtn(btn, promise) {
    if (!btn) return promise;
    const icon = btn.querySelector('.bi-arrow-clockwise');
    btn.disabled = true;
    if (icon) icon.classList.add('spin-refresh');
    const minDelay = new Promise(r => setTimeout(r, 600));
    return Promise.all([promise, minDelay]).finally(() => {
        if (icon) icon.classList.remove('spin-refresh');
        btn.disabled = false;
    });
}

// Format a YYYY-MM-DD date string to MM/DD/YYYY to match other dashboards
function formatDOB(dateString) {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return dateString;
}

// Service configuration — loaded from API at init, populated by loadServiceHierarchy()
let SERVICES = {};

// In-memory waitlist per service station (keyed by category ServiceID)
let SERVICE_WAITLISTS = {};

// Friendly short labels for sub-services (built from API data)
let SUB_SERVICE_LABELS = {};

// Loads service hierarchy from /api/services.php and builds SERVICES, SERVICE_WAITLISTS, and SUB_SERVICE_LABELS
async function loadServiceHierarchy() {
    try {
        const res = await fetch('/api/services.php?view=hierarchy');
        const json = await res.json();
        if (!json.success || !json.hierarchy) {
            console.error('Failed to load service hierarchy');
            return;
        }

        SERVICES = {};
        SERVICE_WAITLISTS = {};
        SUB_SERVICE_LABELS = {};

        json.hierarchy.forEach(cat => {
            const key = cat.ServiceID;
            const children = cat.children || [];

            // If category has children, serviceIDs = child IDs
            // If no children, serviceIDs = [category ID itself] (standalone like optical, haircut)
            const serviceIDs = children.length > 0
                ? children.map(c => c.ServiceID)
                : [key];

            SERVICES[key] = {
                name: cat.ServiceName,
                iconTag: cat.IconTag || 'bi-circle',
                color: 'primary',
                serviceIDs: serviceIDs,
            };

            SERVICE_WAITLISTS[key] = {};

            // Build sub-service labels from child ServiceName
            // Strip the parent name prefix if present (e.g. "Dental Hygiene" → "Hygiene")
            children.forEach(child => {
                let label = child.ServiceName;
                if (label.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                    label = label.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                }
                SUB_SERVICE_LABELS[child.ServiceID] = label || child.ServiceName;
            });
        });

        console.log('Service hierarchy loaded:', Object.keys(SERVICES));
    } catch (err) {
        console.error('Error loading service hierarchy:', err);
    }
}

let videoStream = null;
let isScanning = false;
let currentOverlay = null;
let currentServiceKey = null;  // Track current service for client operations
let isClientScan = false;  // Flag to distinguish between service and client QR scans

// Show a specific service's content section
function showService(serviceKey) {
    console.log(`showService called with: ${serviceKey}`);

    // Store current service for client operations
    currentServiceKey = serviceKey;

    const service = SERVICES[serviceKey];
    if (!service) {
        console.error('Invalid service:', serviceKey);
        return;
    }

    // Update the service title
    const titleEl = document.getElementById('serviceTitle');
    if (titleEl) titleEl.textContent = service.name;

    // Update the service header background color
    const headerEl = document.getElementById('serviceHeader');
    if (headerEl) {
        headerEl.className = `card-header d-flex justify-content-between align-items-center bg-${service.color} p-3`;
    }

    // Set stat labels
    const stat1LabelEl = document.getElementById('stat1Label');
    const stat2LabelEl = document.getElementById('stat2Label');
    const stat3LabelEl = document.getElementById('stat3Label');
    if (stat1LabelEl) stat1LabelEl.textContent = 'Waitlist';
    if (stat2LabelEl) stat2LabelEl.textContent = 'In Progress';
    if (stat3LabelEl) stat3LabelEl.textContent = 'Completed';

    // Update waitlist title
    const waitlistTitleEl = document.getElementById('waitlistTitle');
    if (waitlistTitleEl) waitlistTitleEl.textContent = `${service.name} - Waitlist`;

    // Fetch live stats and waitlist from GrabService API
    fetchServiceData(serviceKey);

    // Show the service content if it's hidden
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent && serviceContent.style.display === 'none') {
        serviceContent.style.display = 'block';
    }

    // Scroll to top so user can see the service
    window.scrollTo(0, 0);

    console.log(`Service displayed: ${serviceKey}`);
}

// Fetch live service data (stats + waitlist) from GrabService.php
async function fetchServiceData(serviceKey) {
    const service = SERVICES[serviceKey];
    if (!service || !service.serviceIDs) return;

    try {
        const ids = service.serviceIDs.join(',');
        const response = await fetch(`/api/GrabService.php?ServiceID=${encodeURIComponent(ids)}`);

        if (!response.ok) {
            console.error(`Failed to fetch service data: ${response.status}`);
            return;
        }

        const data = await response.json();
        if (!data.success) {
            console.error('GrabService API error:', data.error);
            return;
        }

        // Update stat values
        const stat1ValueEl = document.getElementById('stat1Value');
        const stat2ValueEl = document.getElementById('stat2Value');
        const stat3ValueEl = document.getElementById('stat3Value');
        if (stat1ValueEl) stat1ValueEl.textContent = data.pendingCount;
        if (stat2ValueEl) stat2ValueEl.textContent = data.inProgressCount;
        if (stat3ValueEl) stat3ValueEl.textContent = data.completedCount;

        // Update average service time
        const avgTimeEl = document.getElementById('avgTime');
        if (avgTimeEl) {
            avgTimeEl.textContent = data.avgServiceTime ? `${data.avgServiceTime} minutes` : 'N/A';
        }

        // Normalize API waitlist into local format and populate table
        SERVICE_WAITLISTS[serviceKey] = {};
        (data.waitList || []).forEach(client => {
            const fullName = [client.FirstName, client.MiddleInitial, client.LastName]
                .filter(Boolean)
                .join(' ');
            // Map API ServiceStatus to local status
            let status = 'waiting';
            if (client.ServiceStatus === 'In-Progress') status = 'in-progress';
            SERVICE_WAITLISTS[serviceKey][client.ClientID] = {
                id: client.ClientID,
                name: fullName,
                dob: client.DOB,
                status: status,
                serviceID: client.ServiceID
            };
        });

        populateWaitlist();
        console.log(`Service data updated for ${serviceKey}`);
    } catch (error) {
        console.error('Error fetching service data:', error);
        const avgTimeEl = document.getElementById('avgTime');
        if (avgTimeEl) avgTimeEl.textContent = 'N/A';
    }
}


// Show service selection dropdown for manual entry
// If required=true, user cannot dismiss without selecting a service
function showServiceSelectionDropdown(required = false) {
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
        allowOutsideClick: !required,
        allowEscapeKey: !required,
        didOpen: (modal) => {
            // Prevent auto-focus so a residual keypress doesn't insta-select the first button
            if (document.activeElement) document.activeElement.blur();

            // Add click handlers to buttons
            modal.querySelectorAll('.service-select-btn').forEach(btn => {
                btn.addEventListener('click', function () {
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


// Show a pre-permission screen explaining why camera access is needed
// Skips the modal if camera permission is already granted
async function showCameraPermissionScreen() {
    try {
        const permStatus = await navigator.permissions.query({ name: 'camera' });
        if (permStatus.state === 'granted') {
            startQRScanning();
            return;
        }
    } catch (e) {
        // Permissions API not supported — fall through to show the modal
    }

    Swal.fire({
        html: `
            <div style="padding: 10px 0;">
                <div style="margin-bottom: 20px;">
                    <i class="bi bi-camera-video" style="font-size: 48px; color: #174593;"></i>
                </div>
                <h2 style="font-size: 1.4rem; font-weight: 700; color: #174593; margin-bottom: 12px;">Camera Access Needed</h2>
                <p style="color: #555; line-height: 1.6; margin-bottom: 16px;">
                    We use your camera to scan QR codes at each service station and on client badges for quick check-in and check-out.
                </p>
                <div style="text-align: left; background: #f0f4ff; border-radius: 10px; padding: 16px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="bi bi-qr-code-scan" style="font-size: 1.2rem; color: #174593;"></i>
                        <span style="font-size: 0.95rem;"><strong>Station QR</strong> &mdash; Identify which service station you're at</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="bi bi-person-badge" style="font-size: 1.2rem; color: #174593;"></i>
                        <span style="font-size: 0.95rem;"><strong>Client Badge</strong> &mdash; Scan to check clients in &amp; out</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="bi bi-shield-lock" style="font-size: 1.2rem; color: #174593;"></i>
                        <span style="font-size: 0.95rem;"><strong>Private</strong> &mdash; Camera is only used locally, nothing is recorded</span>
                    </div>
                </div>
            </div>
        `,
        confirmButtonText: '<i class="bi bi-camera-video me-2"></i>Allow Camera',
        confirmButtonColor: '#174593',
        showDenyButton: true,
        denyButtonText: 'Continue without camera',
        denyButtonColor: '#6c757d',
        allowOutsideClick: false,
        allowEscapeKey: false
    }).then((result) => {
        if (result.isConfirmed) {
            startQRScanning();
        } else {
            showCameraRecommendation();
            showServiceSelectionDropdown(true);
        }
    });
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
            // If no service selected yet, force the selection modal
            if (!currentServiceKey) {
                showServiceSelectionDropdown(true);
            }
        };

        const manualBtn = document.createElement('button');
        manualBtn.innerHTML = 'Manual Select';
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
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
        console.error('Camera error:', err);
        showCameraRecommendation();
        showServiceSelectionDropdown(true);
    });
}

// Show a persistent banner recommending camera usage for QR scanning
function showCameraRecommendation() {
    if (document.getElementById('cameraRecBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'cameraRecBanner';
    banner.className = 'alert alert-warning d-flex align-items-center gap-2 mb-3';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
        <i class="bi bi-camera-video-off" style="font-size: 1.2rem;"></i>
        <div class="small">
            <strong>Camera not available.</strong> For the best experience, enable camera permissions to scan QR codes.
            <a href="#" id="enableCamLink" style="margin-left: 4px; font-weight: 600;">Enable Cam</a>
        </div>
    `;
    banner.querySelector('#enableCamLink').addEventListener('click', function (e) {
        e.preventDefault();
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                // Camera works — stop the test stream and remove the banner
                stream.getTracks().forEach(track => track.stop());
                banner.remove();
            })
            .catch(() => {
                Swal.fire({
                    icon: 'info',
                    title: 'Enable Camera',
                    html: `
                        <div style="text-align: left; line-height: 1.7;">
                            <p>Your browser has blocked camera access. To re-enable it:</p>
                            <ol style="padding-left: 20px;">
                                <li>Tap the <strong>lock icon</strong> <i class="bi bi-lock"></i> (or camera icon) in your address bar</li>
                                <li>Find <strong>Camera</strong> and change it to <strong>Allow</strong></li>
                                <li>Reload the page</li>
                            </ol>
                        </div>
                    `,
                    confirmButtonText: 'Got it',
                    confirmButtonColor: '#174593'
                });
            });
    });
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent) {
        serviceContent.insertBefore(banner, serviceContent.firstChild);
    }
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

        // Get ServiceID from URL parameters
        const serviceID = url.searchParams.get('ServiceID') || url.searchParams.get('serviceid');
        const pathname = url.pathname.toLowerCase();

        // Check if URL is for service-scan page
        if (!pathname.includes('service-scan')) {
            console.error('Not a service-scan URL');
            Swal.fire('Invalid QR', 'QR code is not for service selection', 'warning');
            startQRScanning();
            return;
        }

        // Check if ServiceID is present
        if (!serviceID) {
            console.error('Missing ServiceID in QR');
            Swal.fire('Invalid QR', 'QR code missing station information', 'warning');
            startQRScanning();
            return;
        }

        // Check if station exists in SERVICES config
        if (!SERVICES[serviceID.toLowerCase()]) {
            console.error('Unknown station:', serviceID);
            Swal.fire('Invalid QR', 'Unknown station: ' + serviceID, 'warning');
            startQRScanning();
            return;
        }

        // Use ServiceID directly as service key
        const serviceKey = serviceID.toLowerCase();

        showService(serviceKey);

    } catch (e) {
        console.error('QR parse error:', e);
        Swal.fire('Invalid QR', 'Could not parse QR code', 'warning');
        startQRScanning();
    }
}

// Start scanning after PIN verification
document.addEventListener('pinVerified', async function () {
    console.log('PIN verified - loading service hierarchy');

    // Load service hierarchy from API before proceeding
    await loadServiceHierarchy();

    // Get ServiceID from URL if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const serviceID = urlParams.get('ServiceID') || urlParams.get('serviceid');

    if (serviceID) {
        // Direct to service based on URL parameter
        console.log('ServiceID found in URL:', serviceID);
        handleServiceSelection(serviceID);
    } else {
        // No ServiceID, show camera permission screen
        console.log('No ServiceID - showing camera permission screen');
        showCameraPermissionScreen();
    }
});


// Handle service selection from ServiceID
function handleServiceSelection(serviceID) {
    const serviceKey = serviceID.toLowerCase();

    // Check if station exists in SERVICES config
    if (!SERVICES[serviceKey]) {
        console.error('Unknown station:', serviceID);
        Swal.fire('Invalid Station', 'Unknown station: ' + serviceID, 'warning');
        startQRScanning();
        return;
    }

    // Show the service directly
    showService(serviceKey);
}


// If page reloads after PIN verification, check for ServiceID
document.addEventListener('DOMContentLoaded', async function () {
    console.log('DOMContentLoaded - Service.js loaded');

    if (document.body.classList.contains('pin-verified')) {
        console.log('Already pin-verified, loading hierarchy and checking for ServiceID');
        await loadServiceHierarchy();
        const urlParams = new URLSearchParams(window.location.search);
        const serviceID = urlParams.get('ServiceID') || urlParams.get('serviceid');

        if (serviceID) {
            setTimeout(() => handleServiceSelection(serviceID), 100);
        } else {
            setTimeout(showCameraPermissionScreen, 100);
        }
    }

    // Setup client QR scan button
    const btnScan = document.getElementById('btnScan');
    if (btnScan) {
        btnScan.addEventListener('click', function () {
            console.log('Scan button clicked, starting client QR scan');
            startClientQRScanning();
        });
    }

});

// Start scanning for client QR codes
function startClientQRScanning() {
    if (isScanning) return;

    isScanning = true;
    isClientScan = true;
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
            stopClientQRScanning();
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
            <h2 style="font-size: 18px; margin: 0 0 8px 0; font-weight: 600; color: #174593;">Scan Client QR Code</h2>
            <p style="font-size: 14px; margin: 0; color: #666; line-height: 1.4;">Point camera at client QR code</p>
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

        // Store reference so we can reliably remove it later
        currentOverlay = overlay;

        // Scanning loop
        const scanLoop = setInterval(() => {
            if (!isScanning || !isClientScan) {
                clearInterval(scanLoop);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code) {
                stopClientQRScanning();
                handleClientQRScan(code.data);
            }
        }, 100);

    }).catch(err => {
        isScanning = false;
        isClientScan = false;
        console.error('Camera error:', err);
        showCameraRecommendation();
        Swal.fire('Camera Error', 'Unable to access camera.', 'warning');
    });
}

// Stop client QR scanning
function stopClientQRScanning() {
    isScanning = false;
    isClientScan = false;

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
}

// Handle client QR code scan - AUTO-PROGRESSION WORKFLOW via ServiceScan.php
// This function implements the core scanning workflow:
//   1. Extract clientId from QR code (URL param or plain text)
//   2. Look up client in the local waitlist (loaded from GrabService)
//   3. Call ServiceScan.php which auto-progresses:
//      - Pending → In-Progress  (check-in)
//      - In-Progress → Complete (check-out)
//   4. If client is already completed or not found, show appropriate message
//   5. Refresh data from GrabService after each action
async function handleClientQRScan(qrData) {
    console.log('=== CLIENT QR SCAN START ===');
    console.log('Raw QR data:', JSON.stringify(qrData));
    console.log('Current service key:', currentServiceKey);

    try {
        // Try to parse as URL or extract clientId
        let clientId = null;

        try {
            const url = new URL(qrData);  // Only absolute URLs
            clientId = url.searchParams.get('clientId') || url.searchParams.get('id') || url.searchParams.get('ClientID');
            console.log('Parsed as URL — extracted clientId:', clientId);
        } catch (e) {
            // Not a valid absolute URL — treat full text as the clientId
            clientId = qrData.trim();
            console.log('Not a URL — using raw text as clientId:', clientId);
        }

        if (!clientId) {
            console.error('No clientId found in QR code');
            Swal.fire('Invalid QR', 'QR code does not contain a valid client ID', 'warning');
            startClientQRScanning();
            return;
        }

        console.log('Client ID extracted:', clientId);

        // Check if client is in the current service's waitlist (loaded from GrabService)
        const clientInWaitlist = currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId];
        console.log('Client in waitlist:', clientInWaitlist ? JSON.stringify(clientInWaitlist) : 'NOT FOUND');
        console.log('Waitlist keys for this service:', currentServiceKey ? Object.keys(SERVICE_WAITLISTS[currentServiceKey]) : 'no service');

        if (clientInWaitlist && clientInWaitlist.status === 'completed') {
            Swal.fire({
                icon: 'info',
                title: 'Client Already Completed',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Client:</strong> ${clientInWaitlist.name}</p>
                        <p><strong>ID:</strong> ${clientId}</p>
                        <p><strong>Status:</strong> Already completed for this service</p>
                    </div>
                `,
                confirmButtonText: 'OK'
            });
            return;
        }

        // Determine the ServiceID(s) to pass to the API
        // Send all serviceIDs for this station — backend auto-detects the correct one
        const service = SERVICES[currentServiceKey];
        const serviceID = service ? service.serviceIDs.join(',') : '';
        console.log('Sending to ServiceScan.php:', { ClientID: clientId, ServiceID: serviceID });

        // Call ServiceScan.php to auto-progress the client's status
        const response = await fetch('/api/ServiceScan.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ClientID: clientId, ServiceID: serviceID })
        });

        console.log('ServiceScan response status:', response.status);
        const data = await response.json();
        console.log('ServiceScan response body:', JSON.stringify(data));

        if (!data.success) {
            Swal.fire({
                icon: 'error',
                title: 'Scan Failed',
                text: data.message || 'Unable to process client scan.',
                confirmButtonText: 'OK'
            });
            return;
        }

        let statusText = data.newStatus === 'In-Progress' ? 'Checked in — now in service' : 'Completed and checked out';
        let actionLabel = data.newStatus === 'In-Progress' ? 'Check In' : 'Check Out';
        const clientName = clientInWaitlist ? clientInWaitlist.name : clientId;

        Swal.fire({
            icon: 'success',
            title: `${actionLabel} Successful`,
            html: `
                <div style="text-align: left;">
                    <p><strong>Client:</strong> ${clientName}</p>
                    <p><strong>ID:</strong> ${clientId}</p>
                    <p><strong>Service:</strong> ${service ? service.name : 'Service'}</p>
                    <p><strong>Status:</strong> ${statusText}</p>
                </div>
            `,
            confirmButtonText: 'OK'
        }).then(() => {
            // Refresh stats and waitlist from the server
            fetchServiceData(currentServiceKey);
        });

    } catch (e) {
        console.error('QR scan error:', e);
        Swal.fire('Error', 'Could not process QR code scan', 'warning');
        startClientQRScanning();
    }
}

// Show modal to choose check-in or check-out action (calls ServiceScan.php)
function showCheckInOutModal(clientId) {
    const service = currentServiceKey ? SERVICES[currentServiceKey] : null;
    const serviceTitle = service ? service.name : 'Service';

    // Get client from waitlist
    let client = null;
    if (currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId]) {
        client = SERVICE_WAITLISTS[currentServiceKey][clientId];
    }
    const clientName = client ? client.name : 'Unknown Client';

    // Determine which button to show based on client status
    const isInProgress = client && client.status === 'in-progress';
    const actionButton = isInProgress
        ? `<button class="btn btn-success btn-lg" onclick="processClientAction('${clientId}', 'checkout')">
               <i class="bi bi-person-check me-2"></i>Complete
           </button>`
        : `<button class="btn btn-info btn-lg" onclick="processClientAction('${clientId}', 'checkin')">
               <i class="bi bi-person-plus me-2"></i>Check In
           </button>`;

    Swal.fire({
        title: clientName,
        html: `
            <div style="text-align: left; margin-bottom: 20px;">
                <p><strong>Client ID:</strong> ${clientId}</p>
                <p><strong>Service:</strong> ${serviceTitle}</p>
                <p><strong>Status:</strong> ${isInProgress ? 'In Progress' : 'Waiting'}</p>
            </div>
            <div class="d-grid gap-3">
                ${actionButton}
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Close',
        allowOutsideClick: true,
        allowEscapeKey: true,
        didOpen: (modal) => {
            modal.classList.add('modal-lg');
        }
    });
}









// Process client action via ServiceScan.php API
// ServiceScan auto-progresses: Pending → In-Progress, In-Progress → Complete
async function processClientAction(clientId, action) {
    const service = currentServiceKey ? SERVICES[currentServiceKey] : null;
    const serviceTitle = service ? service.name : 'Service';

    console.log(`Processing client ${action}:`, clientId, 'for service:', serviceTitle);

    // Send all serviceIDs for this station — backend auto-detects the correct one
    const serviceID = service ? service.serviceIDs.join(',') : '';

    try {
        const response = await fetch('/api/ServiceScan.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ClientID: clientId, ServiceID: serviceID })
        });

        const data = await response.json();

        if (!data.success) {
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: data.message || 'Unable to update client status.',
                confirmButtonText: 'OK'
            });
            return;
        }

        // Map API newStatus to display text
        let statusText = data.newStatus === 'In-Progress' ? 'Now in service' : 'Completed and checked out';
        let actionLabel = data.newStatus === 'In-Progress' ? 'Check In' : 'Check Out';

        const wlClient = currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId];
        const clientName = wlClient ? wlClient.name : clientId;

        Swal.fire({
            icon: 'success',
            title: `${actionLabel} Successful`,
            html: `
                <div style="text-align: left;">
                    <p><strong>Client:</strong> ${clientName}</p>
                    <p><strong>ID:</strong> ${clientId}</p>
                    <p><strong>Service:</strong> ${serviceTitle}</p>
                    <p><strong>Status:</strong> ${statusText}</p>
                </div>
            `,
            confirmButtonText: 'OK'
        }).then(() => {
            // Refresh stats and waitlist from the server
            fetchServiceData(currentServiceKey);
        });
    } catch (error) {
        console.error('ServiceScan API error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Unable to reach the server. Please try again.',
            confirmButtonText: 'OK'
        });
    }
}



// Populate the waitlist table with client data
function populateWaitlist(clientsToShow = null) {
    const waitlistBody = document.getElementById('waitlistBody');
    if (!waitlistBody) return;

    // Use provided clients or clients from current service's waitlist
    let clientsArray;
    if (clientsToShow) {
        clientsArray = Object.values(clientsToShow);
    } else {
        // Show only active clients (waiting or in-progress) in the current service's waitlist
        clientsArray = currentServiceKey ?
            Object.values(SERVICE_WAITLISTS[currentServiceKey]).filter(c => c.status !== 'completed') : [];
    }

    // Clear existing rows
    waitlistBody.innerHTML = '';

    // Show empty state if no clients
    if (clientsArray.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="3" class="text-center py-4 text-muted">
                <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                No clients in waitlist
            </td>
        `;
        waitlistBody.appendChild(emptyRow);
        return;
    }

    // Populate with client data
    clientsArray.forEach(client => {
        const isInProgress = client.status === 'in-progress';
        const statusBadge = isInProgress
            ? '<span class="badge text-dark ms-1" style="background-color: #ffe066; font-size: 0.7rem;">In Progress</span>'
            : '';
        // Show sub-service label only for stations with multiple serviceIDs
        const hasMultiple = currentServiceKey && SERVICES[currentServiceKey] && SERVICES[currentServiceKey].serviceIDs.length > 1;
        const subLabel = hasMultiple && client.serviceID && SUB_SERVICE_LABELS[client.serviceID]
            ? `<span class="text-muted small"> · ${SUB_SERVICE_LABELS[client.serviceID]}</span>`
            : '';
        // Build secondary info line (sub-label and/or badge)
        const secondaryInfo = (subLabel || statusBadge)
            ? `<span class="small">${subLabel}${statusBadge}</span>`
            : '';
        const row = document.createElement('tr');
        row.className = 'border-bottom';
        row.innerHTML = `
            <td class="ps-3 py-3">
                <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                    <div class="rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0 ${isInProgress ? 'text-dark' : 'bg-light'}" style="width: 30px; height: 30px;${isInProgress ? ' background-color: #ffe066;' : ''}">
                        <i class="bi ${isInProgress ? 'bi-person-fill-check' : 'bi-person'}"></i>
                    </div>
                    <div class="d-flex flex-column" style="min-width: 0;">
                        <span class="fw-bold text-dark">${client.name}</span>
                        ${secondaryInfo}
                    </div>
                </div>
            </td>
            <td class="fw-medium text-nowrap py-3">${formatDOB(client.dob)}</td>
            <td class="text-end pe-3 py-3">
                <button class="btn ${isInProgress ? 'btn-success' : 'btn-primary'} btn-sm rounded-2 px-2 px-sm-3" data-client-id="${client.id}" title="${isInProgress ? 'Complete' : 'Update'}">
                    <i class="bi ${isInProgress ? 'bi-check-lg' : 'bi-arrow-right'} d-sm-none" style="font-size: 1rem; line-height: 1;"></i>
                    <span class="d-none d-sm-inline text-nowrap">${isInProgress ? 'Complete' : 'Update'}</span>
                </button>
            </td>
        `;
        waitlistBody.appendChild(row);
    });

    // Reattach event listeners to Update buttons
    attachUpdateButtonListeners();
}

// Attach event listeners to Update buttons
function attachUpdateButtonListeners() {
    const updateButtons = document.querySelectorAll('button[data-client-id]');
    updateButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const clientId = this.getAttribute('data-client-id');
            console.log('Update button clicked for client:', clientId);
            showCheckInOutModal(clientId);
        });
    });
}

// Search/filter the waitlist table
function filterWaitlist(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (term === '') {
        // Show all clients from current service if search is empty
        populateWaitlist();
        return;
    }

    // Filter clients from current service's waitlist by name or ID
    const filteredClients = {};
    if (currentServiceKey) {
        Object.entries(SERVICE_WAITLISTS[currentServiceKey]).forEach(([key, client]) => {
            if (client.name.toLowerCase().includes(term) || client.id.toLowerCase().includes(term)) {
                filteredClients[key] = client;
            }
        });
    }

    populateWaitlist(filteredClients);
}



// Update stats display based on current waitlist
function updateStatsDisplay() {
    if (!currentServiceKey) return;

    const waitlist = SERVICE_WAITLISTS[currentServiceKey];

    // Count clients by status
    let waitingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    Object.values(waitlist).forEach(client => {
        if (client.status === 'waiting') waitingCount++;
        else if (client.status === 'in-progress') inProgressCount++;
        else if (client.status === 'completed') completedCount++;
    });

    // Update stat values in the UI
    const stat1ValueEl = document.getElementById('stat1Value');
    const stat2ValueEl = document.getElementById('stat2Value');
    const stat3ValueEl = document.getElementById('stat3Value');

    if (stat1ValueEl) stat1ValueEl.textContent = waitingCount;
    if (stat2ValueEl) stat2ValueEl.textContent = inProgressCount;
    if (stat3ValueEl) stat3ValueEl.textContent = completedCount;
}

// Refresh button
const refreshServiceBtn = document.getElementById('refreshServiceBtn');
if (refreshServiceBtn) {
    refreshServiceBtn.addEventListener('click', () => {
        if (currentServiceKey) spinRefreshBtn(refreshServiceBtn, fetchServiceData(currentServiceKey));
    });
}