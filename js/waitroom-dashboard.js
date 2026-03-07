/**
 * ============================================================
 * File:            waitroom-dashboard.js
 * Description:     Handles managing the waiting room dashboard.
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE
let waitListData = [];
let availableServices = []; 
let currentRowToUpdate = null;
let currentClientId = null;
let currentVisitId = null;
let nowServingClientId = null;

//================================================================================
// 2. DOM REFERENCES
const tableBody = document.querySelector('tbody');
const updateModal = document.getElementById('updateStatusModal');
const waitListCountLabel = document.getElementById('waitlist-header-count');

// Grab the single element for Now Serving
const nowServingNameEl = document.querySelector('.queue-name');
const nowServingServiceEl = document.querySelector('.queue-service');

//================================================================================
// 3. HELPERS

function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const parts = dateString.split(/[- ]/); 
    if(parts.length >= 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateString; 
}

function closeUpdateModal() {
    updateModal.classList.add('d-none');
    updateModal.classList.remove('d-flex');
}

function getServiceStatusLabel(status) {
    switch (status) {
        case 'Pending':     return { text: 'Pending', class: 'bg-warning text-dark' };
        case 'In-Progress': return { text: 'In Progress', class: 'bg-info text-white' };
        case 'Complete':    return { text: 'Complete', class: 'bg-success text-white' };
        case 'Standby':     return { text: 'Standby', class: 'bg-secondary text-white' };
        default:            return { text: 'Not Added', class: 'bg-light text-muted' };
    }
}

async function skipNowServingClient(clientId) {
    const result = await Swal.fire({
        title: 'Skip this client?',
        text: 'They will be moved to the back of the queue.',
        icon: 'warning',
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
            Swal.fire({ icon: 'success', title: 'Skipped', text: 'Client moved to back of queue.', timer: 1200, showConfirmButton: false });
            fetchQueueData();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Could not skip client.' });
        }
    } catch (error) {
        console.error('Skip error:', error);
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
            populateWaitListTable(waitListData);
        } else {
            console.error("Database Error:", data.error);
            Swal.fire({ icon: 'error', title: 'Data Error', text: 'Could not load waiting room data.'});
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

function populateWaitListTable(patients) {
    tableBody.innerHTML = '';

    if (!patients || patients.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients in the waiting room.</td></tr>';
        if (waitListCountLabel) waitListCountLabel.innerText = `Wait List - 0`;
        return;
    }

    patients.forEach((patient) => {
        const formattedDOB = formatDOB(patient.DOB);
        const allDone = patient.AllServicesComplete;
        const atService = patient.CurrentServiceName;
        const wasSkipped = patient.WasSkipped;
        let statusBadge = '';
        if (allDone) {
            statusBadge = '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">All Done</span>';
        } else if (atService) {
            statusBadge = `<span class="badge bg-info ms-2" style="font-size: 0.7rem;">At ${atService}</span>`;
        }
        if (wasSkipped) {
            statusBadge += '<span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem;">Skipped</span>';
        }
        const avatarClass = allDone ? 'bg-success text-white' : (atService ? 'bg-info text-white' : 'bg-light');
        const avatarIcon = allDone ? 'bi-check-lg' : (atService ? 'bi-arrow-right-circle' : 'bi-person');
        const isNowServing = patient.ClientID == nowServingClientId;
        const btnClass = allDone ? 'btn-outline-secondary' : (isNowServing ? 'btn-outline-danger' : 'btn-primary');
        const btnText = allDone ? 'Done' : (isNowServing ? 'Skip' : 'Update');
        const rowHTML = `
            <tr class="border-bottom" data-client-id="${patient.ClientID}">
                <td class="ps-3 d-block d-md-table-cell mb-2 mb-md-0">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center ${avatarClass} flex-shrink-0" style="width: 30px; height: 30px;">
                            <i class="bi ${avatarIcon}"></i>
                        </div>
                        <div class="d-flex flex-column">
                            <span class="fw-bold text-dark">${patient.FirstName} ${patient.LastName}${statusBadge}</span>
                            <span class="text-muted small d-md-none">DOB: ${formattedDOB}</span>
                        </div>
                    </div>
                </td>
                <td class="fw-medium d-none d-md-table-cell">${formattedDOB}</td>
                <td class="d-block d-md-table-cell text-end pe-3 mb-2 mb-md-0">
                    <button class="btn ${btnClass} btn-sm px-3 rounded-2 w-100 w-md-auto update-btn">${btnText}</button>
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
    const updateBtn = event.target.closest('.update-btn');
    if (updateBtn) {
        updateBtn.blur();
        currentRowToUpdate = updateBtn.closest('tr');
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');

        // If this is the now-serving client, skip instead of opening modal
        if (currentClientId == nowServingClientId) {
            skipNowServingClient(currentClientId);
            return;
        }
        
        const patient = waitListData.find(p => p.ClientID == currentClientId);
        currentVisitId = patient.VisitID;
        document.getElementById('modalPatientName').innerText = `${patient.FirstName} ${patient.LastName}`;
        
        renderServiceToggles(patient);

        updateModal.classList.remove('d-none');
        updateModal.classList.add('d-flex');
    }
});

// Parent/placeholder services that clients never get checked into directly
const EXCLUDED_SERVICE_IDS = ['medical', 'dental'];

function renderServiceToggles(patient) {
    const container = document.getElementById('modalServiceToggles');
    container.innerHTML = '';

    const visitServices = patient.VisitServices || [];
    const filteredServices = availableServices.filter(s => !EXCLUDED_SERVICE_IDS.includes(s.ServiceID));

    if (filteredServices.length === 0) {
        container.innerHTML = '<p class="text-muted small mb-0">No services available.</p>';
        return;
    }

    filteredServices.forEach(service => {
        const vs = visitServices.find(v => v.ServiceID === service.ServiceID);
        const status = vs ? vs.ServiceStatus : null;
        const isActive = status === 'Pending' || status === 'In-Progress';
        const isComplete = status === 'Complete';
        const statusInfo = getServiceStatusLabel(status);

        const row = document.createElement('div');
        row.className = `d-flex align-items-center justify-content-between px-3 py-2 rounded-2 ${isActive ? 'bg-soft-primary border border-primary border-opacity-25' : 'border'}`;
        row.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <span class="fw-semibold text-dark" style="font-size: 0.9rem;">${service.ServiceName}</span>
                ${status ? `<span class="badge ${statusInfo.class}" style="font-size: 0.6rem;">${statusInfo.text}</span>` : ''}
            </div>
            <div>
                ${isActive
                    ? `<button class="btn btn-outline-danger btn-sm svc-toggle-btn rounded-pill px-3" data-service-id="${service.ServiceID}" data-action="remove" style="font-size: 0.75rem;">Remove</button>`
                    : `<button class="btn btn-outline-primary btn-sm svc-toggle-btn rounded-pill px-3" data-service-id="${service.ServiceID}" data-action="add" style="font-size: 0.75rem;">${isComplete ? 'Re-add' : 'Add'}</button>`
                }
            </div>
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
            btn.innerHTML = action === 'add' ? 'Add' : 'Remove';
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Unable to reach the server.' });
        btn.disabled = false;
        btn.innerHTML = action === 'add' ? 'Add' : 'Remove';
    }
}

document.getElementById('cancelUpdateBtn').addEventListener('click', closeUpdateModal);

// Search filter
const waitlistSearchInput = document.getElementById('waitlist-search');
if (waitlistSearchInput) {
    waitlistSearchInput.addEventListener('input', function () {
        const term = this.value.trim().toLowerCase();
        if (!term) {
            populateWaitListTable(waitListData);
            return;
        }
        const filtered = waitListData.filter(p => {
            const name = `${p.FirstName} ${p.MiddleInitial || ''} ${p.LastName}`.toLowerCase();
            return name.includes(term);
        });
        populateWaitListTable(filtered);
    });
}

// Skip Now Serving button (in the Now Serving header area)
document.getElementById('skipNowServingBtn').addEventListener('click', function() {
    this.blur();
    if (!nowServingClientId) return;
    skipNowServingClient(nowServingClientId);
});

//================================================================================
// 6. INITIALIZATION

function init() {
    fetchQueueData();

    const refreshBtn = document.getElementById('refreshQueueBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchQueueData);
}

init();