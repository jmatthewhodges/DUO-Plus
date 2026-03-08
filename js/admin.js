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

// ─── SVG-aware icon renderer ────────────────────────────────
// Returns HTML string: raw SVG if iconTag starts with '<', otherwise a Bootstrap Icon <i>
function renderIcon(iconTag, extraClass = '', style = '') {
    if (!iconTag) iconTag = 'bi-circle';
    if (iconTag.trim().startsWith('<')) {
        // Wrap SVG in a span so we can style it uniformly
        return `<span class="svg-icon ${extraClass}" style="${style}">${iconTag.replace(/<svg/, '<svg style="width:1em;height:1em;fill:currentColor"')}</span>`;
    }
    return `<i class="bi ${iconTag} ${extraClass}" style="${style}"></i>`;
}

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
        renderFastTrackSection();
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

    // Group: categories first, then their children underneath
    const categories = services.filter(s => s.ServiceType === 'category' && !s.ParentServiceID);
    const operationals = services.filter(s => s.ServiceType === 'operational' && s.ParentServiceID);
    const childMap = {};
    operationals.forEach(op => {
        if (!childMap[op.ParentServiceID]) childMap[op.ParentServiceID] = [];
        childMap[op.ParentServiceID].push(op);
    });

    let html = '';
    categories.forEach(cat => {
        html += renderServiceRow(cat, false);
        (childMap[cat.ServiceID] || []).forEach(child => {
            html += renderServiceRow(child, true);
        });
    });

    // Any orphan operational services not under a known category
    const categoryIDs = new Set(categories.map(c => c.ServiceID));
    operationals.filter(op => !categoryIDs.has(op.ParentServiceID)).forEach(op => {
        html += renderServiceRow(op, true);
    });

    container.innerHTML = html;

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
    container.querySelectorAll('.icon-editable').forEach(btn => {
        btn.addEventListener('click', handleEditIcon);
    });

    // Populate parent dropdown in Add Service form
    populateParentDropdown(categories);
}

