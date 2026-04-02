/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Cameron
 * Last Modified On:  April 1 @ 11:00 PM
 * Changes Made:      Added reset password functionality.
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
let selectedPasswordUser = null;
let passwordSearchDebounceTimer = null;

// Search elements
const searchInput = document.getElementById('registrationSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const noSearchResults = document.getElementById('noSearchResults');
const noSearchTerm = document.getElementById('noSearchTerm');

// Password reset modal elements
const btnResetPassword = document.getElementById('btn-reset-password');
const changePasswordModal = document.getElementById('changePasswordModal');
const closeChangePasswordModalBtn = document.getElementById('closeChangePasswordModalBtn');
const passwordSearchSection = document.getElementById('passwordSearchSection');
const passwordResetSection = document.getElementById('passwordResetSection');
const userPasswordSearch = document.getElementById('userPasswordSearch');
const clearUserPasswordSearchBtn = document.getElementById('clearUserPasswordSearchBtn');
const passwordUserTableBody = document.getElementById('passwordUserTableBody');
const selectedPasswordUserName = document.getElementById('selectedPasswordUserName');
const selectedPasswordUserDob = document.getElementById('selectedPasswordUserDob');
const selectedPasswordUserEmail = document.getElementById('selectedPasswordUserEmail');
const newUserPassword = document.getElementById('newUserPassword');
const toggleNewUserPasswordBtn = document.getElementById('toggleNewUserPasswordBtn');
const newUserPasswordIcon = document.getElementById('newUserPasswordIcon');
const confirmUserPassword = document.getElementById('confirmUserPassword');
const toggleConfirmUserPasswordBtn = document.getElementById('toggleConfirmUserPasswordBtn');
const confirmUserPasswordIcon = document.getElementById('confirmUserPasswordIcon');
const backToUserSearchBtn = document.getElementById('backToUserSearchBtn');
const saveUserPasswordBtn = document.getElementById('saveUserPasswordBtn');
const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\S{8,}$/;

//================================================================================
// 2. DOM REFERENCES

const tableBody = document.querySelector('tbody');      // Link to the Table Body
const statRegCount = document.getElementById('stat-reg-count'); // Link to "Registration" Number
const statCompCount = document.getElementById('stat-comp-count'); // Link to "Processed" Number

//================================================================================
// 3. HELPERS

// --- Tab State & Elements ---
let currentTab = 'registration'; // Tracks if we are viewing 'registration' or 'checked-in'
const btnRegistration = document.getElementById('btn-registration');
const btnCheckedIn = document.getElementById('btn-checked-in');

btnRegistration.addEventListener('click', () => {
    if (currentTab === 'registration') return;
    currentTab = 'registration';
    btnRegistration.classList.add('active');
    btnCheckedIn.classList.remove('active');
    fetchRegistrationQueue(); // Re-fetch for registration queue
});

btnCheckedIn.addEventListener('click', () => {
    if (currentTab === 'checked-in') return;
    currentTab = 'checked-in';
    btnCheckedIn.classList.add('active');
    btnRegistration.classList.remove('active');
    fetchRegistrationQueue(); // Re-fetch for checked-in queue
});

if (btnResetPassword) {
    btnResetPassword.addEventListener('click', () => {
        openChangePasswordModal();
    });
}

//formats "YYYY-MM-DD" to "MM/DD/YYYY", returns "N/A" if input is empty or null
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setFieldInvalidState(field, isInvalid) {
    if (!field) return;
    field.classList.toggle('is-invalid', isInvalid);
}

function validatePasswordFieldsLive(requireBoth = false) {
    const password = newUserPassword ? newUserPassword.value : '';
    const confirm = confirmUserPassword ? confirmUserPassword.value : '';

    const hasPassword = password.length > 0;
    const hasConfirm = confirm.length > 0;
    const invalidFormat = hasPassword && !PASSWORD_PATTERN.test(password);
    const mismatch = hasPassword && hasConfirm && password !== confirm;

    const passwordInvalid =
        (requireBoth && !hasPassword) ||
        invalidFormat ||
        mismatch;

    const confirmInvalid =
        (requireBoth && !hasConfirm) ||
        mismatch;

    setFieldInvalidState(newUserPassword, passwordInvalid);
    setFieldInvalidState(confirmUserPassword, confirmInvalid);

    return { hasPassword, hasConfirm, invalidFormat, mismatch };
}

// Function to show passwords in reset modal when toggled
function resetNewPasswordVisibility() {
    if (newUserPassword) {
        newUserPassword.type = 'password';
    }
    if (newUserPasswordIcon) {
        newUserPasswordIcon.classList.remove('bi-eye-slash');
        newUserPasswordIcon.classList.add('bi-eye');
    }
    if (toggleNewUserPasswordBtn) {
        toggleNewUserPasswordBtn.setAttribute('title', 'Show password');
        toggleNewUserPasswordBtn.setAttribute('aria-label', 'Show password');
    }

    if (confirmUserPassword) {
        confirmUserPassword.type = 'password';
    }
    if (confirmUserPasswordIcon) {
        confirmUserPasswordIcon.classList.remove('bi-eye-slash');
        confirmUserPasswordIcon.classList.add('bi-eye');
    }
    if (toggleConfirmUserPasswordBtn) {
        toggleConfirmUserPasswordBtn.setAttribute('title', 'Show password');
        toggleConfirmUserPasswordBtn.setAttribute('aria-label', 'Show password');
    }
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

// Filters the visible table rows based on the current search query.
// Shows a "no results" message when nothing matches.
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

    // Toggle "no results" message
    if (query && visibleCount === 0) {
        noSearchResults.classList.remove('d-none');
        noSearchTerm.textContent = searchInput.value.trim();
    } else {
        noSearchResults.classList.add('d-none');
    }

    // Show/hide the clear (X) button
    clearSearchBtn.style.display = query ? '' : 'none';
}

// Search input: filter on every keystroke
searchInput.addEventListener('input', applySearch);

// Clear button: reset search and re-show all rows
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applySearch();
    searchInput.focus();
});

