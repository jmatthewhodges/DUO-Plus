/*
 * ============================================================
 *  File:        admin.js
 *  Description: Admin dashboard logic. Loads settings from
 *               /api/admin.php and provides UI for editing
 *               PIN, service capacities, and adding/removing
 *               services. Modular — each section has its own
 *               init/render/save functions.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Mar 7, 2026
 *  Changes Made:      Initial creation
 * ============================================================
 */

const API = '/api/admin.php';

// ─── State ──────────────────────────────────────────────────
let adminData = null;

// ─── Bootstrap Icons commonly used for services ─────────────
const AVAILABLE_ICONS = [
    'bi-heart-pulse', 'bi-hospital', 'bi-bandaid', 'bi-capsule',
    'bi-eyeglasses', 'bi-scissors', 'bi-emoji-smile', 'bi-person',
    'bi-thermometer', 'bi-clipboard2-pulse', 'bi-lungs', 'bi-ear',
    'bi-activity', 'bi-prescription2', 'bi-virus', 'bi-radioactive',
    'bi-droplet', 'bi-shield-plus', 'bi-hand-thumbs-up', 'bi-stars',
    'bi-truck', 'bi-cup-hot', 'bi-basket', 'bi-house-heart',
    'bi-bicycle', 'bi-book', 'bi-translate', 'bi-chat-dots',
    'bi-people', 'bi-globe', 'bi-gift', 'bi-balloon',
];

// ─── Load All Data ──────────────────────────────────────────
async function loadAdminData() {
    try {
        const res = await fetch(API);
        const json = await res.json();

        if (!json.success) {
            throw new Error(json.error || 'Failed to load settings');
        }

        adminData = json.data;
        renderPinSection();
        renderServicesSection();
        renderIconPicker();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Load Error', text: err.message });
    }
}

