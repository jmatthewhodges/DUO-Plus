/*
 ============================================================
 File:           Service.js
 Description:    Handles service-specific content display based on 
                 stationId from QR code URL params. Also handles
                 client check-in/check-out via QR code scanning or
                 manual client ID entry through Update buttons.
                 stationId values: medical, optical, dental, haircut
                 Works with pinCode.js security layer.
 
 Last Modified By:  Cameron
 Last Modified On:  Mar 4 @ 11:00 PM
 Changes Made:      Added API integration structure for future backend
 
=============================================================

 API ENDPOINTS NEEDED (for implementation):
 - GET /api/searchWaitingRoomClients.php?q={searchTerm}&service={serviceKey}
   Returns: { success: true, clients: [{id, name, dob}, ...] }
   Description: Search for available clients in waiting room by name/ID
 
 - GET /api/checkClientAssignment.php?clientId={clientId}
   Returns: { assigned: false } or { assigned: true, assignedService: "{service}" }
   Description: Check if client is already assigned to a service
 
 - POST /api/addClientToService.php
   Body: { clientId, serviceKey }
   Returns: { success: true, message: "Client added" }
   Description: Add client from waiting room to service, removes from available list
 
 - GET /api/getServiceStats.php?service={serviceKey}
   Returns: { success: true, currentAvgTime: "20 minutes", pastAvgTime: "34 minutes" }
   Description: Get current and past average service times for a service
 
 - POST /api/CheckIn.php (already exists)
   Body: { clientId, serviceKey }
   Returns: { success: true, status: "in-progress" }
   Description: Mark client as in-service
 
 - POST /api/CheckOut.php (already exists)
   Body: { clientId, serviceKey }
   Returns: { success: true, status: "completed" }
   Description: Mark client as completed/checked out
 
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

// Fake hardcoded client database for testing
const FAKE_CLIENTS = {
    'gicsxbtqog': {
        id: 'gicsxbtqog',
        name: 'John Smith',
        dob: '05/15/1990',
        status: 'waiting'  // waiting, in-progress, completed
    },
    'client001': {
        id: 'client001',
        name: 'John A. Doe',
        dob: '11/01/1978',
        status: 'waiting'
    },
    'client002': {
        id: 'client002',
        name: 'Jane D. Rett',
        dob: '08/23/1989',
        status: 'waiting'
    },
    'client003': {
        id: 'client003',
        name: 'Michael S. Johnson',
        dob: '03/15/1985',
        status: 'waiting'
    },
    'client004': {
        id: 'client004',
        name: 'Sarah M. Williams',
        dob: '09/28/1992',
        status: 'waiting'
    },
    'client005': {
        id: 'client005',
        name: 'Robert T. Brown',
        dob: '12/10/1975',
        status: 'waiting'
    },
    'client006': {
        id: 'client006',
        name: 'Amanda C. Davis',
        dob: '05/17/1988',
        status: 'waiting'
    }
};

// Waitlist tracking per service
const SERVICE_WAITLISTS = {
    medical: {},
    optical: {},
    dental: {},
    haircut: {}
};

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

    // Update times from API
    fetchServiceTimes(serviceKey);

    // Update waitlist title
    const waitlistTitleEl = document.getElementById('waitlistTitle');
    if (waitlistTitleEl) waitlistTitleEl.textContent = `${data.title} - Waitlist`;

    // Populate the waitlist table with client data
    populateWaitlist();
    
    // Initialize stats display based on current waitlist
    updateStatsDisplay();

    // Show the service content if it's hidden
    const serviceContent = document.getElementById('serviceContent');
    if (serviceContent && serviceContent.style.display === 'none') {
        serviceContent.style.display = 'block';
    }

    // Scroll to top so user can see the service
    window.scrollTo(0, 0);

    console.log(`Service displayed: ${serviceKey}`);
}

// Fetch service time data from API and update display
async function fetchServiceTimes(serviceKey) {
    try {
        // TODO: Implement API endpoint
        // GET /api/getServiceStats.php?service={serviceKey}
        // Returns: { success: true, currentAvgTime: "20 minutes", pastAvgTime: "34 minutes" }
        const response = await fetch(`/api/getServiceStats.php?service=${serviceKey}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const avgTimeEl = document.getElementById('avgTime');
                const pastAvgTimeEl = document.getElementById('pastAvgTime');
                
                if (avgTimeEl) avgTimeEl.textContent = data.currentAvgTime || 'N/A';
                if (pastAvgTimeEl) pastAvgTimeEl.textContent = data.pastAvgTime || 'N/A';
                
                console.log(`Service times updated for ${serviceKey}`);
            }
        } else {
            console.error(`Failed to fetch service times: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching service times:', error);
        // Fallback: show N/A if API fails
        const avgTimeEl = document.getElementById('avgTime');
        const pastAvgTimeEl = document.getElementById('pastAvgTime');
        if (avgTimeEl) avgTimeEl.textContent = 'N/A';
        if (pastAvgTimeEl) pastAvgTimeEl.textContent = 'N/A';
    }
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
    
    // Setup client QR scan button
    const btnScan = document.getElementById('btnScan');
    if (btnScan) {
        btnScan.addEventListener('click', function() {
            console.log('Scan button clicked, starting client QR scan');
            startClientQRScanning();
        });
    }
    
    // Setup manual add client button
    const btnManualAdd = document.getElementById('btnManualAdd');
    if (btnManualAdd) {
        btnManualAdd.addEventListener('click', function() {
            console.log('Manual add button clicked');
            showManualClientIdEntry();
        });
    }
    
    // Setup update button listeners for manual client ID entry
    const updateButtons = document.querySelectorAll('.btn-primary');
    updateButtons.forEach(btn => {
        if (btn.textContent.trim() === 'Update') {
            btn.addEventListener('click', function() {
                console.log('Update button clicked');
                showManualClientIdEntry();
            });
        }
    });
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
        Swal.fire('Camera Error', 'Unable to access camera. Check permissions.', 'error');
        console.error('Camera error:', err);
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

// Handle client QR code scan - extract clientId
function handleClientQRScan(qrData) {
    console.log('Client QR scanned:', qrData);
    
    try {
        // Try to parse as URL or extract clientId
        let clientId = null;
        
        try {
            const url = new URL(qrData, window.location.href);
            clientId = url.searchParams.get('clientId') || url.searchParams.get('id');
        } catch (e) {
            // Not a URL, try to parse as plain clientId
            clientId = qrData.trim();
        }
        
        if (!clientId) {
            console.error('No clientId found in QR code');
            Swal.fire('Invalid QR', 'QR code does not contain a valid client ID', 'warning');
            startClientQRScanning();
            return;
        }

        console.log('Client ID extracted:', clientId);
        
        // Check if client exists and determine action based on current status
        const client = FAKE_CLIENTS[clientId];
        if (!client) {
            Swal.fire({
                icon: 'error',
                title: 'Client Not Found',
                text: `Client ID "${clientId}" does not exist in the system`,
                confirmButtonText: 'OK'
            }).then(() => {
                startClientQRScanning();
            });
            return;
        }
        
        // Check client's current status in this service and determine next action
        const clientInWaitlist = currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId];
        let nextAction = null;
        
        if (!clientInWaitlist) {
            // Not in waitlist yet → add as waiting
            nextAction = 'addwaiting';
        } else if (clientInWaitlist.status === 'waiting') {
            // Currently waiting → move to in-progress
            nextAction = 'inprogress';
        } else if (clientInWaitlist.status === 'in-progress') {
            // Currently in-progress → move to completed
            nextAction = 'checkout';
        } else if (clientInWaitlist.status === 'completed') {
            // Already completed → ask what to do
            nextAction = 'already_completed';
        }
        
        // Execute the appropriate action based on current status
        if (nextAction === 'addwaiting') {
            // Add client as waiting
            addClientToWaitlist(clientId, currentServiceKey);
            Swal.fire({
                icon: 'success',
                title: 'Client Added',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Client:</strong> ${client.name}</p>
                        <p><strong>ID:</strong> ${client.id}</p>
                        <p><strong>Status:</strong> Added to waiting list</p>
                    </div>
                `,
                confirmButtonText: 'OK'
            });
        } else if (nextAction === 'inprogress') {
            // Move from waiting to in-progress
            processClientAction(clientId, 'inprogress');
        } else if (nextAction === 'checkout') {
            // Move from in-progress to completed
            processClientAction(clientId, 'checkout');
        } else if (nextAction === 'already_completed') {
            // Client already completed - show status
            Swal.fire({
                icon: 'info',
                title: 'Client Already Completed',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Client:</strong> ${client.name}</p>
                        <p><strong>ID:</strong> ${client.id}</p>
                        <p><strong>Status:</strong> Already completed for this service</p>
                    </div>
                `,
                confirmButtonText: 'OK'
            });
        }

    } catch (e) {
        console.error('QR parse error:', e);
        Swal.fire('Invalid QR', 'Could not parse QR code', 'warning');
        startClientQRScanning();
    }
}

// Show modal to choose check-in or check-out action
function showCheckInOutModal(clientId) {
    const service = currentServiceKey ? SERVICES[currentServiceKey] : null;
    const serviceTitle = service ? service.name : 'Service';
    
    // Get client from waitlist first, then fallback to FAKE_CLIENTS
    let client = null;
    if (currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId]) {
        client = SERVICE_WAITLISTS[currentServiceKey][clientId];
    } else {
        client = FAKE_CLIENTS[clientId];
    }
    const clientName = client ? client.name : 'Unknown Client';
    
    Swal.fire({
        title: clientName,
        html: `
            <div style="text-align: left; margin-bottom: 20px;">
                <p><strong>Client ID:</strong> ${clientId}</p>
                <p><strong>Service:</strong> ${serviceTitle}</p>
            </div>
            <div style="text-align: center; font-weight: 600; margin-bottom: 15px; color: #666;">
                Update Client Status
            </div>
            <div class="d-grid gap-3">
                <button class="btn btn-info btn-lg" onclick="processClientAction('${clientId}', 'checkin')">
                    <i class="bi bi-person-plus me-2"></i>Check In
                </button>
                <button class="btn btn-primary btn-lg" onclick="processClientAction('${clientId}', 'inprogress')">
                    <i class="bi bi-hourglass-split me-2"></i>In Progress
                </button>
                <button class="btn btn-success btn-lg" onclick="processClientAction('${clientId}', 'checkout')">
                    <i class="bi bi-person-check me-2"></i>Complete
                </button>
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

// Show manual client ID entry
function showManualClientIdEntry() {
    Swal.fire({
        title: 'Add Client Manually',
        input: 'text',
        inputLabel: 'Search Client',
        inputPlaceholder: 'Enter client ID or name (e.g., gicsxbtqog or John)',
        showCancelButton: true,
        confirmButtonText: 'Search',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter a client ID or name';
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const searchTerm = result.value.trim().toLowerCase();
            searchAndDisplayClients(searchTerm);
        }
    });
}

// Search for clients by ID or name from waiting room
// TODO: Replace with actual API call to backend
// API Endpoint: GET /api/searchWaitingRoomClients.php?q={searchTerm}&service={serviceKey}
async function searchAndDisplayClients(searchTerm) {
    try {
        // TODO: Replace this with actual API call
        // const response = await fetch(`/api/searchWaitingRoomClients.php?q=${encodeURIComponent(searchTerm)}&service=${currentServiceKey}`);
        // const results = await response.json();
        
        // Fallback: Search local FAKE_CLIENTS for development
        const results = {};
        
        // Search by ID first (exact match is highest priority)
        if (FAKE_CLIENTS[searchTerm]) {
            results[searchTerm] = FAKE_CLIENTS[searchTerm];
        } else {
            // Search by name (substring match - case insensitive)
            Object.entries(FAKE_CLIENTS).forEach(([id, client]) => {
                if (client.name.toLowerCase().includes(searchTerm)) {
                    results[id] = client;
                }
            });
        }
        
        // If no results found
        if (Object.keys(results).length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Results',
                text: `No clients found matching "${searchTerm}"`,
                confirmButtonText: 'Try Again'
            }).then(() => {
                showManualClientIdEntry();
            });
            return;
        }
        
        // Display search results
        displayClientSearchResults(results);
    } catch (error) {
        console.error('Error searching clients:', error);
        Swal.fire({
            icon: 'error',
            title: 'Search Error',
            text: 'Unable to search for clients. Please try again.',
            confirmButtonText: 'OK'
        }).then(() => {
            showManualClientIdEntry();
        });
    }
}

// Display client search results with add buttons
// Note: Results should only show clients from the waiting room pool
// When API is integrated, these will be fetched from the waiting room
// and removed from list after being added to a service
function displayClientSearchResults(results) {
    let html = '<div style="text-align: left;">';
    
    Object.entries(results).forEach(([id, client]) => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;">
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">${client.name}</div>
                    <div style="font-size: 0.9rem; color: #666;">DOB: ${client.dob}</div>
                    <div style="font-size: 0.85rem; color: #999;">ID: ${id}</div>
                </div>
                <button class="btn btn-success btn-sm" onclick="addClientFromSearch('${id}')">
                    <i class="bi bi-plus-lg me-1"></i>Add
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    
    Swal.fire({
        title: 'Select Client',
        html: html,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Search Again',
        didOpen: (modal) => {
            modal.classList.add('modal-lg');
        }
    }).then((result) => {
        if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
            showManualClientIdEntry();
        }
    });
}

// Add a client from search results to the service
// TODO: Replace with actual API call to backend
// API Endpoint: POST /api/addClientToService.php
// Body: { clientId, serviceKey }
async function addClientFromSearch(clientId) {
    const client = FAKE_CLIENTS[clientId];
    if (!client) return;
    
    try {
        // Check if client is already assigned to another service
        // TODO: Connect to API endpoint to check client assignment
        // const checkResponse = await fetch(`/api/checkClientAssignment.php?clientId=${clientId}`);
        // const checkData = await checkResponse.json();
        // if (checkData.assignedService && checkData.assignedService !== currentServiceKey) {
        //     Swal.fire({
        //         icon: 'warning',
        //         title: 'Client Already Assigned',
        //         text: `This client is already assigned to ${checkData.assignedService}. Please remove them from that service first.`,
        //         confirmButtonText: 'OK'
        //     });
        //     return;
        // }
        
        // Check if client is already in this service's waitlist
        const clientInWaitlist = currentServiceKey && SERVICE_WAITLISTS[currentServiceKey][clientId];
        
        if (!clientInWaitlist) {
            // Add to local waitlist
            // TODO: Replace with actual API call
            // const response = await fetch('/api/addClientToService.php', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({
            //         clientId: clientId,
            //         serviceKey: currentServiceKey
            //     })
            // });
            // const result = await response.json();
            // if (!result.success) throw new Error(result.message);
            
            addClientToWaitlist(clientId, currentServiceKey);
            
            Swal.fire({
                icon: 'success',
                title: 'Client Added',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Client:</strong> ${client.name}</p>
                        <p><strong>ID:</strong> ${client.id}</p>
                        <p><strong>Status:</strong> Added to waiting list</p>
                    </div>
                `,
                confirmButtonText: 'OK'
            });
        } else {
            // Already in waitlist → show status options
            showCheckInOutModal(clientId);
        }
    } catch (error) {
        console.error('Error adding client:', error);
        Swal.fire({
            icon: 'error',
            title: 'Add Error',
            text: 'Unable to add client. Please try again.',
            confirmButtonText: 'OK'
        });
    }
}

// Process client action (check-in, in-progress, or check-out)
function processClientAction(clientId, action) {
    let actionLabel = 'Update';
    if (action === 'checkin') {
        actionLabel = 'Check In';
    } else if (action === 'inprogress') {
        actionLabel = 'Put In Progress';
    } else if (action === 'checkout') {
        actionLabel = 'Check Out';
    }
    
    const service = currentServiceKey ? SERVICES[currentServiceKey] : null;
    const serviceTitle = service ? service.name : 'Service';
    
    console.log(`Processing client ${action}:`, clientId, 'for service:', serviceTitle);
    
    // Check if client exists in fake database
    const client = FAKE_CLIENTS[clientId];
    
    if (!client) {
        Swal.fire({
            icon: 'error',
            title: 'Client Not Found',
            text: `Client ID "${clientId}" does not exist in the system`,
            confirmButtonText: 'OK'
        });
        return;
    }
    
    let statusText = '';
    let newStatus = '';
    
    if (action === 'checkin') {
        newStatus = 'waiting';
        statusText = 'marked as waiting';
        // Check in: add/update client in waitlist with 'waiting' status
        if (SERVICE_WAITLISTS[currentServiceKey][clientId]) {
            SERVICE_WAITLISTS[currentServiceKey][clientId].status = 'waiting';
        } else {
            SERVICE_WAITLISTS[currentServiceKey][clientId] = {
                ...client,
                checkInTime: new Date(),
                status: 'waiting'
            };
        }
    } else if (action === 'inprogress') {
        newStatus = 'in-progress';
        statusText = 'now in service';
        // Mark as in-progress
        if (SERVICE_WAITLISTS[currentServiceKey][clientId]) {
            SERVICE_WAITLISTS[currentServiceKey][clientId].status = 'in-progress';
        } else {
            SERVICE_WAITLISTS[currentServiceKey][clientId] = {
                ...client,
                checkInTime: new Date(),
                status: 'in-progress'
            };
        }
    } else if (action === 'checkout') {
        newStatus = 'completed';
        statusText = 'completed and checked out';
        // Mark as completed instead of removing
        if (SERVICE_WAITLISTS[currentServiceKey][clientId]) {
            SERVICE_WAITLISTS[currentServiceKey][clientId].status = 'completed';
        }
    }
    
    Swal.fire({
        icon: 'success',
        title: `${actionLabel} Successful`,
        html: `
            <div style="text-align: left;">
                <p><strong>Client:</strong> ${client.name}</p>
                <p><strong>ID:</strong> ${client.id}</p>
                <p><strong>Service:</strong> ${serviceTitle}</p>
                <p><strong>Status:</strong> ${statusText}</p>
            </div>
        `,
        confirmButtonText: 'OK'
    }).then(() => {
        // Refresh UI
        console.log(`Client ${client.id} action completed: ${action}`);
        populateWaitlist(); // Refresh the table
        updateStatsDisplay(); // Update stats
        // Do NOT restart scanner - user will click button again if needed
    });
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
        const row = document.createElement('tr');
        row.className = 'border-bottom';
        row.innerHTML = `
            <td class="ps-3 d-block d-md-table-cell mb-2 mb-md-0">
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light flex-shrink-0" style="width: 30px; height: 30px;">
                        <i class="bi bi-person"></i>
                    </div>
                    <div class="d-flex flex-column">
                        <span class="fw-bold text-dark">${client.name}</span>
                        <span class="text-muted small d-md-none">DOB: ${client.dob}</span>
                    </div>
                </div>
            </td>
            
            <td class="fw-medium d-none d-md-table-cell">${client.dob}</td>
            
            <td class="d-block d-md-table-cell text-end pe-3 mb-2 mb-md-0">
                <button class="btn btn-primary btn-sm px-3 rounded-2 w-100 w-md-auto" style="white-space: nowrap;" data-client-id="${client.id}">Update</button>
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
        btn.addEventListener('click', function() {
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

// Add a client to the service waitlist
function addClientToWaitlist(clientId, serviceKey = null) {
    const service = serviceKey || currentServiceKey;
    if (!service) {
        console.error('No service specified for adding client to waitlist');
        return false;
    }
    
    const client = FAKE_CLIENTS[clientId];
    if (!client) {
        console.error('Client not found:', clientId);
        return false;
    }
    
    // Check if client already in this service's waitlist
    if (SERVICE_WAITLISTS[service][clientId]) {
        console.log('Client already in waitlist:', clientId);
        return false;
    }
    
    // Add client to the service's waitlist
    SERVICE_WAITLISTS[service][clientId] = {
        ...client,
        checkInTime: new Date(),
        status: 'waiting'
    };
    
    console.log(`Client ${clientId} added to ${service} waitlist`);
    populateWaitlist();
    updateStatsDisplay();
    
    return true;
}

// Remove a client from the service waitlist
function removeClientFromWaitlist(clientId, serviceKey = null) {
    const service = serviceKey || currentServiceKey;
    if (!service) {
        console.error('No service specified for removing client from waitlist');
        return false;
    }
    
    if (!SERVICE_WAITLISTS[service][clientId]) {
        console.log('Client not in waitlist:', clientId);
        return false;
    }
    
    delete SERVICE_WAITLISTS[service][clientId];
    console.log(`Client ${clientId} removed from ${service} waitlist`);
    populateWaitlist();
    updateStatsDisplay();
    
    return true;
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