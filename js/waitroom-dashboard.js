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
let autoRefreshEnabled = true;
let autoRefreshTimerId = null;
let hasWaitingRoomInitialized = false;
// 10 sec refresh
const AUTO_REFRESH_INTERVAL_MS = 10 * 1000;
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
const autoRefreshToggleBtn = document.getElementById('autoRefreshToggleBtn');
const autoRefreshToggleText = document.getElementById('autoRefreshToggleText');

// Grab the single element for Now Serving
const nowServingNameEl = document.querySelector('.queue-name');
const nowServingServiceEl = document.querySelector('.queue-service');
const nowServingSeatStatsEl = document.getElementById('nowServingSeatStats');

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

function renderNowServingSeatStats(services) {
    if (!nowServingSeatStatsEl) return;

    const list = Array.isArray(services) ? services : [];
    const excludedCategoryIds = new Set(['dental', 'medical']);
    const visibleServices = list.filter(service => {
        const serviceId = String(service?.ServiceID || '').toLowerCase();
        return !excludedCategoryIds.has(serviceId);
    });

    if (!visibleServices.length) {
        nowServingSeatStatsEl.innerHTML = '<p class="mb-0 text-muted small">Seat capacity unavailable.</p>';
        return;
    }

    const getFallbackGroupName = (serviceId) => {
        const normalized = String(serviceId || '').toLowerCase();
        for (const [filterKey, ids] of Object.entries(QUEUE_FILTER_SERVICE_IDS)) {
            if (filterKey === 'all') continue;
            if ((ids || []).some(id => String(id).toLowerCase() === normalized)) {
                return filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
            }
        }
        return '';
    };

    const groups = new Map();
    visibleServices.forEach(service => {
        const serviceId = String(service.ServiceID || '');
        const parentId = service.ParentServiceID ? String(service.ParentServiceID) : '';
        const normalizedServiceId = serviceId.toLowerCase();
        const normalizedParentId = parentId.toLowerCase();
        const parentName = String(service.ParentServiceName || '').trim();
        const fallbackGroupName = getFallbackGroupName(serviceId);
        const groupKey = normalizedParentId || normalizedServiceId || fallbackGroupName;
        const groupLabel = parentName || fallbackGroupName || String(service.ServiceName || 'Service');
        const groupPriority = servicePriorityMap[parentId] ?? servicePriorityMap[serviceId] ?? 999;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                key: groupKey,
                label: groupLabel,
                priority: groupPriority,
                seatsInUse: 0,
                maxSeats: 0,
                services: [],
            });
        }

        const entry = groups.get(groupKey);
        const current = Number(service.SeatsInProgress || 0);
        const max = Number(service.MaxSeats || 0);
        entry.seatsInUse += current;
        entry.maxSeats += max;
        entry.services.push(service);
        entry.priority = Math.min(entry.priority, groupPriority);
    });

    const orderedGroups = [...groups.values()].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.label.localeCompare(b.label);
    });

    const groupMarkup = orderedGroups.map(group => {
        const orderedServices = [...group.services].sort((a, b) => {
            const pa = servicePriorityMap[a.ServiceID] ?? 999;
            const pb = servicePriorityMap[b.ServiceID] ?? 999;
            if (pa !== pb) return pa - pb;
            return String(a.ServiceName || '').localeCompare(String(b.ServiceName || ''));
        });

        const serviceLines = orderedServices.map(service => {
            const current = Number(service.SeatsInProgress || 0);
            const max = Number(service.MaxSeats || 0);
            const isClosed = !!service.IsClosed;
            const statusClass = isClosed
                ? 'is-closed'
                : ((max > 0 && current >= max) ? 'is-full' : 'is-current');
            return `
                <div class="now-serving-seat-service ${statusClass}">
                    <span class="now-serving-seat-service-left">
                        <span class="waitlist-service-dot now-serving-seat-dot" aria-hidden="true"></span>
                        <span class="now-serving-seat-service-name">${escapeHtml(service.ServiceName)}</span>
                    </span>
                    <span class="now-serving-seat-service-count">
                        <span class="now-serving-seat-service-used">${current}</span>
                        <span class="now-serving-seat-count-slash" aria-hidden="true">/</span>
                        <span class="now-serving-seat-service-total">${max}</span>
                    </span>
                </div>
            `;
        }).join('');

        return `
            <section class="now-serving-seat-group">
                <div class="now-serving-seat-group-head">
                    <span class="now-serving-seat-group-title">${escapeHtml(group.label)}</span>
                </div>
                <div class="now-serving-seat-service-list">${serviceLines}</div>
            </section>
        `;
    }).join('');

    const renderedGroups = groupMarkup || '<div class="now-serving-seat-empty">No active seats to display.</div>';

    nowServingSeatStatsEl.innerHTML = `
        <div class="now-serving-seat-header">Seats In Use</div>
        <div class="now-serving-seat-shell">
            <div class="now-serving-seat-table-head">
                <span class="now-serving-seat-col now-serving-seat-col-service">Service</span>
                <span class="now-serving-seat-col now-serving-seat-col-count">Used / Total</span>
            </div>
            <div class="now-serving-seat-groups">${renderedGroups}</div>
        </div>
    `;
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
        case 'Standby': return { text: 'Standby', class: 'bg-standby' };
        default: return { text: 'Not Added', class: 'bg-light text-muted' };
    }
}

