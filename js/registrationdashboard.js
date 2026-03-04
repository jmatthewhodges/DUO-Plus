/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Claude
 * Last Modified On:  Mar 4
 * Changes Made:      Added Checked In tab with Edit/Reprint flow
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE

// Service availability. Will likely be attached to API response in the future, but hardcoded for now
const serviceAvailability = {
    medical: true,
    dental: true,
    optical: true,
    haircut: true
};

// Service configuration mapping ServiceID to display info
const serviceMapping = {
    'medicalExam': { containerId: 'service-medical-exam', displayName: 'Medical - Exam' },
    'medicalFollowUp': { containerId: 'service-medical-follow-up', displayName: 'Medical - Follow Up' },
    'dentalHygiene': { containerId: 'service-dental-hygiene', displayName: 'Dental - Hygiene' },
    'dentalExtraction': { containerId: 'service-dental-extraction', displayName: 'Dental - Extraction' },
    'optical': { containerId: 'service-optical', displayName: 'Optical' },
    'haircut': { containerId: 'service-haircut', displayName: 'Haircut' },
    'hair': { containerId: 'service-haircut', displayName: 'Haircut' }
};

// Active check-in / reprint state
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;
let currentMode = 'checkin'; // 'checkin' or 'reprint'

// Search elements
const searchInput = document.getElementById('registrationSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const noSearchResults = document.getElementById('noSearchResults');
const noSearchTerm = document.getElementById('noSearchTerm');

//================================================================================
// 2. DOM REFERENCES

const tableBody = document.querySelector('tbody');
const statRegCount = document.getElementById('stat-reg-count');
const statCompCount = document.getElementById('stat-comp-count');

//================================================================================
// 3. HELPERS

// --- Tab State & Elements ---
let currentTab = 'registration';
const btnRegistration = document.getElementById('btn-registration');
const btnCheckedIn = document.getElementById('btn-checked-in');

btnRegistration.addEventListener('click', () => {
    if (currentTab === 'registration') return;
    currentTab = 'registration';
    currentMode = 'checkin';
    btnRegistration.classList.add('active');
    btnCheckedIn.classList.remove('active');
    fetchRegistrationQueue();
});

btnCheckedIn.addEventListener('click', () => {
    if (currentTab === 'checked-in') return;
    currentTab = 'checked-in';
    currentMode = 'reprint';
    btnCheckedIn.classList.add('active');
    btnRegistration.classList.remove('active');
    fetchRegistrationQueue();
});

// Formats "YYYY-MM-DD" to "MM/DD/YYYY", returns "N/A" if input is empty or null
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

// Updates the service progress bars based on availability data from API
function updateServiceProgressBars(servicesData) {
    if (!servicesData || !Array.isArray(servicesData)) return;

    Object.values(serviceMapping).forEach(mapping => {
        const container = document.getElementById(mapping.containerId);
        if (container) {
            const countSpan = container.querySelector('.service-count');
            const progressBar = container.querySelector('.progress-bar');
            if (countSpan) countSpan.textContent = '(0/0)';
            if (progressBar) progressBar.style.width = '0%';
        }
    });

    servicesData.forEach(service => {
        const serviceID = service.serviceID || '';
        const mapping = serviceMapping[serviceID];
        if (!mapping) return;

        const container = document.getElementById(mapping.containerId);
        if (!container) return;

        const countSpan = container.querySelector('.service-count');
        const progressBar = container.querySelector('.progress-bar');

        const maxCapacity = service.maxCapacity || 0;
        const currentAssigned = service.currentAssigned || 0;
        const percentage = maxCapacity > 0 ? Math.round((currentAssigned / maxCapacity) * 100) : 0;

        if (countSpan) countSpan.textContent = `(${currentAssigned}/${maxCapacity})`;

        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
            if (percentage <= 50) {
                progressBar.classList.add('bg-success');
            } else if (percentage < 80) {
                progressBar.classList.add('bg-warning');
            } else {
                progressBar.classList.add('bg-danger');
            }
        }
    });
}

// Updates the stats in the dashboard header
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

// Closes the check-in/reprint modal with a fade-out animation
function closeModalAnimated() {
    const modal = document.getElementById('checkInModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('d-none');
        modal.classList.remove('d-flex', 'closing');
    }, 250);
}

