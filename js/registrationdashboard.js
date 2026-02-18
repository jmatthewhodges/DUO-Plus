// ==========================================
// 1. GLOBAL SETTINGS & MEMORY
// ==========================================

// Global Service Availability (true = open, false = full/unavailable)
const serviceAvailability = {
    medical: true,
    dental: true,
    optical: true,
    haircut: true
};

// Memory variables
let currentRowToUpdate = null;
let currentClientName = ""; 
let currentClientId = null; 

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const tableBody = document.querySelector('tbody');
// Select our new Stat Elements
const statRegCount = document.getElementById('stat-reg-count');
const statCompCount = document.getElementById('stat-comp-count');

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

// Helper to safely update text numbers
function updateStats(type, value) {
    if (type === 'registration') {
        if (statRegCount) statRegCount.innerText = value;
    } else if (type === 'completed') {
        // Since we don't have a backend for this yet, we just increment whatever is there
        if (statCompCount) {
            let current = parseInt(statCompCount.innerText) || 0;
            statCompCount.innerText = current + value;
        }
    }
}

function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    let isAvailable = serviceAvailability[serviceKey];
    state = parseInt(state);

    if (state === 1 && !isAvailable) { state = -1; }

    if (state === 1) {
        colorClass = 'btn-success';     
        iconColor = 'text-white';
    } else if (state === 0) {
        if (!isAvailable) {
            colorClass = 'btn-grey locked-btn';
        } else {
            colorClass = 'btn-grey';
        }
    } else if (state === -1) {
        colorClass = 'btn-danger';      
        disabledAttr = 'disabled'; 
    }

    return `
        <button class="btn ${colorClass} btn-sm rounded-2 service-btn" 
                data-state="${state}" ${disabledAttr} title="${serviceType}" 
                style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${iconClass} ${iconColor}"></i>
        </button>
    `;
}

// ==========================================
// 4. MAIN DATA FUNCTIONS
// ==========================================

function fetchRegistrationQueue() {
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading registration queue...</td></tr>';

    fetch('../api/registration-dashboard.php', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            populateRegistrationTable(data.data);
            
            // UPDATE STATS: Set the Registration count to the number of people we just pulled
            updateStats('registration', data.data.length);
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-danger">Failed to load queue.</td></tr>';
        }
    })
    .catch(error => {
        console.error('Error fetching queue:', error);
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-danger">Connection error. Please refresh.</td></tr>';
    });
}

function populateRegistrationTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
        return;
    }

    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const formattedDOB = formatDOB(patient.DOB);

        const rowHTML = `
            <tr class="align-middle" data-client-id="${patient.ClientID}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width: 40px; height: 40px;">
                            <i class="bi bi-person-circle" style="font-size: 1.5rem"></i>
                        </div>
                        <span class="fw-bold text-dark">${fullName}</span>
                    </div>
                </td>
                <td class="fw-medium text-secondary">${formattedDOB}</td>
                <td>
                    <div class="d-flex justify-content-between align-items-center pe-3">
                        <div class="d-flex gap-3">
                            ${buildServiceButton('Medical', patient.Medical, 'bi-heart-pulse', 'medical')}
                            ${buildServiceButton('Dental', patient.Dental, 'bi-shield-shaded', 'dental')}
                            ${buildServiceButton('Optical', patient.Optical, 'bi-eye', 'optical')}
                            ${buildServiceButton('Haircut', patient.Hair, 'bi-scissors', 'haircut')}
                        </div>
                        <button class="btn bg-primary text-white btn-sm check-in-btn">Check In</button>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================

tableBody.addEventListener('click', function(event) {
    const serviceBtn = event.target.closest('.service-btn');
    if (serviceBtn) {
        if (serviceBtn.hasAttribute('disabled') || serviceBtn.classList.contains('locked-btn')) return;
        let currentState = parseInt(serviceBtn.getAttribute('data-state'));
        const icon = serviceBtn.querySelector('i');
        if (currentState === 1) {
            serviceBtn.setAttribute('data-state', '0');
            serviceBtn.classList.replace('btn-success', 'btn-grey');
            icon.classList.remove('text-white');
        } else if (currentState === 0) {
            serviceBtn.setAttribute('data-state', '1');
            serviceBtn.classList.replace('btn-grey', 'btn-success');
            icon.classList.add('text-white');
        }
        return; 
    }

    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        currentRowToUpdate = checkInBtn.closest('tr');
        currentClientName = currentRowToUpdate.querySelector('.fw-bold.text-dark').innerText;
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');
        const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
        const dentalState = parseInt(dentalBtn.getAttribute('data-state'));

        document.getElementById('modalPatientName').innerText = currentClientName;
        document.getElementById('translatorCheck').checked = false;
        document.getElementById('dentalHygiene').checked = false;
        document.getElementById('dentalExtraction').checked = false;

        const dentalSection = document.getElementById('modalDentalSection');
        if (dentalState === 1 && serviceAvailability.dental === true) {
            dentalSection.classList.remove('d-none');
        } else {
            dentalSection.classList.add('d-none');
        }

        const modal = document.getElementById('checkInModal');
        modal.classList.remove('d-none');
        modal.classList.add('d-flex'); 
    }
});

// ==========================================
// 6. MODAL ACTION LISTENERS & SUBMISSION
// ==========================================

function closeModalAnimated() {
    const modal = document.getElementById('checkInModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('d-none');
        modal.classList.remove('d-flex', 'closing');
    }, 250);
}

document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
    closeModalAnimated();
});

document.getElementById('finalizeCheckInBtn').addEventListener('click', function() {
    const btn = this; 
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;
    
    // 1. DYNAMICALLY BUILD SERVICES ARRAY
    const services = [];
    const medicalBtn = currentRowToUpdate.querySelector('[title="Medical"]');
    if (parseInt(medicalBtn.getAttribute('data-state')) === 1) services.push('medical');
    
    const opticalBtn = currentRowToUpdate.querySelector('[title="Optical"]');
    if (parseInt(opticalBtn.getAttribute('data-state')) === 1) services.push('optical');
    
    const hairBtn = currentRowToUpdate.querySelector('[title="Haircut"]');
    if (parseInt(hairBtn.getAttribute('data-state')) === 1) services.push('haircut');
    
    const selectedDental = document.querySelector('input[name="dentalChoice"]:checked');
    const dentalSection = document.getElementById('modalDentalSection');
    
    if (!dentalSection.classList.contains('d-none')) {
        if (!selectedDental) {
            Swal.fire({
                icon: 'warning',
                title: 'Selection Required',
                text: 'Please select either Hygiene or Extraction to proceed.',
                confirmButtonColor: '#174593'
            });
            return; 
        }
        services.push(selectedDental.value); 
    }

    // 2. LOADING STATE
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // 3. THE FETCH REQUEST
    fetch('../api/check-in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            clientID: currentClientId,           
            services: services, 
            needsInterpreter: isInterpreterNeeded 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeModalAnimated();
            if (currentRowToUpdate) {
                currentRowToUpdate.remove();
            }

            // --- UPDATE STATS LOGIC ---
            // Decrement "Registration" count
            let currentReg = parseInt(statRegCount.innerText) || 0;
            updateStats('registration', Math.max(0, currentReg - 1));
            // Increment "Completed" count
            updateStats('completed', 1);

            console.log("Stats Updated: Registration -1, Completed +1");

            Swal.fire({
                icon: 'success',
                title: 'Checked In!',
                html: `<strong>${currentClientName}</strong> has been successfully processed.`,
                timer: 2500,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Check-In Failed',
                text: data.message || 'Unable to process this patient.',
                confirmButtonColor: '#174593'
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Unable to connect to the server. Please try again.',
            confirmButtonColor: '#174593'
        });
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = originalText;
    });
});

// ==========================================
// 7. INITIALIZATION
// ==========================================
fetchRegistrationQueue();