function stopAutoRefresh() {
    if (autoRefreshTimerId) {
        clearInterval(autoRefreshTimerId);
        autoRefreshTimerId = null;
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    if (!autoRefreshEnabled) return;

    autoRefreshTimerId = setInterval(() => {
        fetchQueueData();
    }, AUTO_REFRESH_INTERVAL_MS);
}

function updateAutoRefreshToggleUI() {
    if (!autoRefreshToggleBtn) return;

    autoRefreshToggleBtn.setAttribute('aria-pressed', autoRefreshEnabled ? 'true' : 'false');
    autoRefreshToggleBtn.setAttribute('title', autoRefreshEnabled ? 'Turn off auto refresh' : 'Turn on auto refresh');
    autoRefreshToggleBtn.classList.toggle('btn-outline-light', autoRefreshEnabled);
    autoRefreshToggleBtn.classList.toggle('btn-light', !autoRefreshEnabled);
    autoRefreshToggleBtn.classList.toggle('text-primary', !autoRefreshEnabled);

    if (autoRefreshToggleText) {
        autoRefreshToggleText.textContent = autoRefreshEnabled ? 'Auto: On' : 'Auto: Off';
    }
}

function setAutoRefreshEnabled(enabled) {
    autoRefreshEnabled = enabled;
    updateAutoRefreshToggleUI();
    startAutoRefresh();
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
        title: 'WARNING',
        html: `
            <div class="text-start">
                <p class="mb-2 fw-bold text-danger">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    You are about to permanently abandon this client.
                </p>
                <ul class="mb-2 ps-3">
                    <li><strong>Permanently removes</strong> them from the queue.</li>
                    <li>They will <strong>not be called</strong> to any service.</li>
                    <li>This action <strong>cannot be undone</strong> or reversed.</li>
                </ul>
                <p class="mb-0 text-muted small">Only continue if you are absolutely certain.</p>
            </div>
        `,
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Yes, Abandon Client',
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'Go Back',
        allowOutsideClick: false,
        reverseButtons: true,
        didOpen: (popup) => {
            if (typeof popup.animate === 'function') {
                popup.animate(
                    [
                        { transform: 'translate3d(0, 0, 0)' },
                        { transform: 'translate3d(-6px, 1px, 0) rotate(-0.6deg)' },
                        { transform: 'translate3d(6px, -1px, 0) rotate(0.6deg)' },
                        { transform: 'translate3d(-5px, 0, 0) rotate(-0.4deg)' },
                        { transform: 'translate3d(5px, 0, 0) rotate(0.4deg)' },
                        { transform: 'translate3d(0, 0, 0)' }
                    ],
                    {
                        duration: 520,
                        iterations: 2,
                        easing: 'linear'
                    }
                );
            }
        }
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
            renderNowServingSeatStats(availableServices);

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
            const getRank = (p) => {
                if (p.IsAbandoned) return 2;
                if (p.AllServicesComplete) return 1;
                return 0;
            };
            return getRank(a) - getRank(b);
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
        const hasInProgressService = orderedVisitServices.some(vs => vs.ServiceStatus === 'In-Progress');
        const hasFastTrackedService = orderedVisitServices.some(vs => {
            const isFastTracked = Number(vs.IsFastTracked || 0) === 1;
            const isActive = ['Pending', 'Standby', 'In-Progress'].includes(vs.ServiceStatus);
            return isFastTracked && isActive;
        });
        const rowStatusClass = isAbandoned
            ? 'waitlist-row-abandoned'
            : (allDone
                ? 'waitlist-row-completed'
                : (wasSkipped
                    ? 'waitlist-row-skipped'
                    : (hasInProgressService ? 'waitlist-row-has-station' : 'waitlist-row-waiting')));
        const nameStateBadge = isAbandoned
            ? '<span class="waitlist-abandoned-badge">Abandoned</span>'
            : '';
        const fastTrackNameBadge = hasFastTrackedService
            ? '<span class="waitlist-fast-track-badge">Fast Track</span>'
            : '';
        const serviceListItems = orderedVisitServices.map(vs => {
            const isCurrentStation = vs.ServiceStatus === 'In-Progress';
            const isCompletedStation = vs.ServiceStatus === 'Complete';
            const isStandbyStation = vs.ServiceStatus === 'Standby';
            const statusClass = isCurrentStation
                ? 'is-current'
                : (isCompletedStation ? 'is-complete' : 'is-pending');
            const hereNowBadge = isCurrentStation
                ? '<span class="waitlist-here-now-badge">Here now</span>'
                : '';
            const standbyBadge = isStandbyStation
                ? '<span class="waitlist-standby-badge">Standby</span>'
                : '';

            return `
                <div class="waitlist-service-item ${statusClass}">
                    <span class="waitlist-service-dot" aria-hidden="true"></span>
                    <span class="waitlist-service-name">${escapeHtml(vs.ServiceName)}</span>
                    ${hereNowBadge}
                    ${standbyBadge}
                </div>
            `;
        }).join('');
        const serviceListHTML = serviceListItems
            ? `<div class="waitlist-service-list">${serviceListItems}</div>`
            : '<div class="small text-muted mt-1">No services assigned</div>';
        const avatarClass = 'waitlist-avatar-primary text-white';
        const avatarIcon  = isAbandoned
            ? 'bi-person-x'
            : (wasSkipped ? 'bi-skip-forward-fill' : (allDone ? 'bi-check-lg' : (atService ? 'bi-arrow-right-circle' : 'bi-person')));
        const isNowServing = patient.ClientID == nowServingClientId;
        const finalAvatarClass = isNowServing
            ? 'waitlist-avatar-primary waitlist-now-serving-avatar text-white'
            : avatarClass;
        const finalAvatarIconHTML = isNowServing
            ? '<i class="bi bi-person waitlist-now-serving-avatar-icon"></i>'
            : (wasSkipped
                ? `<i class="bi ${avatarIcon}"></i>`
                : (atService
                ? renderAvatarIconMarkup(inProgressIconTag, avatarIcon, 'text-white')
                : `<i class="bi ${avatarIcon}"></i>`));
        const currentServiceLabel = String(inProgressService?.ServiceName || atService || '').trim();
        const hasStandbyService = orderedVisitServices.some(vs => vs.ServiceStatus === 'Standby');
        const avatarTooltip = (() => {
            if (isNowServing) {
                return currentServiceLabel ? `Now serving: Currently at ${currentServiceLabel}` : 'Now serving client';
            }
            if (isAbandoned) return 'Abandoned client';
            if (wasSkipped) return 'Skipped this turn';
            if (allDone) return 'All services complete';
            if (currentServiceLabel) return `Currently at ${currentServiceLabel}`;
            if (hasStandbyService) return 'On standby';
            return 'Waiting for service';
        })();
        const finalAvatarStyle = '';
        const nameClass = isNowServing ? 'waitlist-now-serving-name' : '';
        const nowServingNameBadge = isNowServing ? '<span class="waitlist-now-serving-badge">Now serving</span>' : '';
        const btnClass = (allDone || isAbandoned) ? 'btn-outline-secondary' : 'btn-primary';
        const btnText  = allDone ? 'View' : (isAbandoned ? 'View' : 'Update');
        const rowClass = ['border-bottom', rowStatusClass, (isNowServing ? 'waitlist-now-serving-row' : '')]
            .filter(Boolean)
            .join(' ');
        const rowHTML = `
            <tr class="${rowClass}" data-client-id="${patient.ClientID}">
                <td class="ps-3 py-3">
                    <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center ${finalAvatarClass} flex-shrink-0" style="width: 30px; height: 30px; ${finalAvatarStyle} cursor: help;" title="${escapeHtml(avatarTooltip)}" aria-label="${escapeHtml(avatarTooltip)}">
                            ${finalAvatarIconHTML}
                        </div>
                        <div class="d-flex flex-column" style="min-width: 0; gap: 0.12rem;">
                            <div class="d-flex align-items-center flex-wrap gap-1" style="min-width: 0;">
                                <span class="fw-bold text-dark ${nameClass}">${escapeHtml(patient.FirstName)} ${escapeHtml(patient.LastName)}</span>
                                ${nameStateBadge}
                                ${fastTrackNameBadge}
                                ${nowServingNameBadge}
                            </div>
                            ${serviceListHTML}
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
    const getStatusBadgeMarkup = (status) => {
        if (status === 'In-Progress') {
            return '<span class="waitlist-here-now-badge">In Progress</span>';
        }
        if (status === 'Standby') {
            return '<span class="waitlist-standby-badge">Standby</span>';
        }
        return '';
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
        container.innerHTML = '<div class="waitlist-modal-note waitlist-modal-note-danger mb-2">This client is marked as abandoned.</div>';
        visitServices.forEach(vs => {
            const isInProgress = vs.ServiceStatus === 'In-Progress';
            const isComplete = vs.ServiceStatus === 'Complete';
            const isStandby = vs.ServiceStatus === 'Standby';
            const dotStatusClass = isInProgress ? 'is-current' : (isComplete ? 'is-complete' : 'is-pending');
            const rowStatusClass = isInProgress ? 'is-current' : (isComplete ? 'is-complete' : (isStandby ? 'is-standby' : 'is-pending'));
            const row = document.createElement('div');
            row.className = `d-flex align-items-center justify-content-between px-3 py-2 rounded-2 waitlist-modal-service-row ${rowStatusClass}`;
            row.innerHTML = `
                <div class="waitlist-service-item ${dotStatusClass}">
                    <span class="waitlist-service-dot" aria-hidden="true"></span>
                    <span class="fw-semibold waitlist-modal-service-name ${isComplete ? 'is-complete' : ''}" style="font-size: 0.9rem;">${escapeHtml(vs.ServiceName)}</span>
                    ${getStatusBadgeMarkup(vs.ServiceStatus)}
                </div>`;
            container.appendChild(row);
        });
        return;
    }

    const hasInProgress = visitServices.some(v => v.ServiceStatus === 'In-Progress');

    visitServices.forEach(vs => {
        const status = vs.ServiceStatus;
        const isPending = status === 'Pending';
        const isInProgress = status === 'In-Progress';
        const isComplete = status === 'Complete';
        const isStandby = status === 'Standby';
        const dotStatusClass = isInProgress ? 'is-current' : (isComplete ? 'is-complete' : 'is-pending');
        const rowStatusClass = isInProgress ? 'is-current' : (isComplete ? 'is-complete' : (isStandby ? 'is-standby' : 'is-pending'));

        let actionBtn = '';
        if (isPending) {
            if (hasInProgress) {
                actionBtn = '<button class="btn btn-outline-secondary btn-sm rounded-2 px-3 waitlist-modal-action-btn" disabled title="Check out current service first">Check In</button>';
            } else {
                actionBtn = `<button class="btn btn-primary btn-sm svc-toggle-btn rounded-2 px-3 waitlist-modal-action-btn" data-service-id="${vs.ServiceID}" data-action="checkin">Check In</button>`;
            }
        } else if (isStandby) {
            if (hasInProgress) {
                actionBtn = '<button class="btn btn-outline-secondary btn-sm rounded-2 px-3 waitlist-modal-action-btn" disabled title="Check out current service first">Check In</button>';
            } else {
                actionBtn = `<button class="btn btn-primary btn-sm svc-toggle-btn rounded-2 px-3 waitlist-modal-action-btn" data-service-id="${vs.ServiceID}" data-action="checkin">Check In</button>`;
            }
        } else if (isInProgress) {
            actionBtn = `<button class="btn btn-primary btn-sm svc-toggle-btn rounded-2 px-3 waitlist-modal-action-btn" data-service-id="${vs.ServiceID}" data-action="checkout">Check Out</button>`;
        }

        const row = document.createElement('div');
        row.className = `d-flex align-items-center justify-content-between px-3 py-2 rounded-2 waitlist-modal-service-row ${rowStatusClass}`;
        row.innerHTML = `
            <div class="waitlist-service-item ${dotStatusClass}">
                <span class="waitlist-service-dot" aria-hidden="true"></span>
                <span class="fw-semibold waitlist-modal-service-name ${isComplete ? 'is-complete' : ''}" style="font-size: 0.9rem;">${escapeHtml(vs.ServiceName)}</span>
                ${getStatusBadgeMarkup(vs.ServiceStatus)}
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
    if (hasWaitingRoomInitialized) return;
    hasWaitingRoomInitialized = true;

    loadQueueFilterIcons();
    fetchQueueData();
    updateAutoRefreshToggleUI();
    startAutoRefresh();

    if (autoRefreshToggleBtn) {
        autoRefreshToggleBtn.addEventListener('click', () => {
            setAutoRefreshEnabled(!autoRefreshEnabled);
        });
    }

    const refreshBtn = document.getElementById('refreshQueueBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const refreshPromise = fetchQueueData();
            if (autoRefreshEnabled) startAutoRefresh();
            return spinRefreshBtn(refreshBtn, refreshPromise);
        });
    }
}

// Wait for PIN verification before loading any data
document.addEventListener('pinVerified', init);

// Also handle the case where the session was already verified before this script ran
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('pin-verified')) {
        init();
    }
});
