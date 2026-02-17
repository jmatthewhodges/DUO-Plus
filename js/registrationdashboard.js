// ==========================================
// 1. GLOBAL SETTINGS, MOCK DATA & MEMORY
// ==========================================

// Global Service Availability (true = open, false = full/unavailable)
const serviceAvailability = {
    medical: true,
    dental: true,    // Kept as true for testing
    optical: true,
    haircut: true
};

// API Mock Data (Matching your specific incoming structure)
const patients = [
    {
        clientId: 101,
        firstName: "John",
        middleInitial: "A",
        lastName: "Doe",
        dob: "11/01/1978",
        serviceInfo: { medical: 1, dental: 1, optical: 0, haircut: 1 } 
    },
    {
        clientId: 102,
        firstName: "Jane",
        middleInitial: "D",
        lastName: "Rhett",
        dob: "07/21/2001",
        serviceInfo: { medical: 0, dental: 1, optical: 1, haircut: 1 } 
    },
    {
        clientId: 103,
        firstName: "Michael",
        middleInitial: "S",
        lastName: "Johnson",
        dob: "03/15/1985",
        serviceInfo: { medical: 0, dental: 0, optical: 0, haircut: 0 } 
    }
];

// Memory variables to remember which row/client was clicked
let currentRowToUpdate = null;
let currentClientName = ""; // Used for display in the modal
let currentClientId = null; // Used for the API request

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const tableBody = document.querySelector('tbody');

// ==========================================
// 3. HTML GENERATOR FUNCTIONS
// ==========================================

function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    let isAvailable = serviceAvailability[serviceKey];

    // If they wanted it (1) but it's full, force state to -1 (Red)
    if (state === 1 && !isAvailable) {
        state = -1; 
    }

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
                data-state="${state}"
                ${disabledAttr}
                title="${serviceType}" 
                style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${iconClass} ${iconColor}"></i>
        </button>
    `;
}

function populateRegistrationTable() {
    tableBody.innerHTML = '';

    patients.forEach(patient => {
        // Construct the full name string
        const fullName = `${patient.firstName} ${patient.middleInitial}. ${patient.lastName}`;

        // Note: We store the clientId in the data-client-id attribute of the <tr>
        const rowHTML = `
            <tr class="align-middle" data-client-id="${patient.clientId}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width: 40px; height: 40px;">
                            <i class="bi bi-person-circle" style="font-size: 1.5rem"></i>
                        </div>
                        <span class="fw-bold text-dark">${fullName}</span>
                    </div>
                </td>
                <td class="fw-medium text-secondary">${patient.dob}</td>
                <td>
                    <div class="d-flex justify-content-between align-items-center pe-3">
                        <div class="d-flex gap-3">
                            ${buildServiceButton('Medical', patient.serviceInfo.medical, 'bi-heart-pulse', 'medical')}
                            ${buildServiceButton('Dental', patient.serviceInfo.dental, 'bi-shield-shaded', 'dental')}
                            ${buildServiceButton('Optical', patient.serviceInfo.optical, 'bi-eye', 'optical')}
                            ${buildServiceButton('Haircut', patient.serviceInfo.haircut, 'bi-scissors', 'haircut')}
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
// 4. EVENT LISTENERS (TABLE CLICKS)
// ==========================================

tableBody.addEventListener('click', function(event) {
    
    // --- SCENARIO A: A Service Button was clicked ---
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

    // --- SCENARIO B: The Check-In Button was clicked ---
    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        
        // 1. Identify the Row and Data
        currentRowToUpdate = checkInBtn.closest('tr');
        currentClientName = currentRowToUpdate.querySelector('.fw-bold.text-dark').innerText;
        
        // Grab the Client ID from the data attribute we added in buildRow
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');
        
        // 2. Check Dental Status for this row
        const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
        const dentalState = parseInt(dentalBtn.getAttribute('data-state'));

        // 3. Populate Modal UI
        document.getElementById('modalPatientName').innerText = currentClientName;

        // Reset inputs
        document.getElementById('translatorCheck').checked = false;
        document.getElementById('dentalHygiene').checked = false;
        document.getElementById('dentalExtraction').checked = false;

        // 4. Show/Hide Dental Section
        const dentalSection = document.getElementById('modalDentalSection');
        if (dentalState === 1 && serviceAvailability.dental === true) {
            dentalSection.classList.remove('d-none');
        } else {
            dentalSection.classList.add('d-none');
        }

        // 5. Open Modal
        const modal = document.getElementById('checkInModal');
        modal.classList.remove('d-none');
        modal.classList.add('d-flex'); 
    }
});

// ==========================================
// 5. MODAL ACTION LISTENERS & FETCH
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