// ─── API Helper ─────────────────────────────────────────────
async function adminPost(body) {
    const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

// ═══════════════════════════════════════════════════════════════
// SECTION: PIN Code
// ═══════════════════════════════════════════════════════════════

function renderPinSection() {
    const pin = adminData.pinCode;
    const input = document.getElementById('inputPinCode');
    const lastUpdated = document.getElementById('pinLastUpdated');

    if (pin) {
        input.value = pin.PinValue;
        input.type = 'password';
        if (pin.LastUpdated) {
            lastUpdated.textContent = 'Last updated: ' + new Date(pin.LastUpdated).toLocaleString();
        }
    }
}

// Toggle PIN visibility
document.getElementById('btnTogglePinVisibility').addEventListener('click', () => {
    const input = document.getElementById('inputPinCode');
    const icon = document.querySelector('#btnTogglePinVisibility i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
});

// Save PIN
document.getElementById('btnSavePin').addEventListener('click', async () => {
    const newPin = document.getElementById('inputPinCode').value.trim();

    if (!/^\d{6}$/.test(newPin)) {
        Swal.fire({ icon: 'warning', title: 'Invalid PIN', text: 'PIN must be exactly 6 digits.' });
        return;
    }

    try {
        const result = await adminPost({ action: 'updatePin', pinValue: newPin });
        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Saved', text: 'PIN updated.', timer: 1500, showConfirmButton: false });
            document.getElementById('pinLastUpdated').textContent = 'Last updated: ' + new Date().toLocaleString();
        } else {
            throw new Error(result.error || 'Update failed');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// SECTION: Services
// ═══════════════════════════════════════════════════════════════

function renderServicesSection() {
    const container = document.getElementById('serviceList');
    const services = adminData.services || [];

    if (services.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-muted">No services found.</div>';
        return;
    }

    container.innerHTML = services.map(svc => {
        const hasEvent = svc.EventServiceID !== null;
        const statusBadge = hasEvent
            ? (svc.IsClosed == 1
                ? '<span class="badge bg-danger status-badge">Closed</span>'
                : '<span class="badge bg-success status-badge">Open</span>')
            : '<span class="badge bg-secondary status-badge">Not in Event</span>';

        return `
        <div class="service-row" data-service-id="${svc.ServiceID}" data-event-service-id="${svc.EventServiceID || ''}">
            <div class="service-icon-preview">
                <i class="bi ${svc.IconTag || 'bi-circle'}"></i>
            </div>
            <div class="service-fields">
                <div style="min-width: 140px;">
                    <label>Service</label>
                    <div class="fw-bold small">${svc.ServiceName}</div>
                    <div class="text-muted" style="font-size:0.7rem;">${svc.ServiceID}</div>
                    ${statusBadge}
                </div>
                ${hasEvent ? `
                <div class="form-group">
                    <label>Max Capacity</label>
                    <input type="number" class="form-control form-control-sm svc-maxCapacity" 
                        value="${svc.MaxCapacity ?? ''}" min="0" inputmode="numeric">
                </div>
                <div class="form-group">
                    <label>Max Seats</label>
                    <input type="number" class="form-control form-control-sm svc-maxSeats" 
                        value="${svc.MaxSeats ?? ''}" min="0" inputmode="numeric">
                </div>
                <div class="form-group">
                    <label>Standby Limit</label>
                    <input type="number" class="form-control form-control-sm svc-standbyLimit" 
                        value="${svc.StandbyLimit ?? ''}" min="0" inputmode="numeric">
                </div>
                ` : '<div class="text-muted small fst-italic">No active event settings</div>'}
            </div>
            <div class="d-flex flex-column gap-1">
                ${hasEvent ? `
                <button class="btn btn-sm btn-outline-primary btn-save-service" title="Save changes">
                    <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn btn-sm ${svc.IsClosed == 1 ? 'btn-outline-success' : 'btn-outline-warning'} btn-toggle-service" 
                    title="${svc.IsClosed == 1 ? 'Open service' : 'Close service'}">
                    <i class="bi ${svc.IsClosed == 1 ? 'bi-play-fill' : 'bi-pause-fill'}"></i>
                </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-danger btn-remove-service" title="Remove service">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    // Attach event listeners
    container.querySelectorAll('.btn-save-service').forEach(btn => {
        btn.addEventListener('click', handleSaveService);
    });
    container.querySelectorAll('.btn-toggle-service').forEach(btn => {
        btn.addEventListener('click', handleToggleService);
    });
    container.querySelectorAll('.btn-remove-service').forEach(btn => {
        btn.addEventListener('click', handleRemoveService);
    });
}

async function handleSaveService(e) {
    const row = e.target.closest('.service-row');
    const eventServiceID = row.dataset.eventServiceId;

    const maxCapacity = row.querySelector('.svc-maxCapacity')?.value;
    const maxSeats = row.querySelector('.svc-maxSeats')?.value;
    const standbyLimit = row.querySelector('.svc-standbyLimit')?.value;

    try {
        const result = await adminPost({
            action: 'updateService',
            eventServiceID,
            maxCapacity: maxCapacity !== '' ? parseInt(maxCapacity) : null,
            maxSeats: maxSeats !== '' ? parseInt(maxSeats) : null,
            standbyLimit: standbyLimit !== '' ? parseInt(standbyLimit) : null,
        });

        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function handleToggleService(e) {
    const row = e.target.closest('.service-row');
    const eventServiceID = row.dataset.eventServiceId;
    const svc = adminData.services.find(s => s.EventServiceID === eventServiceID);
    const newClosed = svc.IsClosed != 1;

    try {
        const result = await adminPost({
            action: 'toggleService',
            eventServiceID,
            isClosed: newClosed,
        });

        if (result.success) {
            // Refresh to show updated state
            await loadAdminData();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function handleRemoveService(e) {
    const row = e.target.closest('.service-row');
    const serviceID = row.dataset.serviceId;

    const confirm = await Swal.fire({
        icon: 'warning',
        title: 'Remove Service?',
        text: `Are you sure you want to remove "${serviceID}"? This cannot be undone.`,
        showCancelButton: true,
        confirmButtonText: 'Remove',
        confirmButtonColor: '#dc3545',
    });

    if (!confirm.isConfirmed) return;

    try {
        const result = await adminPost({ action: 'removeService', serviceID });

        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Removed', timer: 1200, showConfirmButton: false });
            await loadAdminData();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION: Icon Picker
// ═══════════════════════════════════════════════════════════════

function renderIconPicker() {
    const grid = document.getElementById('iconPicker');
    grid.innerHTML = AVAILABLE_ICONS.map(icon => `
        <div class="icon-picker-item" data-icon="${icon}" title="${icon.replace('bi-', '')}">
            <i class="bi ${icon}"></i>
        </div>
    `).join('');

    grid.querySelectorAll('.icon-picker-item').forEach(item => {
        item.addEventListener('click', () => {
            grid.querySelectorAll('.icon-picker-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            document.getElementById('newServiceIcon').value = item.dataset.icon;
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// SECTION: Add Service Form
// ═══════════════════════════════════════════════════════════════

document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const serviceID = document.getElementById('newServiceID').value.trim();
    const serviceName = document.getElementById('newServiceName').value.trim();
    const iconTag = document.getElementById('newServiceIcon').value;

    if (!serviceID || !serviceName) {
        Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Service ID and Name are required.' });
        return;
    }

    if (!iconTag) {
        Swal.fire({ icon: 'warning', title: 'No Icon', text: 'Please select an icon for the service.' });
        return;
    }

    try {
        const result = await adminPost({
            action: 'addService',
            serviceID,
            serviceName,
            iconTag,
        });

        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Service Added', timer: 1500, showConfirmButton: false });
            document.getElementById('addServiceForm').reset();
            document.getElementById('newServiceIcon').value = '';
            document.querySelectorAll('.icon-picker-item').forEach(i => i.classList.remove('selected'));
            await loadAdminData();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// Refresh button
// ═══════════════════════════════════════════════════════════════

document.getElementById('btnRefreshAll').addEventListener('click', loadAdminData);

// ═══════════════════════════════════════════════════════════════
// Init — wait for PIN verification, then load
// ═══════════════════════════════════════════════════════════════

document.addEventListener('pinVerified', loadAdminData);

// Also load on DOMContentLoaded if already verified (page reload after PIN)
document.addEventListener('DOMContentLoaded', () => {
    // If pin is already verified (session exists), pinCode.js adds pin-verified class
    // and fires pinVerified event. As a fallback, try loading after a short delay.
    setTimeout(() => {
        if (document.body.classList.contains('pin-verified') && !adminData) {
            loadAdminData();
        }
    }, 500);
});
