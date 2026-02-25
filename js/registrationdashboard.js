/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  Feb 24 @ 9:00 PM
 * Changes Made:      Added dynamic service progress bars and added dynamic color
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
// This maps possible service ID patterns to container IDs and display names
const serviceMapping = {
    'medicalExam': { containerId: 'service-medical-exam', displayName: 'Medical - Exam' },
    'medicalFollowUp': { containerId: 'service-medical-follow-up', displayName: 'Medical - Follow Up' },
    'dentalHygiene': { containerId: 'service-dental-hygiene', displayName: 'Dental - Hygiene' },
    'dentalExtraction': { containerId: 'service-dental-extraction', displayName: 'Dental - Extraction' },
    'optical': { containerId: 'service-optical', displayName: 'Optical' },
    'haircut': { containerId: 'service-haircut', displayName: 'Haircut' },
    'hair': { containerId: 'service-haircut', displayName: 'Haircut' }
};

// Active check-in state
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;

//================================================================================
// 2. DOM REFERENCES

const tableBody = document.querySelector('tbody');      // Link to the Table Body
const statRegCount = document.getElementById('stat-reg-count'); // Link to "Registration" Number
const statCompCount = document.getElementById('stat-comp-count'); // Link to "Processed" Number

//================================================================================
// 3. HELPERS

//formats "YYYY-MM-DD" to "MM/DD/YYYY", returns "N/A" if input is empty or null
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

//updates the service progress bars based on availability data from API
function updateServiceProgressBars(servicesData) {
    if (!servicesData || !Array.isArray(servicesData)) return;

    // Initialize all service containers first (optional - for services not in API response)
    Object.values(serviceMapping).forEach(mapping => {
        const container = document.getElementById(mapping.containerId);
        if (container) {
            const countSpan = container.querySelector('.service-count');
            const progressBar = container.querySelector('.progress-bar');
            if (countSpan) countSpan.textContent = '(0/0)';
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
    });

    // Update services based on API data
    servicesData.forEach(service => {
        const serviceID = service.serviceID || '';
        const mapping = serviceMapping[serviceID];
        
        if (!mapping) return; // Skip if we don't have a mapping for this service
        
        const container = document.getElementById(mapping.containerId);
        if (!container) return;

        const countSpan = container.querySelector('.service-count');
        const progressBar = container.querySelector('.progress-bar');
        
        const maxCapacity = service.maxCapacity || 0;
        const currentAssigned = service.currentAssigned || 0;
        
        // Calculate percentage (avoid division by zero)
        const percentage = maxCapacity > 0 ? Math.round((currentAssigned / maxCapacity) * 100) : 0;
        
        // Update display text
        if (countSpan) {
            countSpan.textContent = `(${currentAssigned}/${maxCapacity})`;
        }
        
        // Update progress bar width and color based on capacity
        if (progressBar) {
            progressBar.style.width = percentage + '%';
            
            // Remove all color classes
            progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
            
            // Add color based on percentage
            if (percentage <= 50) {
                progressBar.classList.add('bg-success');  // Green: under 50%
            } else if (percentage < 80) {
                progressBar.classList.add('bg-warning');  // Yellow: 50-80%
            } else {
                progressBar.classList.add('bg-danger');   // Red: 80%+
            }
        }
    });
}

//updates the stats in the dashboard header. Type can be 'registration' or 'completed'. Value is the number to update.
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

// Closes the check-in modal with a fade-out animation
function closeModalAnimated() {
    const modal = document.getElementById('checkInModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('d-none');
        modal.classList.remove('d-flex', 'closing');
    }, 250);
}

// Closes the QR code modal card
function closeQrModal() {
    const qrModal = document.getElementById('qrCodeModal');
    qrModal.classList.add('d-none');
    qrModal.classList.remove('d-flex');
}

// Creates the HTML for a service button based on the service type, current state, and availability. 
//State can be 1 (selected), 0 (not selected), or -1 (locked/unavailable).
function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    const isAvailable = serviceAvailability[serviceKey];
    state = parseInt(state);

    // If the patient wanted it but the service is unavailable, lock it and show as unavailable (red)
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

//================================================================================
// 4. DATA FETCHING & TABLE RENDERING

