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

//================================================================================
// 2. DOM REFERENCES
const tableBody = document.querySelector('tbody');
const updateModal = document.getElementById('updateStatusModal');
const waitListCountLabel = document.getElementById('waitlist-header-count');
const moveServiceSelect = document.getElementById('moveServiceSelect');

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

function buildServiceButton(state, iconTag, serviceName) {
    let colorClass = state ? 'btn-success' : 'btn-secondary bg-secondary bg-opacity-25 border-0';
    let iconColor = state ? 'text-white' : 'text-muted opacity-50';
    let safeIcon = iconTag || 'bi-gear'; 
    
    return `
        <button class="btn ${colorClass} btn-sm rounded-2 shadow-sm" disabled title="${serviceName}"
                style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${safeIcon} ${iconColor}" style="font-size: 1.2rem;"></i>
        </button>
    `;
}

function closeUpdateModal() {
    updateModal.classList.add('d-none');
    updateModal.classList.remove('d-flex');
}

function hasService(serviceSelections, serviceId) {
    if (!serviceSelections) return false;
    const services = serviceSelections.toString().split(',');
    return services.includes(serviceId.toString());
}

function populateServiceDropdown() {
    moveServiceSelect.innerHTML = '<option value="" selected disabled>Select a department...</option>';
    availableServices.forEach(service => {
        const optionHTML = `<option value="${service.ServiceID}">${service.ServiceName}</option>`;
        moveServiceSelect.insertAdjacentHTML('beforeend', optionHTML);
    });
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
            
            populateServiceDropdown();

            // 1. Update Now Serving safely
            if (nowServingNameEl) {
                if (data.NowServing && data.NowServing.length > 0) {
                    const serving = data.NowServing[0];
                    nowServingNameEl.innerText = `${serving.FirstName} ${serving.LastName}`;
                    
                    if (nowServingServiceEl) {
                        nowServingServiceEl.innerText = serving.AssignedServiceName || '';
                    }
                } else {
                    nowServingNameEl.innerText = "No one currently";
                    if (nowServingServiceEl) nowServingServiceEl.innerText = '';
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
        const doneBadge = allDone
            ? '<span class="badge bg-success ms-2" style="font-size: 0.7rem;">All Done</span>'
            : '';
        const avatarClass = allDone ? 'bg-success text-white' : 'bg-light';
        const avatarIcon = allDone ? 'bi-check-lg' : 'bi-person';
        const btnClass = allDone ? 'btn-outline-secondary' : 'btn-primary';
        const btnText = allDone ? 'Done' : 'Update';
        const rowHTML = `
            <tr class="border-bottom" data-client-id="${patient.ClientID}">
                <td class="ps-3 d-block d-md-table-cell mb-2 mb-md-0">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center ${avatarClass} flex-shrink-0" style="width: 30px; height: 30px;">
                            <i class="bi ${avatarIcon}"></i>
                        </div>
                        <div class="d-flex flex-column">
                            <span class="fw-bold text-dark">${patient.FirstName} ${patient.LastName}${doneBadge}</span>
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
        currentRowToUpdate = updateBtn.closest('tr');
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');
        
        const patient = waitListData.find(p => p.ClientID == currentClientId);
        document.getElementById('modalPatientName').innerText = `${patient.FirstName} ${patient.LastName}`;
        
        const statusContainer = document.getElementById('modalServiceStatus');
        statusContainer.innerHTML = ''; 
        
        availableServices.forEach(service => {
            const isSelected = hasService(patient.ServiceSelections, service.ServiceID);
            statusContainer.innerHTML += buildServiceButton(isSelected, service.IconTag, service.ServiceName);
        });

        updateModal.classList.remove('d-none');
        updateModal.classList.add('d-flex');
    }
});

document.getElementById('cancelUpdateBtn').addEventListener('click', closeUpdateModal);

document.getElementById('movePatientBtn').addEventListener('click', function() {
    const selectedServiceId = moveServiceSelect.value;
    const selectedServiceName = moveServiceSelect.options[moveServiceSelect.selectedIndex].text;
    
    if (!selectedServiceId) {
        Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please select a service destination.', confirmButtonColor: '#174593' });
        return;
    }

    Swal.fire({
        title: 'Moving Patient...',
        text: `Patient is being manually moved to ${selectedServiceName.toUpperCase()}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    }).then(() => {
        closeUpdateModal();
        fetchQueueData(); 
    });
});

//================================================================================
// 6. INITIALIZATION

function init() {
    fetchQueueData();
}

init();