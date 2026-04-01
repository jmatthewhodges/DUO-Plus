/**
 * ============================================================
 * File:            waitroom-dashboard.js
 * Description:     Handles managing the waiting room dashboard.
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE
let waitListData = [];
let availableServices = [];
let servicePriorityMap = {};
let currentRowToUpdate = null;
let currentClientId = null;
let currentVisitId = null;
let nowServingClientId = null;
let currentQueueFilter = 'all';
let currentSearchTerm = '';
const QUEUE_FILTER_SERVICE_IDS = {
    all: [],
    dental: ['dental', 'dentalHygiene', 'dentalExtraction'],
    optical: ['optical'],
    medical: ['medical', 'medicalExam', 'medicalFollowUp'],
    haircut: ['haircut'],
};

const QUEUE_FILTER_FALLBACK_ICONS = {
    dental: 'bi-bandaid',
    optical: 'bi-eyeglasses',
    medical: 'bi-clipboard2-pulse',
    haircut: 'bi-scissors',
};

//================================================================================
// 2. DOM REFERENCES
const tableBody = document.querySelector('tbody');
const updateModal = document.getElementById('updateStatusModal');
const waitListCountLabel = document.getElementById('waitlist-header-count');
const queueFilterButtons = document.querySelectorAll('.queue-filter-btn');

// Grab the single element for Now Serving
const nowServingNameEl = document.querySelector('.queue-name');
const nowServingServiceEl = document.querySelector('.queue-service');

//================================================================================
// 3. HELPERS

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

function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const parts = dateString.split(/[- ]/);
    if (parts.length >= 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateString;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAvatarIconMarkup(iconTag, fallbackBi, extraClasses = '') {
    const safeFallback = fallbackBi || 'bi-person';
    const cls = extraClasses ? ` ${extraClasses}` : '';
    if (iconTag && typeof iconTag === 'string') {
        const trimmed = iconTag.trim();
        if (trimmed.includes('<svg')) {
            const svg = trimmed.replace(/<svg/, '<svg style="width:1em;height:1em;fill:currentColor;"');
            return `<span class="svg-icon${cls}" style="display:inline-flex;align-items:center;justify-content:center;">${svg}</span>`;
        }
        if (trimmed.startsWith('bi-')) {
            return `<i class="bi ${trimmed}${cls}"></i>`;
        }
    }
    return `<i class="bi ${safeFallback}${cls}"></i>`;
}

function closeUpdateModal() {
    updateModal.classList.add('d-none');
    updateModal.classList.remove('d-flex');
}

function getFilterIconTag(filterKey, categories) {
    const allowedServiceIDs = (QUEUE_FILTER_SERVICE_IDS[filterKey] || []).map(id => String(id).toLowerCase());
    if (!allowedServiceIDs.length) return '';
    const matched = (categories || []).find(cat => allowedServiceIDs.includes(String(cat.ServiceID || '').toLowerCase()));
    return matched?.IconTag || '';
}

function applyQueueFilterIcons(categories) {
    queueFilterButtons.forEach(btn => {
        const filterKey = btn.getAttribute('data-filter') || '';
        if (!filterKey || filterKey === 'all') return;

        const fallback = QUEUE_FILTER_FALLBACK_ICONS[filterKey] || 'bi-circle';
        const iconTag = getFilterIconTag(filterKey, categories);
        const iconMarkup = renderAvatarIconMarkup(iconTag, fallback, 'me-1');
        const existingIcon = btn.querySelector('.bi, .svg-icon');

        if (existingIcon) {
            existingIcon.outerHTML = iconMarkup;
        } else {
            btn.insertAdjacentHTML('afterbegin', iconMarkup);
        }
    });
}

async function loadQueueFilterIcons() {
    try {
        const response = await fetch('../api/services.php?view=categories');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.categories)) return;
        applyQueueFilterIcons(data.categories);
    } catch (error) {
        console.error('Failed to load queue filter icons:', error);
    }
}

function matchesQueueFilter(patient, filterKey) {
    if (filterKey === 'all') return true;
    const allowed = QUEUE_FILTER_SERVICE_IDS[filterKey] || [];
    if (!allowed.length) return true;
    const visitServices = patient.VisitServices || [];
    return visitServices.some(vs => {
        const inTargetServices = allowed.includes(vs.ServiceID);
        const stillRelevant = ['Pending', 'Standby', 'In-Progress', 'Complete'].includes(vs.ServiceStatus);
        return inTargetServices && stillRelevant;
    });
}

function matchesSearch(patient, term) {
    if (!term) return true;
    const name = `${patient.FirstName} ${patient.MiddleInitial || ''} ${patient.LastName}`.toLowerCase();
    const id = String(patient.ClientID || '').toLowerCase();
    return name.includes(term) || id.includes(term);
}

function applyTableFiltersAndRender() {
    const filtered = (waitListData || []).filter(patient =>
        matchesQueueFilter(patient, currentQueueFilter) && matchesSearch(patient, currentSearchTerm)
    );
    populateWaitListTable(filtered);
}

function getServiceStatusLabel(status) {
    switch (status) {
        case 'Pending': return { text: 'Pending', class: 'bg-light text-dark' };
        case 'In-Progress': return { text: 'In Progress', class: 'bg-info text-white' };
        case 'Complete': return { text: 'Complete', class: 'bg-success text-white' };
        case 'Standby': return { text: 'Standby', class: 'bg-warning text-dark' };
        default: return { text: 'Not Added', class: 'bg-light text-muted' };
    }
}

async function skipNowServingClient(clientId) {
    const result = await Swal.fire({
        title: 'Skip this client?',
        text: 'They will be skipped this turn.',
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Skip',
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;

    try {
        const response = await fetch('../api/SkipClient.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ClientID: clientId })
        });
        const data = await response.json();
        if (data.success) {
            Swal.fire({ icon: 'success', title: 'Skipped', text: 'Client moved back one position.', timer: 1200, showConfirmButton: false });
            fetchQueueData();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Could not skip client.' });
        }
    } catch (error) {
        console.error('Skip error:', error);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Unable to reach the server.' });
    }
}

async function abandonClient(clientId) {
    const result = await Swal.fire({
        title: 'This cannot be undone.',
        html: 'Marking this client as abandoned will <strong>permanently remove them from the queue</strong>. They will <strong>not be called to any service</strong> for the rest of the event and <strong>cannot be re-added</strong>.',
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Yes, Abandon',
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'Go Back',
        allowOutsideClick: false,
        reverseButtons: true
    });
    if (!result.isConfirmed) return;

    try {
        const response = await fetch('../api/AbandonClient.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ClientID: clientId })
        });
        const data = await response.json();
        if (data.success) {
            updateModal.classList.add('d-none');
            updateModal.classList.remove('d-flex');
            Swal.fire({ icon: 'success', title: 'Client Abandoned', text: 'This client has been permanently removed from the queue.', timer: 1500, showConfirmButton: false });
            fetchQueueData();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Could not abandon client.' });
        }
    } catch (error) {
        console.error('Abandon error:', error);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Unable to reach the server.' });
    }
}

//================================================================================
// 4. DATA FETCHING & RENDERING

async function fetchQueueData() {
    try {
        const response = await fetch('../api/waiting-room.php');
        const data = await response.json();

        if (data.success) {
            waitListData = data.WaitList;
            availableServices = data.Services || [];
            servicePriorityMap = data.ServicePriority || {};

            // 1. Update Now Serving safely
            const skipBtn = document.getElementById('skipNowServingBtn');
            if (nowServingNameEl) {
                if (data.NowServing && data.NowServing.length > 0) {
                    const serving = data.NowServing[0];
                    nowServingClientId = serving.ClientID;
                    nowServingNameEl.innerText = `${serving.FirstName} ${serving.LastName}`;

                    if (nowServingServiceEl) {
                        nowServingServiceEl.innerText = serving.AssignedServiceName || '';
                    }
                    if (skipBtn) skipBtn.classList.remove('d-none');
                } else {
                    nowServingClientId = null;
                    nowServingNameEl.innerText = "No one currently";
                    if (nowServingServiceEl) nowServingServiceEl.innerText = '';
                    if (skipBtn) skipBtn.classList.add('d-none');
                }
            }

            // 2. Populate the table
            applyTableFiltersAndRender();
        } else {
            console.error("Database Error:", data.error);
            Swal.fire({ icon: 'error', title: 'Data Error', text: 'Could not load waiting room data.' });
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

function populateWaitListTable(patients) {
    tableBody.innerHTML = '';

    // Sort: clients with all services complete go to the bottom
    if (patients && patients.length > 0) {
        patients = [...patients].sort((a, b) => {
            const aBottom = a.AllServicesComplete || a.IsAbandoned;
            const bBottom = b.AllServicesComplete || b.IsAbandoned;
            if (aBottom && !bBottom) return 1;
            if (!aBottom && bBottom) return -1;
            return 0;
        });
    }

    if (!patients || patients.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2" class="text-center p-3 text-muted">No patients in the waiting room.</td></tr>';
        if (waitListCountLabel) waitListCountLabel.innerText = `Wait List - 0`;
        return;
    }

    patients.forEach((patient) => {
        const allDone = patient.AllServicesComplete;
        const isAbandoned = patient.IsAbandoned;
        const atService = patient.CurrentServiceName;
        const inProgressService = (patient.VisitServices || []).find(v => v.ServiceStatus === 'In-Progress');
        const inProgressIconTag = inProgressService ? (inProgressService.IconTag || '') : '';
        const wasSkipped = patient.WasSkipped;
        const orderedVisitServices = [...(patient.VisitServices || [])].sort((a, b) => {
            const pa = servicePriorityMap[a.ServiceID] ?? 999;
            const pb = servicePriorityMap[b.ServiceID] ?? 999;
            if (pa !== pb) return pa - pb;
            return String(a.ServiceName || '').localeCompare(String(b.ServiceName || ''));
        });
        const chipBaseStyle = 'font-size: 0.65rem; font-weight: 500; border-radius: 999px; padding: 0.22rem 0.5rem; line-height: 1.2;';
        const completedPillStyle = `${chipBaseStyle} background-color: #198754; border-color: #198754 !important; color: #fff;`;
        const inProgressOtherPillStyle = `${chipBaseStyle} background-color: var(--bs-info); border-color: var(--bs-info) !important; color: #fff;`;
        const pendingPillStyle = `${chipBaseStyle} background-color: #f7f9fc; border-color: #d7deea !important; color: #212529;`;
        const nowServingPillStyle = `${chipBaseStyle} background-color: var(--bs-info); border-color: var(--bs-info) !important; color: #fff;`;
        let metaBadges = '';
        if (isAbandoned) {
            metaBadges = '<span class="badge bg-danger" style="font-size: 0.7rem;">Abandoned</span>';
        }
        if (!isAbandoned && wasSkipped) {
            metaBadges += '<i class="bi bi-skip-forward-fill text-warning" title="Skipped" style="font-size: 0.9rem;"></i>';
        }
        const currentServiceIDs = orderedVisitServices
            .filter(vs => vs.ServiceStatus === 'In-Progress')
            .map(vs => vs.ServiceID);
        const currentAtPills = orderedVisitServices
            .filter(vs => currentServiceIDs.includes(vs.ServiceID))
            .map(vs => `<span class="badge border" style="${nowServingPillStyle}">${escapeHtml(vs.ServiceName)}</span>`)
            .join('');
        const otherServices = orderedVisitServices.filter(vs => !currentServiceIDs.includes(vs.ServiceID));
        const servicePills = otherServices.map(vs => {
            let pillStyle = pendingPillStyle;
            if (vs.ServiceStatus === 'Complete') pillStyle = completedPillStyle;
            return `<span class="badge border" style="${pillStyle}">${escapeHtml(vs.ServiceName)}</span>`;
        }).join('');
        const currentlyAtCells = currentAtPills
            ? `<span class="small service-waitlist-label-text">Currently At:</span><div class="service-waitlist-badges-wrap">${currentAtPills}</div>`
            : '';
        const hasCurrentlyAt = !!currentlyAtCells;
        const servicesLabelClass = hasCurrentlyAt
            ? 'small service-waitlist-label-text'
            : 'small service-waitlist-label-text service-waitlist-label-services-only';
        const statusBlockClass = hasCurrentlyAt
            ? 'service-waitlist-status-block mt-1'
            : 'service-waitlist-status-block service-waitlist-services-only mt-1';
        const serviceCells = servicePills
            ? `<span class="${servicesLabelClass}">Services:</span><div class="service-waitlist-badges-wrap">${servicePills}</div>`
            : '';
        const groupedStatusHTML = (currentlyAtCells || serviceCells)
            ? `<div class="${statusBlockClass}">${currentlyAtCells}${serviceCells}</div>`
            : '';
        const avatarClass = isAbandoned
            ? 'bg-danger text-white'
            : (allDone ? 'bg-success text-white' : (atService ? 'bg-info text-white' : 'bg-light'));
        const avatarIcon  = isAbandoned
            ? 'bi-person-x'
            : (allDone ? 'bi-check-lg' : (atService ? 'bi-arrow-right-circle' : 'bi-person'));
        const isNowServing = patient.ClientID == nowServingClientId;
        const finalAvatarClass = isNowServing ? 'text-dark' : avatarClass;
        const finalAvatarIconHTML = isNowServing
            ? '<i class="bi bi-bell-fill waitlist-now-serving-bell"></i>'
            : (atService
                ? renderAvatarIconMarkup(inProgressIconTag, avatarIcon, 'text-white')
                : `<i class="bi ${avatarIcon}"></i>`);
        const finalAvatarStyle = isNowServing ? 'background-color: #ffe066;' : '';
        const nameClass = isNowServing ? 'waitlist-now-serving-name' : '';
        const btnClass = (allDone || isAbandoned) ? 'btn-outline-secondary' : 'btn-primary';
        const btnText  = allDone ? 'View' : (isAbandoned ? 'View' : 'Update');
        const rowHTML = `
            <tr class="border-bottom" style="${isNowServing ? 'background-color: #eef4ff;' : ''}" data-client-id="${patient.ClientID}">
                <td class="ps-3 py-3">
                    <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center ${finalAvatarClass} flex-shrink-0" style="width: 30px; height: 30px; ${finalAvatarStyle}">
                            ${finalAvatarIconHTML}
                        </div>
                        <div class="d-flex flex-column gap-1" style="min-width: 0;">
                            <span class="fw-bold text-dark ${nameClass}">${escapeHtml(patient.FirstName)} ${escapeHtml(patient.LastName)}</span>
                            ${metaBadges ? `<div class="d-flex flex-wrap gap-1">${metaBadges}</div>` : ''}
                            ${groupedStatusHTML}
                        </div>
                    </div>
                </td>
                <td class="text-end pe-3 py-3">
                    <button class="btn ${btnClass} btn-sm px-3 rounded-2 update-btn text-nowrap">${btnText}</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });

    if (waitListCountLabel) {
        waitListCountLabel.innerText = `Wait List - ${patients.length}`;
    }
}

//================================================================================
// 5. EVENT LISTENERS

tableBody.addEventListener('click', (event) => {
    // Handle skip button
    const skipBtn = event.target.closest('.skip-btn');
    if (skipBtn) {
        skipBtn.blur();
        const row = skipBtn.closest('tr');
        const clientId = row.getAttribute('data-client-id');
        skipNowServingClient(clientId);
        return;
    }

    // Handle update button
    const updateBtn = event.target.closest('.update-btn');
    if (updateBtn) {
        updateBtn.blur();
        currentRowToUpdate = updateBtn.closest('tr');
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');

        const patient = waitListData.find(p => p.ClientID == currentClientId);
        currentVisitId = patient.VisitID;
        document.getElementById('modalPatientName').innerText = `${patient.FirstName} ${patient.LastName}`;
        const modalPatientDob = document.getElementById('modalPatientDOB');
        if (modalPatientDob) {
            modalPatientDob.innerText = `DOB: ${formatDOB(patient.DOB)}`;
        }

        renderServiceToggles(patient);

        updateModal.classList.remove('d-none');
        updateModal.classList.add('d-flex');
    }
});

function renderServiceToggles(patient) {
    const container = document.getElementById('modalServiceToggles');
    container.innerHTML = '';
    const chipBaseStyle = 'font-size: 0.62rem; font-weight: 500; border-radius: 999px; padding: 0.2rem 0.5rem; line-height: 1.2;';
    const getStatusPillStyle = (status) => {
        if (status === 'In-Progress') return `${chipBaseStyle} background-color: var(--bs-info); border-color: var(--bs-info) !important; color: #fff;`;
        if (status === 'Complete') return `${chipBaseStyle} background-color: #198754; border-color: #198754 !important; color: #fff;`;
        return `${chipBaseStyle} background-color: #f7f9fc; border-color: #d7deea !important; color: #212529;`;
    };

    // Show/hide the abandon section based on whether the client is already abandoned or all done
    const abandonSection = document.getElementById('abandonSection');
    if (abandonSection) {
        const canAbandon = !patient.IsAbandoned && !patient.AllServicesComplete;
        abandonSection.classList.toggle('d-none', !canAbandon);
    }

    const visitServices = patient.VisitServices || [];

    if (visitServices.length === 0) {
        container.innerHTML = '<p class="text-muted small mb-0">No services assigned to this patient.</p>';
        return;
    }

    // Abandoned clients — show services read-only with a notice, no action buttons
    if (patient.IsAbandoned) {
        container.innerHTML = `<div class="alert alert-danger py-2 px-3 mb-2" style="font-size:0.85rem;">
            <i class="bi bi-person-x me-1"></i>This client has been marked as <strong>abandoned</strong> and will not be called to a service.
        </div>`;
        visitServices.forEach(vs => {
            const statusInfo = getServiceStatusLabel(vs.ServiceStatus);
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center justify-content-between px-3 py-2 rounded-2 border';
            row.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-semibold text-dark" style="font-size: 0.9rem;">${vs.ServiceName}</span>
                    <span class="badge border" style="${getStatusPillStyle(vs.ServiceStatus)}">${statusInfo.text}</span>
                </div>`;
            container.appendChild(row);
        });
        return;
    }

    const hasInProgress = visitServices.some(v => v.ServiceStatus === 'In-Progress');

    visitServices.forEach(vs => {
        const status = vs.ServiceStatus;
        const statusInfo = getServiceStatusLabel(status);
        const isPending = status === 'Pending';
        const isInProgress = status === 'In-Progress';
        const isComplete = status === 'Complete';
        const isStandby = status === 'Standby';

        let rowBg = 'border';
        if (isInProgress) rowBg = 'bg-soft-primary border border-primary border-opacity-25';
        else if (isComplete) rowBg = 'bg-soft-success border border-success border-opacity-25';
        else if (isStandby) rowBg = 'bg-soft-warning border border-warning border-opacity-25';

        let actionBtn = '';
        if (isPending) {
            if (hasInProgress) {
                actionBtn = `<button class="btn btn-outline-secondary btn-sm rounded-pill px-3" disabled style="font-size: 0.75rem;" title="Check out current service first">Check In</button>`;
            } else {
                actionBtn = `<button class="btn btn-outline-primary btn-sm svc-toggle-btn rounded-pill px-3" data-service-id="${vs.ServiceID}" data-action="checkin" style="font-size: 0.75rem;">Check In</button>`;
            }
        } else if (isStandby) {
            if (hasInProgress) {
                actionBtn = `<button class="btn btn-outline-secondary btn-sm rounded-pill px-3" disabled style="font-size: 0.75rem;" title="Check out current service first">Check In</button>`;
            } else {
                actionBtn = `<button class="btn btn-outline-warning btn-sm svc-toggle-btn rounded-pill px-3" data-service-id="${vs.ServiceID}" data-action="checkin" style="font-size: 0.75rem;">Check In</button>`;
            }
        } else if (isInProgress) {
            actionBtn = `<button class="btn btn-outline-success btn-sm svc-toggle-btn rounded-pill px-3" data-service-id="${vs.ServiceID}" data-action="checkout" style="font-size: 0.75rem;">Check Out</button>`;
        }

        const row = document.createElement('div');
        row.className = `d-flex align-items-center justify-content-between px-3 py-2 rounded-2 ${rowBg}`;
        row.innerHTML = `
            <div class="d-flex flex-column">
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-semibold text-dark" style="font-size: 0.9rem;">${vs.ServiceName}</span>
                    <span class="badge border" style="${getStatusPillStyle(vs.ServiceStatus)}">${statusInfo.text}</span>
                </div>
                ${isStandby ? '<span class="text-muted" style="font-size: 0.7rem;">If available only</span>' : ''}
            </div>
            <div>${actionBtn}</div>
        `;
        container.appendChild(row);
    });

    // Attach toggle listeners
    container.querySelectorAll('.svc-toggle-btn').forEach(btn => {
        btn.addEventListener('click', handleServiceToggle);
    });
}

async function handleServiceToggle(e) {
    const btn = e.target.closest('.svc-toggle-btn');
    btn.blur();
    const serviceID = btn.dataset.serviceId;
    const action = btn.dataset.action;
    const originalLabel = action === 'checkin' ? 'Check In' : 'Check Out';

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const res = await fetch('../api/UpdateVisitServices.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitID: currentVisitId, serviceID, action })
        });
        const data = await res.json();

        if (data.success) {
            // Refresh data and re-render modal
            await fetchQueueData();
            const updatedPatient = waitListData.find(p => p.ClientID == currentClientId);
            if (updatedPatient) {
                renderServiceToggles(updatedPatient);
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Failed to update service.' });
            btn.disabled = false;
            btn.innerHTML = originalLabel;
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Unable to reach the server.' });
        btn.disabled = false;
        btn.innerHTML = originalLabel;
    }
}

document.getElementById('cancelUpdateBtn').addEventListener('click', closeUpdateModal);

document.getElementById('abandonClientBtn').addEventListener('click', () => {
    if (currentClientId) abandonClient(currentClientId);
});

// Search filter
const waitlistSearchInput = document.getElementById('waitlist-search');
if (waitlistSearchInput) {
    waitlistSearchInput.addEventListener('input', function () {
        currentSearchTerm = this.value.trim().toLowerCase();
        applyTableFiltersAndRender();
    });
}

queueFilterButtons.forEach(btn => {
    btn.addEventListener('click', function () {
        const selected = this.getAttribute('data-filter') || 'all';
        currentQueueFilter = selected;
        queueFilterButtons.forEach(b => {
            const isActive = b.getAttribute('data-filter') === selected;
            b.classList.toggle('active', isActive);
            b.classList.toggle('btn-primary', isActive);
            b.classList.toggle('btn-outline-primary', !isActive);
        });
        applyTableFiltersAndRender();
    });
});

// Skip Now Serving button (in the Now Serving header area)
document.getElementById('skipNowServingBtn').addEventListener('click', function () {
    this.blur();
    if (!nowServingClientId) return;
    skipNowServingClient(nowServingClientId);
});

//================================================================================
// 6. INITIALIZATION

function init() {
    loadQueueFilterIcons();
    fetchQueueData();

    const refreshBtn = document.getElementById('refreshQueueBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => spinRefreshBtn(refreshBtn, fetchQueueData()));
}

// Wait for PIN verification before loading any data
document.addEventListener('pinVerified', init);

// Also handle the case where the session was already verified before this script ran
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('pin-verified')) {
        init();
    }
});