// Fetches the registration queue data from the API and populates the table. Also updates the stats in the header.
function fetchRegistrationQueue() {
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading registration queue...</td></tr>';

    //fetch queue data from API
    fetch('../api/GrabQueue.php?RegistrationStatus=Registered', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const clients = (data.data || []).filter(item => item.ClientID);
                populateRegistrationTable(clients);
                updateStats('registration', clients.length);
            } else {
                tableBody.innerHTML = 'No patients currently in queue.';
            }
            // Always update processed count if it came back
            if (statCompCount && data.clientsProcessed !== undefined) {
                statCompCount.innerText = data.clientsProcessed;
            }
            // Update service progress bars based on API data
            if (data.services && Array.isArray(data.services)) {
                updateServiceProgressBars(data.services);
            }
        })
        .catch(error => {
            console.error('Error fetching queue:', error);
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-danger">Connection error. Please refresh.</td></tr>';
        });
}

// Populates the registration table with patient data. 
// SORTING: Orders by Last Name (A-Z), then First Name (A-Z).
function populateRegistrationTable(patientsData) {
    tableBody.innerHTML = '';

    // If no patients are in the queue, displayed message instead of empty table
    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
        return;
    }

    // Sort patients by Last Name, then First Name (both case-insensitive)
    patientsData.sort((a, b) => {
        
        //Compare Last Names (Case-insensitive)
        const lastNameComparison = a.LastName.localeCompare(b.LastName);
        
        // If Last Names are different, use that order
        if (lastNameComparison !== 0) {
            return lastNameComparison;
        }
        
        // If Last Names are identical (e.g., two "Smiths"), sort by First Name
        return a.FirstName.localeCompare(b.FirstName);
    });

    //properly format each patient's name and DOB, then create a table row with their info and requested services
    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const formattedDOB = formatDOB(patient.DOB);

        // Map services array to individual fields
        const serviceSet = new Set(patient.services || []);
        patient.Medical = serviceSet.has('medical') ? 1 : 0;
        patient.Dental = serviceSet.has('dental') ? 1 : 0;
        patient.Optical = serviceSet.has('optical') ? 1 : 0;
        patient.Hair = serviceSet.has('haircut') ? 1 : 0;

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

//================================================================================
// 5. TABLE EVENT LISTENERS (Service Toggles & Check-In)

// Using event delegation to handle clicks on service buttons and check-in buttons within the table body
tableBody.addEventListener('click', function (event) {

    const serviceBtn = event.target.closest('.service-btn');
    if (serviceBtn) {
        if (serviceBtn.hasAttribute('disabled') || serviceBtn.classList.contains('locked-btn')) return;

        // Toggle service state between 1 (selected) and 0 (not selected)
        let currentState = parseInt(serviceBtn.getAttribute('data-state'));
        const icon = serviceBtn.querySelector('i');

        // If the service is currently selected, deselect it. If it's not selected, select it. Update button styles accordingly.
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

    // If a check-in button was clicked, open the check-in modal and populate it with the patient's info and requested services
    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        currentRowToUpdate = checkInBtn.closest('tr');
        currentClientName = currentRowToUpdate.querySelector('.fw-bold.text-dark').innerText;
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');

        // --- Dental section ---
        const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
        const dentalState = parseInt(dentalBtn.getAttribute('data-state'));

        document.getElementById('translatorCheck').checked = false;
        document.getElementById('dentalHygiene').checked = false;
        document.getElementById('dentalExtraction').checked = false;

        const dentalSection = document.getElementById('modalDentalSection');
        if (dentalState === 1 && serviceAvailability.dental) {
            dentalSection.classList.remove('d-none');
        } else {
            dentalSection.classList.add('d-none');
        }

        // --- Medical section ---
        const medicalBtn = currentRowToUpdate.querySelector('[title="Medical"]');
        const medicalState = parseInt(medicalBtn.getAttribute('data-state'));

        document.getElementById('medicalExam').checked = false;
        document.getElementById('medicalFollowUp').checked = false;

        const medicalSection = document.getElementById('modalMedicalSection');
        if (medicalState === 1 && serviceAvailability.medical) {
            medicalSection.classList.remove('d-none');
        } else {
            medicalSection.classList.add('d-none');
        }

        document.getElementById('modalPatientName').innerText = currentClientName;

        const modal = document.getElementById('checkInModal');
        modal.classList.remove('d-none');
        modal.classList.add('d-flex');
    }
});

//================================================================================
// 6. CHECK-IN MODAL SUBMISSION

