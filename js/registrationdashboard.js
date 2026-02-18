// ==========================================
// 1. GLOBAL SETTINGS & STATE
// ==========================================

// Service availability flags (true = open, false = full/unavailable)
const serviceAvailability = {
    medical: true,
    dental: true,
    optical: true,
    haircut: true
};

// Active check-in state
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;

// ==========================================
// 2. DOM REFERENCES
// ==========================================

const tableBody = document.querySelector('tbody');
const statRegCount = document.getElementById('stat-reg-count');
const statCompCount = document.getElementById('stat-comp-count');

// ==========================================
// 3. HELPERS
// ==========================================

function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

function updateStats(type, value) {
    if (type === 'registration') {
        if (statRegCount) statRegCount.innerText = value;
    } else if (type === 'completed') {
        if (statCompCount) {
            let current = parseInt(statCompCount.innerText) || 0;
            statCompCount.innerText = current + value;
        }
    }
}

function closeModalAnimated() {
    const modal = document.getElementById('checkInModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('d-none');
        modal.classList.remove('d-flex', 'closing');
    }, 250);
}

function closeQrModal() {
    const qrModal = document.getElementById('qrCodeModal');
    qrModal.classList.add('d-none');
    qrModal.classList.remove('d-flex');
}

function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    const isAvailable = serviceAvailability[serviceKey];
    state = parseInt(state);

    // If the patient wanted it but the service is unavailable, mark as locked
    if (state === 1 && !isAvailable) { state = -1; }

    if (state === 1) {
        colorClass = 'btn-success';
        iconColor = 'text-white';
    } else if (state === 0) {
        colorClass = isAvailable ? 'btn-grey' : 'btn-grey locked-btn';
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
// 4. DATA FETCHING & TABLE RENDERING
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
                updateStats('registration', data.data.length);
                if (statCompCount) statCompCount.innerText = data.clientsProcessed;
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
// 5. TABLE EVENT LISTENERS (Service Toggles & Check-In)
// ==========================================

tableBody.addEventListener('click', function (event) {
    // --- Service Button Toggle ---
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

    // --- Check-In Button ---
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
        if (dentalState === 1 && serviceAvailability.dental) {
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
// 6. CHECK-IN MODAL SUBMISSION
// ==========================================

document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
    closeModalAnimated();
});

document.getElementById('finalizeCheckInBtn').addEventListener('click', function () {
    const btn = this;
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;

    // Build services array from selected buttons
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

    // Loading state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // Close check-in modal
    closeModalAnimated();

    // Capture service states for QR card before removing the row
    const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
    const hasDental = dentalBtn && dentalBtn.getAttribute('data-state') === '1';
    const hasMedical = medicalBtn && medicalBtn.getAttribute('data-state') === '1';
    const hasOptical = opticalBtn && opticalBtn.getAttribute('data-state') === '1';
    const hasHaircut = hairBtn && hairBtn.getAttribute('data-state') === '1';

    // Remove patient from queue table
    if (currentRowToUpdate) {
        currentRowToUpdate.remove();
    }

    // Show QR modal after a brief delay for smooth transition
    setTimeout(() => {
        const qrModal = document.getElementById('qrCodeModal');
        qrModal.classList.remove('d-none');
        qrModal.classList.add('d-flex');

        document.getElementById('qrCardTitle').textContent = currentClientName;

        // Generate QR Code (QRious library)
        new QRious({
            element: document.getElementById('qr'),
            value: currentClientId,
            size: 200,
        });

        // Reset all QR card icons
        document.getElementById('qrCardDentalIcon').style.display = 'none';
        document.getElementById('qrCardMedicalIcon').style.display = 'none';
        document.getElementById('qrCardOpticalIcon').style.display = 'none';
        document.getElementById('qrCardHaircutIcon').style.display = 'none';
        document.getElementById('qrCardTranslator').style.display = 'none';

        // Show icons for selected services
        if (hasDental) document.getElementById('qrCardDentalIcon').style.display = 'block';
        if (hasMedical) document.getElementById('qrCardMedicalIcon').style.display = 'block';
        if (hasOptical) document.getElementById('qrCardOpticalIcon').style.display = 'block';
        if (hasHaircut) document.getElementById('qrCardHaircutIcon').style.display = 'block';

        // Translator badge
        const translatorCheck = document.getElementById('translatorCheck');
        if (translatorCheck && translatorCheck.checked) {
            document.getElementById('qrCardTranslator').style.display = 'block';
        }
    }, 300);

    // Send check-in data to API
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
                // QR modal stays open so the user can print
                let currentReg = parseInt(statRegCount.innerText) || 0;
                updateStats('registration', Math.max(0, currentReg - 1));
                if (statCompCount) statCompCount.innerText = data.clientsProcessed;
                console.log("Stats Updated: Registration -1, Completed:", data.clientsProcessed);
            } else {
                closeQrModal();
                console.error('Check-in failed:', data.message);
                Swal.fire({
                    icon: 'error',
                    title: 'Check-In Failed',
                    text: data.message || 'Unable to process this patient.',
                    confirmButtonColor: '#174593'
                });
            }
        })
        .catch(error => {
            closeQrModal();
            console.error('API Error:', error);
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
// 7. PRINT QR CODE
// ==========================================

document.getElementById('printQrBtn').addEventListener('click', function () {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            @page { margin: 0; size: auto; }
            html, body { 
                width: 100%; 
                height: 100%; 
                margin: 0; 
                padding: 0; 
                overflow: hidden;
                background: white;
            }
            body > *:not(#qrCodeModal) {
                display: none !important;
            }
            #qrCodeModal {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            #qrCodeModal .card {
                width: 450px;
                margin: auto;
                box-shadow: none;
            }
            #printQrBtn { 
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);

    window.print();

    // Clean up print styles (modal stays open for re-printing)
    setTimeout(() => {
        document.head.removeChild(style);
    }, 100);
});

document.getElementById('closeQrBtn').addEventListener('click', () => {
    closeQrModal();
});

// ==========================================
// 8. INITIALIZATION
// ==========================================

fetchRegistrationQueue();