// Closes the QR code modal
function closeQrModal() {
    const qrModal = document.getElementById('qrCodeModal');
    qrModal.classList.add('d-none');
    qrModal.classList.remove('d-flex');
}

// Creates the HTML for a service button
function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    const isAvailable = serviceAvailability[serviceKey];
    state = parseInt(state);

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

// Filters visible rows based on the current search query
function applySearch() {
    const query = searchInput.value.trim().toLowerCase();
    const rows = tableBody.querySelectorAll('tr[data-client-id]');
    let visibleCount = 0;

    rows.forEach(row => {
        const nameEl = row.querySelector('.fw-bold.text-dark');
        if (!nameEl) return;
        const name = nameEl.innerText.toLowerCase();
        const matches = name.includes(query);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    if (query && visibleCount === 0) {
        noSearchResults.classList.remove('d-none');
        noSearchTerm.textContent = searchInput.value.trim();
    } else {
        noSearchResults.classList.add('d-none');
    }

    clearSearchBtn.style.display = query ? '' : 'none';
}

searchInput.addEventListener('input', applySearch);

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applySearch();
    searchInput.focus();
});

//================================================================================
// 4. DATA FETCHING & TABLE RENDERING

// Fetches queue data from the API and populates the table.
// Uses RegistrationStatus=Registered for the Registration tab,
// and RegistrationStatus=CheckedIn for the Checked In tab.
function fetchRegistrationQueue() {
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading...</td></tr>';

    const status = currentTab === 'checked-in' ? 'CheckedIn' : 'Registered';

    fetch(`../api/registration-dashboard.php?RegistrationStatus=${status}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const clients = (data.data || []).filter(item => item.ClientID);

                if (currentTab === 'checked-in') {
                    populateCheckedInTable(clients);
                    // Update the checked-in count in the "Registered Clients" stat
                    if (statCompCount) statCompCount.innerText = clients.length;
                } else {
                    populateRegistrationTable(clients);
                    updateStats('registration', clients.length);
                }
            } else {
                tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
            }

            if (statCompCount && data.clientsProcessed !== undefined && currentTab !== 'checked-in') {
                statCompCount.innerText = data.clientsProcessed;
            }

            if (data.services && Array.isArray(data.services)) {
                updateServiceProgressBars(data.services);
            }
        })
        .catch(error => {
            console.error('Error fetching queue:', error);
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-danger">Connection error. Please refresh.</td></tr>';
        });
}

// Populates the registration (pre-check-in) table
function populateRegistrationTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
        return;
    }

    patientsData.sort((a, b) => {
        const lastNameComparison = a.LastName.localeCompare(b.LastName);
        if (lastNameComparison !== 0) return lastNameComparison;
        return a.FirstName.localeCompare(b.FirstName);
    });

    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const formattedDOB = formatDOB(patient.DOB);

        const serviceSet = new Set(patient.services || []);
        patient.Medical = serviceSet.has('medical') ? 1 : 0;
        patient.Dental = serviceSet.has('dental') ? 1 : 0;
        patient.Optical = serviceSet.has('optical') ? 1 : 0;
        patient.Hair = serviceSet.has('haircut') ? 1 : 0;

        const rowHTML = `
            <tr class="align-middle" data-client-id="${patient.ClientID}" data-translator="${patient.TranslatorNeeded || 0}">
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

    if (searchInput.value.trim()) applySearch();
}

// Populates the checked-in table. Services come from tblVisitServices (actual assigned services).
// The "services" array from the API for CheckedIn patients contains their specific service IDs
// (e.g. 'medicalExam', 'dentalHygiene') rather than broad categories.
function populateCheckedInTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No checked-in patients found.</td></tr>';
        return;
    }

    patientsData.sort((a, b) => {
        const lastNameComparison = a.LastName.localeCompare(b.LastName);
        if (lastNameComparison !== 0) return lastNameComparison;
        return a.FirstName.localeCompare(b.FirstName);
    });

    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const formattedDOB = formatDOB(patient.DOB);

        // For checked-in patients, services are specific IDs from tblVisitServices
        const serviceSet = new Set(patient.services || []);

        // Medical: shown as selected if they have either medical sub-type
        const hasMedical = serviceSet.has('medicalExam') || serviceSet.has('medicalFollowUp') ? 1 : 0;
        // Dental: shown as selected if they have either dental sub-type
        const hasDental = serviceSet.has('dentalHygiene') || serviceSet.has('dentalExtraction') ? 1 : 0;
        const hasOptical = serviceSet.has('optical') ? 1 : 0;
        const hasHaircut = serviceSet.has('haircut') || serviceSet.has('hair') ? 1 : 0;

        // Store the specific sub-service IDs on the row for pre-populating the modal
        const medicalSubService = serviceSet.has('medicalExam') ? 'MedicalExam'
            : serviceSet.has('medicalFollowUp') ? 'MedicalFollowUp' : '';
        const dentalSubService = serviceSet.has('dentalHygiene') ? 'dentalHygiene'
            : serviceSet.has('dentalExtraction') ? 'dentalExtraction' : '';

        const rowHTML = `
            <tr class="align-middle" 
                data-client-id="${patient.ClientID}" 
                data-translator="${patient.TranslatorNeeded || 0}"
                data-medical-sub="${medicalSubService}"
                data-dental-sub="${dentalSubService}">
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
                            ${buildServiceButton('Medical', hasMedical, 'bi-heart-pulse', 'medical')}
                            ${buildServiceButton('Dental', hasDental, 'bi-shield-shaded', 'dental')}
                            ${buildServiceButton('Optical', hasOptical, 'bi-eye', 'optical')}
                            ${buildServiceButton('Haircut', hasHaircut, 'bi-scissors', 'haircut')}
                        </div>
                        <button class="btn btn-primary btn-sm reprint-btn">Reprint</button>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });

    if (searchInput.value.trim()) applySearch();
}

//================================================================================
// 5. TABLE EVENT LISTENERS (Service Toggles, Check-In, and Reprint)

tableBody.addEventListener('click', function (event) {

    // --- Service toggle buttons (same for both tabs) ---
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

    // --- Check-In button (Registration tab) ---
    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        currentMode = 'checkin';
        openServiceModal(checkInBtn.closest('tr'));
        return;
    }

    // --- Edit / Reprint button (Checked In tab) ---
    const reprintBtn = event.target.closest('.reprint-btn');
    if (reprintBtn) {
        currentMode = 'reprint';
        openServiceModal(reprintBtn.closest('tr'));
        return;
    }
});

// Opens the check-in/reprint modal and populates it based on the current row and mode.
function openServiceModal(row) {
    currentRowToUpdate = row;
    currentClientName = row.querySelector('.fw-bold.text-dark').innerText;
    currentClientId = row.getAttribute('data-client-id');

    // Update modal header and button label based on mode
    const modalHeader = document.querySelector('#checkInModal .card-header h5');
    const finalizeBtn = document.getElementById('finalizeCheckInBtn');

    if (currentMode === 'reprint') {
        modalHeader.textContent = 'Edit & Reprint Badge';
        finalizeBtn.innerHTML = '<i class="bi bi-printer me-1"></i>Save & Reprint';
    } else {
        modalHeader.textContent = 'Finalize Check-In';
        finalizeBtn.innerHTML = 'Finalize Check-In';
    }

    // --- Translator toggle ---
    const translatorNeeded = row.getAttribute('data-translator');
    document.getElementById('translatorCheck').checked = (translatorNeeded === '1');

    // --- Dental section ---
    const dentalBtn = row.querySelector('[title="Dental"]');
    const dentalState = parseInt(dentalBtn.getAttribute('data-state'));

    document.getElementById('dentalHygiene').checked = false;
    document.getElementById('dentalExtraction').checked = false;

    const dentalSection = document.getElementById('modalDentalSection');
    if (dentalState === 1 && serviceAvailability.dental) {
        dentalSection.classList.remove('d-none');

        // Pre-select existing dental sub-service for reprint mode
        if (currentMode === 'reprint') {
            const dentalSub = row.getAttribute('data-dental-sub');
            if (dentalSub === 'dentalHygiene') document.getElementById('dentalHygiene').checked = true;
            else if (dentalSub === 'dentalExtraction') document.getElementById('dentalExtraction').checked = true;
        }
    } else {
        dentalSection.classList.add('d-none');
    }

    // --- Medical section ---
    const medicalBtn = row.querySelector('[title="Medical"]');
    const medicalState = parseInt(medicalBtn.getAttribute('data-state'));

    document.getElementById('medicalExam').checked = false;
    document.getElementById('medicalFollowUp').checked = false;

    const medicalSection = document.getElementById('modalMedicalSection');
    if (medicalState === 1 && serviceAvailability.medical) {
        medicalSection.classList.remove('d-none');

        // Pre-select existing medical sub-service for reprint mode
        if (currentMode === 'reprint') {
            const medicalSub = row.getAttribute('data-medical-sub');
            if (medicalSub === 'MedicalExam') document.getElementById('medicalExam').checked = true;
            else if (medicalSub === 'MedicalFollowUp') document.getElementById('medicalFollowUp').checked = true;
        }
    } else {
        medicalSection.classList.add('d-none');
    }

    document.getElementById('modalPatientName').innerText = currentClientName;

    const modal = document.getElementById('checkInModal');
    modal.classList.remove('d-none');
    modal.classList.add('d-flex');
}

//================================================================================
// 6. MODAL SUBMISSION (Check-In & Reprint share this handler, branching by currentMode)

document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
    closeModalAnimated();
});

document.getElementById('finalizeCheckInBtn').addEventListener('click', function () {
    const btn = this;
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;

    const services = [];

    // --- Medical ---
    const medicalSection = document.getElementById('modalMedicalSection');
    const selectedMedical = document.querySelector('input[name="medicalChoice"]:checked');

    if (!medicalSection.classList.contains('d-none')) {
        if (!selectedMedical) {
            Swal.fire({
                icon: 'warning',
                title: 'Selection Required',
                text: 'Please select either Exam or Follow Up to proceed.',
                confirmButtonColor: '#174593'
            });
            return;
        }
        services.push(selectedMedical.value);
    }

    // --- Optical ---
    const opticalBtn = currentRowToUpdate.querySelector('[title="Optical"]');
    if (parseInt(opticalBtn.getAttribute('data-state')) === 1) services.push('optical');

    // --- Haircut ---
    const hairBtn = currentRowToUpdate.querySelector('[title="Haircut"]');
    if (parseInt(hairBtn.getAttribute('data-state')) === 1) services.push('haircut');

    // --- Dental ---
    const dentalSection = document.getElementById('modalDentalSection');
    const selectedDental = document.querySelector('input[name="dentalChoice"]:checked');

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

    // Capture service states for QR card before DOM changes
    const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
    const medicalBtn = currentRowToUpdate.querySelector('[title="Medical"]');
    const hasDental = dentalBtn && dentalBtn.getAttribute('data-state') === '1';
    const hasMedical = medicalBtn && medicalBtn.getAttribute('data-state') === '1';
    const hasOptical = opticalBtn && opticalBtn.getAttribute('data-state') === '1';
    const hasHaircut = hairBtn && hairBtn.getAttribute('data-state') === '1';

    // Loading state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // Choose API endpoint based on mode
    const endpoint = currentMode === 'reprint' ? '../api/reprint.php' : '../api/CheckIn.php';

    fetch(endpoint, {
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

                // For check-in: remove the row from the table (they move to checked-in)
                // For reprint: keep the row, but update its stored sub-service data attributes
                if (currentMode === 'checkin') {
                    if (currentRowToUpdate) currentRowToUpdate.remove();

                    let currentReg = parseInt(statRegCount.innerText) || 0;
                    statRegCount.innerText = Math.max(0, currentReg - 1);

                    if (statCompCount && data.clientsProcessed !== undefined) {
                        statCompCount.innerText = data.clientsProcessed;
                    } else if (statCompCount) {
                        statCompCount.innerText = (parseInt(statCompCount.innerText) || 0) + 1;
                    }
                } else {
                    // Update the row's data attributes so the next reprint pre-populates correctly
                    if (currentRowToUpdate) {
                        const newMedicalSub = selectedMedical ? selectedMedical.value : '';
                        const newDentalSub = selectedDental ? selectedDental.value : '';
                        currentRowToUpdate.setAttribute('data-medical-sub', newMedicalSub);
                        currentRowToUpdate.setAttribute('data-dental-sub', newDentalSub);
                        currentRowToUpdate.setAttribute('data-translator', isInterpreterNeeded ? '1' : '0');
                    }
                }

                // Show QR modal
                const qrModal = document.getElementById('qrCodeModal');
                qrModal.classList.remove('d-none');
                qrModal.classList.add('d-flex');

                const nameParts = currentClientName.split(' ');
                const firstName = nameParts[0].toUpperCase();
                const lastName = nameParts.slice(1).join(' ');

                const firstNameEl = document.getElementById('qrCardFirstName');
                const lastNameEl = document.getElementById('qrCardLastName');

                function scaledName(name, maxSize, minSize) {
                    const len = name.length;
                    if (len <= 6)  return { text: name, size: maxSize };
                    if (len <= 8)  return { text: name, size: maxSize * 0.85 };
                    if (len <= 10) return { text: name, size: maxSize * 0.70 };
                    if (len <= 12) return { text: name, size: maxSize * 0.58 };
                    if (len <= 14) return { text: name, size: maxSize * 0.50 };
                    return { text: name.slice(0, 14) + '…', size: minSize };
                }

                const first = scaledName(firstName, 2.5, 1.1);
                const last  = scaledName(lastName, 1.5, 0.8);

                firstNameEl.innerText = first.text;
                firstNameEl.style.fontSize = first.size + 'rem';
                lastNameEl.innerText = last.text;
                lastNameEl.style.fontSize = last.size + 'rem';

                new QRious({
                    element: document.getElementById('qr'),
                    value: currentClientId,
                    size: 200,
                });

                // Reset all QR icons
                const qrIcons = ['qrCardMedicalIcon', 'qrCardDentalIcon', 'qrCardOpticalIcon', 'qrCardHaircutIcon'];
                qrIcons.forEach(id => {
                    const iconEl = document.getElementById(id);
                    iconEl.style.visibility = 'hidden';
                    iconEl.style.display = 'inline-flex';
                });
                document.getElementById('qrCardTranslator').style.display = 'none';

                if (hasMedical) document.getElementById('qrCardMedicalIcon').style.visibility = 'visible';
                if (hasDental) document.getElementById('qrCardDentalIcon').style.visibility = 'visible';
                if (hasOptical) document.getElementById('qrCardOpticalIcon').style.visibility = 'visible';
                if (hasHaircut) document.getElementById('qrCardHaircutIcon').style.visibility = 'visible';
                if (isInterpreterNeeded) document.getElementById('qrCardTranslator').style.display = 'block';

            } else {
                closeQrModal();
                console.error('Operation failed:', data.message);
                Swal.fire({
                    icon: 'error',
                    title: currentMode === 'reprint' ? 'Reprint Failed' : 'Check-In Failed',
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

//================================================================================
// 7. PRINT QR CODE

document.getElementById('printQrBtn').addEventListener('click', function () {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            @page {
                size: 2.3125in 4in;
                margin: 0; 
            }
            html, body {
                height: 4in !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            body * { visibility: hidden; }
            #qrCodeModal, #qrCodeModal * { visibility: visible; }
            #qrCodeModal {
                position: absolute;
                left: 0;
                top: 0;
                width: 2.3125in !important;
                height: 4in !important;
                background: white !important;
                padding: 0.1in !important;
                display: flex !important;
                align-items: flex-start !important;
                margin: 0 !important;
            }
            #qrCodeModal .card {
                width: 100% !important;
                height: 100% !important;
                max-width: none !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            #printQrBtn, #closeQrBtn { display: none !important; }
            #qrCodeModal .qr-icon-border {
                flex-shrink: 0 !important; 
                font-size: 2rem !important;
                width: 46px !important;
                height: 46px !important;
                border-width: 2px !important;
                border-style: solid !important;
                border-color: black !important;
                border-radius: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            #qrCodeModal .gap-3 { gap: 0.25rem !important; }
            #qrCodeModal canvas {
                max-width: 1.8in !important;
                height: auto !important;
            }
        }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 100);
});

document.getElementById('closeQrBtn').addEventListener('click', () => {
    closeQrModal();
    // Only refresh the full queue on check-in close; reprint stays in place
    if (currentMode === 'checkin') {
        fetchRegistrationQueue();
    }
});

//================================================================================
// 8. INITIALIZATION
fetchRegistrationQueue();