// FINAL SUBMISSION LOGIC
document.getElementById('finalizeCheckInBtn').addEventListener('click', function() {
    
    const btn = this; 
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;
    const selectedDental = document.querySelector('input[name="dentalChoice"]:checked');
    
    // Validation
    const dentalSection = document.getElementById('modalDentalSection');
    if (!dentalSection.classList.contains('d-none') && !selectedDental) {
        Swal.fire({
            icon: 'warning',
            title: 'Selection Required',
            text: 'Please select either Hygiene or Extraction to proceed.',
            confirmButtonColor: '#174593'
        });
        return; 
    }

    // Loading State
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    //====================================
    // QR CODE GENERATION & DISPLAY LOGIC
    //====================================
    // Show QR Modal
    closeModalAnimated();

    const dentalBtn = currentRowToUpdate.querySelector('[title="Dental"]');
    const medicalBtn = currentRowToUpdate.querySelector('[title="Medical"]');
    const opticalBtn = currentRowToUpdate.querySelector('[title="Optical"]');
    const haircutBtn = currentRowToUpdate.querySelector('[title="Haircut"]');
    
    const hasDental = dentalBtn && dentalBtn.getAttribute('data-state') === '1';
    const hasMedical = medicalBtn && medicalBtn.getAttribute('data-state') === '1';
    const hasOptical = opticalBtn && opticalBtn.getAttribute('data-state') === '1';
    const hasHaircut = haircutBtn && haircutBtn.getAttribute('data-state') === '1';

    if (currentRowToUpdate) {
        currentRowToUpdate.remove();
    }

    setTimeout(() => {
        const qrCode = document.getElementById('qrCodeModal');
        qrCode.classList.remove('d-none');
        qrCode.classList.add('d-flex');
        
        // Populate QR modal with client name
        document.getElementById('qrCardTitle').textContent = currentClientName;
        
        // Generate QR Code - using QRious library
        var qr = new QRious({
            element: document.getElementById('qr'),
            value: currentClientId,
            size: 200,
        });
        
        // Reset all icons to hidden first
        document.getElementById('qrCardDentalIcon').style.display = 'none';
        document.getElementById('qrCardMedicalIcon').style.display = 'none';
        document.getElementById('qrCardOpticalIcon').style.display = 'none';
        document.getElementById('qrCardHaircutIcon').style.display = 'none';
        document.getElementById('qrCardTranslator').style.display = 'none';
        
        // Show service icons based on what was selected
        if (hasDental) {
            document.getElementById('qrCardDentalIcon').style.display = 'block';
        }
        if (hasMedical) {
            document.getElementById('qrCardMedicalIcon').style.display = 'block';
        }
        if (hasOptical) {
            document.getElementById('qrCardOpticalIcon').style.display = 'block';
        }
        if (hasHaircut) {
            document.getElementById('qrCardHaircutIcon').style.display = 'block';
        }
        
        // Show translator icon if needed
        const translatorCheck = document.getElementById('translatorCheck');
        if (translatorCheck && translatorCheck.checked) {
            document.getElementById('qrCardTranslator').style.display = 'block';
        }
    }, 300);

    //====================================
    // END QR CODE LOGIC
    //====================================

    // TODO: Fix API response - commented out fetch for now
    /*
    // The Fetch Request
    fetch('../api/check-in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            clientId: currentClientId,           // The ID we grabbed from the row
            serviceInfo: selectedDental ? selectedDental.value : null, // The specific dental choice
            languageInterpreter: isInterpreterNeeded // Boolean (true/false)
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            
            closeModalAnimated();

            if (currentRowToUpdate) {
                currentRowToUpdate.remove();
            }

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
    */
    
    btn.disabled = false;
    btn.innerHTML = originalText;
});

//==========================================
// 7. PRINT QR CODE FUNCTIONALITY
//==========================================
document.getElementById('printQrBtn').addEventListener('click', function() {
    // Add print-specific styling to show only the modal
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            @page { margin: 0; size: auto; }
            html, body { 
                width: 100%; 
                height: 100%; 
                margin: 0; 
                padding: 0; 
                background: white;
            }
            * { 
                margin: 0; 
                padding: 0; 
                visibility: hidden;
            }
            #qrCodeModal, #qrCodeModal * {
                visibility: visible !important;
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
                visibility: hidden !important;
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Trigger print
    window.print();
    
    // Close the modal and clean up after print dialog closes
    setTimeout(() => {
        document.head.removeChild(style);
        const qrCode = document.getElementById('qrCodeModal');
        qrCode.classList.add('d-none');
        qrCode.classList.remove('d-flex');
    }, 100);
});

//============================
//END PRINT LOGIC
//============================

// ==========================================
// 6. INITIALIZATION
// ==========================================
populateRegistrationTable();