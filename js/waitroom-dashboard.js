/**
 * ============================================================
 * File:            waitroom-dashboard.js
 * Description:     Handles managing the waiting room dashboard.
 * * Last Modified By: Skyler E.
 * Last Modified On: Feb 23 @ 7:02 PM
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE
const mockWaitListData = [
    { ClientID: 101, FirstName: "John", LastName: "Doe", DOB: "1978-11-01", Medical: 1, Dental: 0, Optical: 1, Hair: 0, ServiceIcon: "bi-heart-pulse" },
    { ClientID: 102, FirstName: "Jane", LastName: "Smith", DOB: "1985-05-22", Medical: 0, Dental: 1, Optical: 0, Hair: 0, ServiceIcon: "bi-shield-shaded" },
    { ClientID: 103, FirstName: "Michael", LastName: "Brown", DOB: "1992-08-15", Medical: 0, Dental: 0, Optical: 1, Hair: 0, ServiceIcon: "bi-eye" },
    { ClientID: 104, FirstName: "Emily", LastName: "Davis", DOB: "2001-12-30", Medical: 0, Dental: 0, Optical: 0, Hair: 1, ServiceIcon: "bi-scissors" },
    { ClientID: 105, FirstName: "Robert", LastName: "Wilson", DOB: "1965-03-12", Medical: 1, Dental: 1, Optical: 0, Hair: 0, ServiceIcon: "bi-heart-pulse" },
    { ClientID: 106, FirstName: "Sarah", LastName: "Miller", DOB: "1988-07-19", Medical: 0, Dental: 1, Optical: 1, Hair: 0, ServiceIcon: "bi-shield-shaded" },
    { ClientID: 107, FirstName: "David", LastName: "Garcia", DOB: "1970-01-05", Medical: 1, Dental: 0, Optical: 0, Hair: 0, ServiceIcon: "bi-heart-pulse" },
    { ClientID: 108, FirstName: "Linda", LastName: "Martinez", DOB: "1995-11-20", Medical: 0, Dental: 0, Optical: 1, Hair: 1, ServiceIcon: "bi-eye" }
];

let currentRowToUpdate = null;
let currentClientId = null;

//================================================================================
// 2. DOM REFERENCES
const tableBody = document.querySelector('tbody');
const updateModal = document.getElementById('updateStatusModal');
const waitListCountLabel = document.getElementById('waitlist-header-count');

//================================================================================
// 3. HELPERS

// Formats "YYYY-MM-DD" to "MM/DD/YYYY"
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

// Mimics the Registration Dashboard service button style
function buildServiceButton(state, iconClass) {
    let colorClass = state === 1 ? 'btn-success' : 'btn-grey';
    let iconColor = state === 1 ? 'text-white' : '';
    
    return `
        <button class="btn ${colorClass} btn-sm rounded-2 shadow-sm" disabled 
                style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${iconClass} ${iconColor}" style="font-size: 1.2rem;"></i>
        </button>
    `;
}

function closeUpdateModal() {
    updateModal.classList.add('d-none');
    updateModal.classList.remove('d-flex');
}

//================================================================================
// 4. DATA RENDERING

function populateWaitListTable(patients) {
    tableBody.innerHTML = '';

    if (patients.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients in the waiting room.</td></tr>';
        return;
    }

    patients.forEach(patient => {
        const formattedDOB = formatDOB(patient.DOB);
        const rowHTML = `
            <tr class="border-bottom" data-client-id="${patient.ClientID}">
                <td class="ps-3 d-block d-md-table-cell mb-2 mb-md-0">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light flex-shrink-0" style="width: 30px; height: 30px;">
                            <i class="bi bi-person"></i>
                        </div>
                        <div class="d-flex flex-column">
                            <span class="fw-bold text-dark">${patient.FirstName} ${patient.LastName}</span>
                            <span class="text-muted small d-md-none">DOB: ${formattedDOB}</span>
                        </div>
                    </div>
                </td>
                <td class="fw-medium d-none d-md-table-cell">${formattedDOB}</td>
                <td class="d-block d-md-table-cell text-end pe-3 mb-2 mb-md-0">
                    <button class="btn btn-primary btn-sm px-3 rounded-2 w-100 w-md-auto update-btn">Update</button>
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
        
        const patient = mockWaitListData.find(p => p.ClientID == currentClientId);
        
        document.getElementById('modalPatientName').innerText = `${patient.FirstName} ${patient.LastName}`;
        
        const statusContainer = document.getElementById('modalServiceStatus');
        statusContainer.innerHTML = `
            ${buildServiceButton(patient.Medical, 'bi-heart-pulse')}
            ${buildServiceButton(patient.Dental, 'bi-shield-shaded')}
            ${buildServiceButton(patient.Optical, 'bi-eye')}
            ${buildServiceButton(patient.Hair, 'bi-scissors')}
        `;

        updateModal.classList.remove('d-none');
        updateModal.classList.add('d-flex');
    }
});

document.getElementById('cancelUpdateBtn').addEventListener('click', closeUpdateModal);

document.getElementById('movePatientBtn').addEventListener('click', function() {
    const selectedService = document.getElementById('moveServiceSelect').value;
    
    if (!selectedService) {
        Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please select a service destination.', confirmButtonColor: '#174593' });
        return;
    }

    Swal.fire({
        title: 'Moving Patient...',
        text: `Patient is being moved to ${selectedService.toUpperCase()}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });

    closeUpdateModal();
});

//================================================================================
// 6. INITIALIZATION

function init() {
    populateWaitListTable(mockWaitListData);
}

init();