//================================================================================
// 4. PASSWORD RESET FUNCTIONALITY
// Resets the state of the change password modal to its initial state, clearing any selected user and input fields.
function resetChangePasswordModalState() {
    selectedPasswordUser = null;
    passwordSearchSection.classList.remove('d-none');
    passwordResetSection.classList.add('d-none');
    selectedPasswordUserName.innerText = '-';
    selectedPasswordUserDob.innerText = 'DOB: -';
    selectedPasswordUserEmail.innerText = 'Email: -';
    newUserPassword.value = '';
    confirmUserPassword.value = '';
    resetNewPasswordVisibility();
    setFieldInvalidState(newUserPassword, false);
    setFieldInvalidState(confirmUserPassword, false);
}

// Placeholder for searching clients to reset password 
const PASSWORD_SEARCH_PLACEHOLDER = '<tr><td colspan="4" class="text-center text-muted p-3">Type a name or email to search clients.</td></tr>';

// Opens the change password modal and resets its state to the initial view.
function openChangePasswordModal() {
    resetChangePasswordModalState();
    userPasswordSearch.value = '';
    clearUserPasswordSearchBtn.style.display = 'none';
    passwordUserTableBody.innerHTML = PASSWORD_SEARCH_PLACEHOLDER;
    changePasswordModal.classList.remove('d-none');
    changePasswordModal.classList.add('d-flex');
}

// Closes the change password modal and resets its state.
function closeChangePasswordModal() {
    changePasswordModal.classList.add('d-none');
    changePasswordModal.classList.remove('d-flex');
}