// When the "Finalize Check-In" button is clicked, gather the selected services and interpreter need, send the data to the API, 
// and show the QR code modal with the generated QR code and service icons. Also handles loading state and error messages.
document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
    closeModalAnimated();
});

document.getElementById('finalizeCheckInBtn').addEventListener('click', function () {
    const btn = this;
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;

    // Build services array from selected buttons
    const services = [];

    // --- Medical: requires sub-selection (Exam or Follow Up) ---
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

    // --- Dental: requires sub-selection (Hygiene or Extraction) ---
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

    // Capture service states for QR card NOW (while DOM still exists)
    const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
    const medicalBtn = currentRowToUpdate.querySelector('[title="Medical"]');
    const hasDental  = dentalBtn  && dentalBtn.getAttribute('data-state')  === '1';
    const hasMedical = medicalBtn && medicalBtn.getAttribute('data-state') === '1';
    const hasOptical = opticalBtn && opticalBtn.getAttribute('data-state') === '1';
    const hasHaircut = hairBtn    && hairBtn.getAttribute('data-state')    === '1';

    // Loading state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // Send check-in data to API
    fetch('../api/CheckIn.php', {
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
                
                // Close check-in modal
                closeModalAnimated();

                // Remove patient from queue table
                if (currentRowToUpdate) {
                    currentRowToUpdate.remove();
                }

                // Update Stats
                // Decrement registration count
                let currentReg = parseInt(statRegCount.innerText) || 0;
                statRegCount.innerText = Math.max(0, currentReg - 1);

                // Update processed count from API (source of truth is the DB)
                if (statCompCount && data.clientsProcessed !== undefined) {
                    statCompCount.innerText = data.clientsProcessed;
                } else if (statCompCount) {
                    // Fallback: increment locally if API didn't return updated count
                    statCompCount.innerText = (parseInt(statCompCount.innerText) || 0) + 1;
                }

                // Show QR modal
                const qrModal = document.getElementById('qrCodeModal');
                qrModal.classList.remove('d-none');
                qrModal.classList.add('d-flex');

                // Split name and convert First Name to BOLD and ALL CAPS
                const nameParts = currentClientName.split(' ');
                const firstName = nameParts[0].toUpperCase();
                const lastName = nameParts.slice(1).join(' ');
                document.getElementById('qrCardTitle').innerHTML = `<strong>${firstName}</strong> ${lastName}`;

                // Generate QR Code (QRious library)
                new QRious({
                    element: document.getElementById('qr'),
                    value: currentClientId,
                    size: 200,
                });

                // Reset all QR card icons to be invisible but still occupy their "slot" (using visibility)
                const qrIcons = ['qrCardMedicalIcon', 'qrCardDentalIcon', 'qrCardOpticalIcon', 'qrCardHaircutIcon'];
                qrIcons.forEach(id => {
                    const iconEl = document.getElementById(id);
                    iconEl.style.visibility = 'hidden';
                    iconEl.style.display = 'inline-flex';
                });
                document.getElementById('qrCardTranslator').style.display = 'none';

                // Show icons for selected services by making them visible (preserves their fixed positions)
                if (hasMedical) document.getElementById('qrCardMedicalIcon').style.visibility = 'visible';
                if (hasDental)  document.getElementById('qrCardDentalIcon').style.visibility  = 'visible';
                if (hasOptical) document.getElementById('qrCardOpticalIcon').style.visibility = 'visible';
                if (hasHaircut) document.getElementById('qrCardHaircutIcon').style.visibility = 'visible';

                // Translator badge
                if (isInterpreterNeeded) {
                    document.getElementById('qrCardTranslator').style.display = 'block';
                }

            } else {
                // Check-in failed logic
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

//================================================================================
// 7. PRINT QR CODE

// When the "Print QR Code" button is clicked, apply print-specific styles to ensure only the QR code card is printed, then trigger the print dialog.
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
            #printQrBtn,
            #closeQrBtn { 
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
    fetchRegistrationQueue();
});

//================================================================================
// 8. INITIALIZATION
fetchRegistrationQueue();

// Auto-refresh every 3 minutes (unless checkIn modal is open)
setInterval(() => {
    const checkInOpen = !document.getElementById('checkInModal').classList.contains('d-none');
    const qrOpen = !document.getElementById('qrCodeModal').classList.contains('d-none');
    if (!checkInOpen && !qrOpen) {
        fetchRegistrationQueue();
    }
    console.log("Fetching registered clients....")
}, 180000); 