function renderServiceRow(svc, isChild) {
    const hasEvent = svc.EventServiceID !== null;
    const typeBadge = svc.ServiceType === 'category'
        ? '<span class="badge bg-info status-badge">Category</span>'
        : '<span class="badge bg-light text-dark status-badge">Operational</span>';
    const statusBadge = hasEvent
        ? (svc.IsClosed == 1
            ? '<span class="badge bg-danger status-badge">Closed</span>'
            : '<span class="badge bg-success status-badge">Open</span>')
        : '';
    const indent = isChild ? 'style="padding-left: 2.5rem; background: #fafbfe;"' : '';
    const childIcon = isChild ? '<i class="bi bi-arrow-return-right text-muted me-1" style="font-size:0.75rem;"></i>' : '';

    return `
    <div class="service-row" data-service-id="${svc.ServiceID}" data-event-service-id="${svc.EventServiceID || ''}" data-icon-tag="${(svc.IconTag || '').replace(/"/g, '&quot;')}" ${indent}>
        <div class="service-icon-preview icon-editable" title="Click to change icon">
            ${renderIcon(svc.IconTag)}
            <div class="icon-edit-badge"><i class="bi bi-pencil-fill"></i></div>
        </div>
        <div class="service-fields">
            <div style="min-width: 140px;">
                <label>Service</label>
                <div class="fw-bold small">${childIcon}${svc.ServiceName}</div>
                <div class="text-muted" style="font-size:0.7rem;">${svc.ServiceID}</div>
                ${typeBadge} ${statusBadge}
            </div>
            <div class="form-group" style="max-width: 70px;">
                <label>Order</label>
                <input type="number" class="form-control form-control-sm svc-sortOrder" 
                    value="${svc.SortOrder ?? 0}" min="0" inputmode="numeric">
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
            ` : (!isChild ? '<div class="text-muted small fst-italic">Category only — no event settings</div>' : '<div class="text-muted small fst-italic">No active event settings</div>')}
        </div>
        <div class="d-flex flex-column gap-1">
            <button class="btn btn-sm btn-outline-primary btn-save-service" title="Save changes">
                <i class="bi bi-check-lg"></i>
            </button>
            ${hasEvent ? `
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
}

function populateParentDropdown(categories) {
    const select = document.getElementById('newParentServiceID');
    if (!select) return;
    select.innerHTML = '<option value="">— Select parent —</option>';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.ServiceID;
        opt.textContent = cat.ServiceName;
        select.appendChild(opt);
    });
}

async function handleSaveService(e) {
    const row = e.target.closest('.service-row');
    const serviceID = row.dataset.serviceId;
    const eventServiceID = row.dataset.eventServiceId;
    const sortOrder = row.querySelector('.svc-sortOrder')?.value;

    const maxCapacity = row.querySelector('.svc-maxCapacity')?.value;
    const maxSeats = row.querySelector('.svc-maxSeats')?.value;
    const standbyLimit = row.querySelector('.svc-standbyLimit')?.value;

    try {
        const promises = [];

        // Always update sort order on tblServices
        if (sortOrder !== '' && sortOrder !== undefined) {
            promises.push(adminPost({
                action: 'updateSortOrder',
                serviceID,
                sortOrder: parseInt(sortOrder),
            }));
        }

        // Update event settings if this service has an event row
        if (eventServiceID) {
            promises.push(adminPost({
                action: 'updateService',
                eventServiceID,
                maxCapacity: maxCapacity !== '' ? parseInt(maxCapacity) : null,
                maxSeats: maxSeats !== '' ? parseInt(maxSeats) : null,
                standbyLimit: standbyLimit !== '' ? parseInt(standbyLimit) : null,
            }));
        }

        const results = await Promise.all(promises);
        const failed = results.find(r => !r.success);
        if (failed) throw new Error(failed.error);

        await loadAdminData();
        Swal.fire({ icon: 'success', title: 'Saved', timer: 1200, showConfirmButton: false });
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
// SECTION: Icon Picker (for Add New Service form)
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
// SECTION: Icon Edit Popup (for existing services)
// ═══════════════════════════════════════════════════════════════

async function handleEditIcon(e) {
    const row = e.target.closest('.service-row');
    const serviceID = row.dataset.serviceId;
    const currentIcon = row.dataset.iconTag || '';
    const isSvg = currentIcon.trim().startsWith('<');

    // Build the icon grid HTML
    const gridHTML = AVAILABLE_ICONS.map(icon => {
        const selected = (!isSvg && currentIcon === icon) ? 'selected' : '';
        return `<div class="icon-picker-item ${selected}" data-icon="${icon}" title="${icon.replace('bi-', '')}">
            <i class="bi ${icon}"></i>
        </div>`;
    }).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Change Icon',
        width: 520,
        html: `
            <div style="text-align:left;">
                <label class="form-label fw-semibold small">Bootstrap Icons</label>
                <div class="icon-picker-grid border rounded" id="editIconGrid" style="max-height:180px;overflow-y:auto;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:6px;">
                    ${gridHTML}
                </div>
                <hr>
                <label class="form-label fw-semibold small">Or paste custom SVG</label>
                <textarea id="editIconSvg" class="form-control form-control-sm" rows="3"
                    placeholder='<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>...</svg>'
                    style="font-family:monospace;font-size:0.75rem;">${isSvg ? currentIcon : ''}</textarea>
                <div class="mt-2 d-flex align-items-center gap-2">
                    <span class="text-muted small">Preview:</span>
                    <div id="editIconPreview" class="service-icon-preview" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#f0f4ff;border-radius:8px;font-size:1.25rem;color:#174593;">
                        ${renderIcon(currentIcon)}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-lg me-1"></i>Save',
        confirmButtonColor: '#174593',
        didOpen: (popup) => {
            let selectedIcon = isSvg ? '' : currentIcon;
            const svgInput = popup.querySelector('#editIconSvg');
            const preview = popup.querySelector('#editIconPreview');

            // Grid item click
            popup.querySelectorAll('.icon-picker-item').forEach(item => {
                item.addEventListener('click', () => {
                    popup.querySelectorAll('.icon-picker-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    selectedIcon = item.dataset.icon;
                    svgInput.value = ''; // clear SVG when picking a BI icon
                    preview.innerHTML = renderIcon(selectedIcon);
                });
            });

            // SVG textarea input
            svgInput.addEventListener('input', () => {
                const val = svgInput.value.trim();
                if (val.startsWith('<')) {
                    popup.querySelectorAll('.icon-picker-item').forEach(i => i.classList.remove('selected'));
                    selectedIcon = '';
                    preview.innerHTML = renderIcon(val);
                }
            });
        },
        preConfirm: () => {
            const popup = Swal.getPopup();
            const svgVal = popup.querySelector('#editIconSvg').value.trim();
            const selectedBI = popup.querySelector('.icon-picker-item.selected');

            if (svgVal.startsWith('<')) {
                return { iconTag: svgVal };
            } else if (selectedBI) {
                return { iconTag: selectedBI.dataset.icon };
            } else {
                Swal.showValidationMessage('Please select an icon or paste SVG.');
                return false;
            }
        }
    });

    if (!formValues) return; // cancelled

    try {
        const result = await adminPost({
            action: 'updateIcon',
            serviceID,
            iconTag: formValues.iconTag,
        });

        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Icon Updated', timer: 1200, showConfirmButton: false });
            await loadAdminData();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

// ═══════════════════════════════════════════════════════════════
// SECTION: Add Service Form
// ═══════════════════════════════════════════════════════════════

// Toggle parent dropdown visibility based on service type
document.getElementById('newServiceType').addEventListener('change', function () {
    const parentGroup = document.getElementById('parentServiceGroup');
    parentGroup.style.display = this.value === 'operational' ? '' : 'none';
});

document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const serviceID = document.getElementById('newServiceID').value.trim();
    const serviceName = document.getElementById('newServiceName').value.trim();
    const iconTag = document.getElementById('newServiceIcon').value;
    const serviceType = document.getElementById('newServiceType').value;
    const parentServiceID = document.getElementById('newParentServiceID').value || null;
    const sortOrder = parseInt(document.getElementById('newSortOrder').value) || 0;

    if (!serviceID || !serviceName) {
        Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Service ID and Name are required.' });
        return;
    }

    if (!iconTag) {
        Swal.fire({ icon: 'warning', title: 'No Icon', text: 'Please select an icon for the service.' });
        return;
    }

    if (serviceType === 'operational' && !parentServiceID) {
        Swal.fire({ icon: 'warning', title: 'Missing Parent', text: 'Operational services must have a parent category.' });
        return;
    }

    try {
        const result = await adminPost({
            action: 'addService',
            serviceID,
            serviceName,
            iconTag,
            serviceType,
            parentServiceID: serviceType === 'operational' ? parentServiceID : null,
            sortOrder,
        });

        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Service Added', timer: 1500, showConfirmButton: false });
            document.getElementById('addServiceForm').reset();
            document.getElementById('newServiceIcon').value = '';
            document.getElementById('parentServiceGroup').style.display = 'none';
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
// SECTION: Fast Track Settings
// ═══════════════════════════════════════════════════════════════

function renderFastTrackSection() {
    const container = document.getElementById('fastTrackSection');
    if (!container) return;

    const settings = adminData.eventSettings || {};
    const limit = settings.FastTrackLimit || '0';
    const used = adminData.fastTrackUsed || 0;

    container.innerHTML = `
        <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="form-group" style="max-width: 120px;">
                <label class="form-label fw-semibold small mb-1">Fast Track Limit</label>
                <input type="number" class="form-control form-control-sm" id="inputFastTrackLimit"
                    value="${limit}" min="0" max="50" inputmode="numeric">
            </div>
            <div class="pt-3">
                <span class="badge ${used >= parseInt(limit) && parseInt(limit) > 0 ? 'bg-warning text-dark' : 'bg-info'}"
                    style="font-size: 0.8rem;">
                    ⚡ ${used}/${limit} used
                </span>
            </div>
            <div class="pt-3">
                <button class="btn btn-sm btn-primary" id="btnSaveFastTrack">
                    <i class="bi bi-check-lg me-1"></i>Save
                </button>
            </div>
        </div>
        <div class="text-muted small mt-2">
            First N dental patients skip medical and go straight to dental.
        </div>
    `;

    document.getElementById('btnSaveFastTrack').addEventListener('click', async () => {
        const val = document.getElementById('inputFastTrackLimit').value.trim();
        try {
            const result = await adminPost({
                action: 'updateEventSetting',
                settingKey: 'FastTrackLimit',
                settingValue: val,
            });
            if (result.success) {
                Swal.fire({ icon: 'success', title: 'Saved', text: `Fast track limit set to ${val}.`, timer: 1500, showConfirmButton: false });
                await loadAdminData();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

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