// Renders the list of users in the password reset search results table. 
function renderPasswordUsers(users) {
    if (!Array.isArray(users) || users.length === 0) {
        passwordUserTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">No clients found.</td></tr>';
        return;
    }

    // For each user, create a table row with their name, DOB, email, and a select button. 
    passwordUserTableBody.innerHTML = users.map(user => {
        const middleInitial = user.MiddleInitial ? ` ${escapeHtml(user.MiddleInitial)}.` : '';
        const fullName = `${escapeHtml(user.FirstName)}${middleInitial} ${escapeHtml(user.LastName)}`;
        const dob = formatDOB(user.DOB);
        const emailRaw = user.Email || '';
        const emailDisplay = emailRaw
            ? escapeHtml(emailRaw)
            : '<span class="text-muted fst-italic">No account</span>';
        return `
            <tr class="select-password-user-row" style="cursor: pointer;"
                data-client-id="${escapeHtml(user.ClientID)}"
                data-name="${fullName}"
                data-dob="${escapeHtml(dob)}"
                data-email="${escapeHtml(emailRaw)}">
                <td class="fw-semibold text-dark">${fullName}</td>
                <td class="text-secondary">${dob}</td>
                <td class="text-secondary">${emailDisplay}</td>
                <td>
                    <button type="button" class="btn btn-sm bg-primary text-white select-password-user-btn"
                        data-client-id="${escapeHtml(user.ClientID)}"
                        data-name="${fullName}"
                        data-dob="${escapeHtml(dob)}"
                        data-email="${escapeHtml(emailRaw)}">
                        Select
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// When a user is selected from the search results, this function populates the password reset section with their info and shows it.
function selectPasswordUserFromElement(sourceEl) {
    if (!sourceEl) return;

    selectedPasswordUser = {
        clientID: sourceEl.getAttribute('data-client-id'),
        name: sourceEl.getAttribute('data-name'),
        dob: sourceEl.getAttribute('data-dob'),
        email: sourceEl.getAttribute('data-email')
    };

    selectedPasswordUserName.innerText = selectedPasswordUser.name;
    selectedPasswordUserDob.innerText = `DOB: ${selectedPasswordUser.dob}`;
    selectedPasswordUserEmail.innerText = `Email: ${selectedPasswordUser.email}`;
    newUserPassword.value = '';
    confirmUserPassword.value = '';
    resetNewPasswordVisibility();
    setFieldInvalidState(newUserPassword, false);
    setFieldInvalidState(confirmUserPassword, false);

    passwordSearchSection.classList.add('d-none');
    passwordResetSection.classList.remove('d-none');
}

// Fetches users from the API based on the search query and renders them in the table.
function fetchPasswordUsers(query) {
    passwordUserTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">Loading users...</td></tr>';

    fetch('../api/registration-dashboard.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'searchUsers',
            query: query || ''
        })
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                passwordUserTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">No users found.</td></tr>';
                Swal.fire({
                    icon: 'error',
                    title: 'Search Failed',
                    text: data.message || 'Unable to search users.',
                    confirmButtonColor: '#174593'
                });
                return;
            }

            renderPasswordUsers(data.data || []);
        })
        .catch(error => {
            console.error('Error searching users:', error);
            passwordUserTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-3">No users found.</td></tr>';
            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Unable to connect to the server. Please try again.',
                confirmButtonColor: '#174593'
            });
        });
}

// closes the change password modal when the close button is clicked or when clicking outside the modal area
if (closeChangePasswordModalBtn) {
    closeChangePasswordModalBtn.addEventListener('click', () => {
        closeChangePasswordModal();
    });
}

// Allow clicking outside the modal content to close the change password modal
if (changePasswordModal) {
    changePasswordModal.addEventListener('click', (event) => {
        if (event.target === changePasswordModal) {
            closeChangePasswordModal();
        }
    });
}

// a timeout to limit how often we send search requests as the user types in the password reset search field
if (userPasswordSearch) {
    userPasswordSearch.addEventListener('input', () => {
        const query = userPasswordSearch.value.trim();
        clearUserPasswordSearchBtn.style.display = query ? '' : 'none';

        if (passwordSearchDebounceTimer) {
            clearTimeout(passwordSearchDebounceTimer);
        }

        if (!query) {
            passwordUserTableBody.innerHTML = PASSWORD_SEARCH_PLACEHOLDER;
            return;
        }

        passwordSearchDebounceTimer = setTimeout(() => {
            fetchPasswordUsers(query);
        }, 300);
    });
}

// resets search field when clear btn is clicked
if (clearUserPasswordSearchBtn) {
    clearUserPasswordSearchBtn.addEventListener('click', () => {
        userPasswordSearch.value = '';
        clearUserPasswordSearchBtn.style.display = 'none';
        passwordUserTableBody.innerHTML = PASSWORD_SEARCH_PLACEHOLDER;
        userPasswordSearch.focus();
    });
}

// validates password fields in real-time as the user types, providing immediate feedback on validity and matching status.
if (newUserPassword) {
    newUserPassword.addEventListener('input', () => {
        validatePasswordFieldsLive(false);
    });
}

// Functions to toggle password visibility for new password and confirm password fields, updating the input type and icon accordingly.
if (toggleNewUserPasswordBtn && newUserPassword) {
    toggleNewUserPasswordBtn.addEventListener('click', () => {
        const isPassword = newUserPassword.type === 'password';
        newUserPassword.type = isPassword ? 'text' : 'password';

        if (newUserPasswordIcon) {
            newUserPasswordIcon.classList.toggle('bi-eye', !isPassword);
            newUserPasswordIcon.classList.toggle('bi-eye-slash', isPassword);
        }

        toggleNewUserPasswordBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
        toggleNewUserPasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
}

// Toggle for confirm password visibility
if (toggleConfirmUserPasswordBtn && confirmUserPassword) {
    toggleConfirmUserPasswordBtn.addEventListener('click', () => {
        const isPassword = confirmUserPassword.type === 'password';
        confirmUserPassword.type = isPassword ? 'text' : 'password';

        if (confirmUserPasswordIcon) {
            confirmUserPasswordIcon.classList.toggle('bi-eye', !isPassword);
            confirmUserPasswordIcon.classList.toggle('bi-eye-slash', isPassword);
        }

        toggleConfirmUserPasswordBtn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
        toggleConfirmUserPasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
}

// Validates password fields in real-time as the user types, providing immediate feedback on validity and matching status.
if (confirmUserPassword) {
    confirmUserPassword.addEventListener('input', () => {
        validatePasswordFieldsLive(false);
    });
}

// allowing user to click on clients row
if (passwordUserTableBody) {
    passwordUserTableBody.addEventListener('click', (event) => {
        const selectBtn = event.target.closest('.select-password-user-btn');
        if (selectBtn) {
            selectPasswordUserFromElement(selectBtn);
            return;
        }

        const selectRow = event.target.closest('.select-password-user-row');
        if (selectRow) {
            selectPasswordUserFromElement(selectRow);
        }
    });
}

// Allows user to return to client search bar after getting into password reset
if (backToUserSearchBtn) {
    backToUserSearchBtn.addEventListener('click', () => {
        passwordResetSection.classList.add('d-none');
        passwordSearchSection.classList.remove('d-none');
    });
}

// Error handling for multiple errors
if (saveUserPasswordBtn) {
    // Error for when no user is selected
    saveUserPasswordBtn.addEventListener('click', function () {
        if (!selectedPasswordUser || !selectedPasswordUser.clientID) {
            Swal.fire({
                icon: 'warning',
                title: 'No User Selected',
                text: 'Please select a user before resetting password.',
                confirmButtonColor: '#174593'
            });
            return;
        }

        const password = newUserPassword.value;
        const validation = validatePasswordFieldsLive(true);

        // Check for missing fields
        if (!validation.hasPassword || !validation.hasConfirm) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Password',
                text: 'Please enter and confirm the new password.',
                confirmButtonColor: '#174593'
            });
            return;
        }

        // If the password and confirm password fields do not match, show an error message
        if (validation.mismatch) {
            Swal.fire({
                icon: 'warning',
                title: 'Passwords Do Not Match',
                text: 'The new password and confirmation must match.',
                confirmButtonColor: '#174593'
            });
            return;
        }

        // If the password does not meet the required format, show an error message
        if (validation.invalidFormat) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Password',
                text: 'Please enter a valid password.',
                confirmButtonColor: '#174593'
            });
            return;
        }

        const btn = this;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Saving...';

        // Send the password reset request to the API
        fetch('../api/registration-dashboard.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'resetUserPassword',
                clientID: selectedPasswordUser.clientID,
                password
            })
        })
            //swal fire pop ups based on response from API
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Reset Failed',
                        text: data.message || 'Unable to reset password.',
                        confirmButtonColor: '#174593'
                    });
                    return;
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Password Updated',
                    text: 'The user password has been reset successfully.',
                    confirmButtonColor: '#174593'
                });

                closeChangePasswordModal();
            })
            // swal fire error if there was a error witht he API request
            .catch(error => {
                console.error('Error resetting password:', error);
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
}

//================================================================================
// 5. DATA FETCHING & TABLE RENDERING

// Fetches the registration queue data from the API and populates the table. Also updates the stats in the header.
function fetchRegistrationQueue() {
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading registration queue...</td></tr>';

    //fetch queue data from API
    fetch('../api/registration-dashboard.php?RegistrationStatus=Registered', {
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

    // Re-apply any active search filter after table repopulates
    if (searchInput.value.trim()) {
        applySearch();
    }
}

//================================================================================
// 6. TABLE EVENT LISTENERS (Service Toggles & Check-In)

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

        // Auto-toggle translator checkbox if client was flagged as needing one (e.g. registered in Spanish)
        const translatorNeeded = currentRowToUpdate.getAttribute('data-translator');
        document.getElementById('translatorCheck').checked = (translatorNeeded === '1');
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
// 7. CHECK-IN MODAL SUBMISSION

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
    const hasDental = dentalBtn && dentalBtn.getAttribute('data-state') === '1';
    const hasMedical = medicalBtn && medicalBtn.getAttribute('data-state') === '1';
    const hasOptical = opticalBtn && opticalBtn.getAttribute('data-state') === '1';
    const hasHaircut = hairBtn && hairBtn.getAttribute('data-state') === '1';

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

                // Split name and convert First Name to ALL CAPS
                const nameParts = currentClientName.split(' ');
                const firstName = nameParts[0].toUpperCase();
                const lastName = nameParts.slice(1).join(' ');

                // Get the name elements
                const firstNameEl = document.getElementById('qrCardFirstName');
                const lastNameEl = document.getElementById('qrCardLastName');

                // Scale font size down based on character length so name always fits on one line.
                // Truncate with ellipsis only as a last resort if over 16 chars.
                function scaledName(name, maxSize, minSize) {
                    const len = name.length;
                    if (len <= 6)  return { text: name, size: maxSize };
                    if (len <= 8)  return { text: name, size: maxSize * 0.85 };
                    if (len <= 10) return { text: name, size: maxSize * 0.70 };
                    if (len <= 12) return { text: name, size: maxSize * 0.58 };
                    if (len <= 14) return { text: name, size: maxSize * 0.50 };
                    // Beyond 14 chars: truncate and use minimum size
                    return { text: name.slice(0, 14) + '…', size: minSize };
                }

                const first = scaledName(firstName, 2.5, 1.1);
                const last  = scaledName(lastName,  1.5, 0.8);

                firstNameEl.innerText = first.text;
                firstNameEl.style.fontSize = first.size + 'rem';

                lastNameEl.innerText = last.text;
                lastNameEl.style.fontSize = last.size + 'rem';

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
                if (hasDental) document.getElementById('qrCardDentalIcon').style.visibility = 'visible';
                if (hasOptical) document.getElementById('qrCardOpticalIcon').style.visibility = 'visible';
                if (hasHaircut) document.getElementById('qrCardHaircutIcon').style.visibility = 'visible';

                // Translator badge: show the icon pinned to top-right of the name area
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
// 8. PRINT QR CODE

// When the "Print QR Code" button is clicked, apply print-specific styles to ensure only the QR code card is printed, then trigger the print dialog.
document.getElementById('printQrBtn').addEventListener('click', function () {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            @page {
                size: 2.3125in 4in; /* Width x Height */
                margin: 0; 
            }

            /* LOCK the document height so invisible elements don't create blank pages */
            html, body {
                height: 4in !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            body * {
                visibility: hidden;
            }
            
            #qrCodeModal, #qrCodeModal * {
                visibility: visible;
            }

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

            #printQrBtn, #closeQrBtn {
                display: none !important;
            }

            /* --- UPDATED: Icon Sizing & Borders --- */
            
            #qrCodeModal .qr-icon-border {
                flex-shrink: 0 !important; 
                font-size: 2rem !important; /* Icon size inside the box */
                width: 46px !important;  /* Increased from 40px */
                height: 46px !important; /* Increased from 40px */
                border-width: 2px !important; /* Forces a thinner, cleaner border */
                border-style: solid !important;
                border-color: black !important;
                border-radius: 8px !important; /* Optional: adds a slight rounding to the border */
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            /* Tighten the gap even more so the larger icons don't overflow the label */
            #qrCodeModal .gap-3 {
                gap: 0.25rem !important; 
            }
            
            #qrCodeModal canvas {
                max-width: 1.8in !important;
                height: auto !important;
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
// 9. INITIALIZATION
fetchRegistrationQueue();
