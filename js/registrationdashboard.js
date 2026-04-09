/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Lauren
 * Last Modified On:  April 3rd @ 2:15 PM
 * Changes Made:      Added volunteer printing functionality tweaks based on Burchfield feedback.
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE

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

// Service hierarchy — loaded from API at init
let serviceCategories = [];   // [{ ServiceID, ServiceName, IconTag, SortOrder, children: [...] }]
let serviceAvailability = {};  // { categoryServiceID: true/false }
let serviceMapping = {};       // { childServiceID: { containerId, displayName } }

// SVG-aware icon renderer (shared helper)
function renderIcon(iconTag, extraClass = '', style = '') {
    if (!iconTag) iconTag = 'bi-circle';
    if (iconTag.trim().startsWith('<')) {
        return `<span class="svg-icon ${extraClass}" style="display:inline-flex;align-items:center;justify-content:center;${style}">${iconTag.replace(/<svg/, '<svg style="width:1em;height:1em;fill:currentColor"')}</span>`;
    }
    return `<i class="bi ${iconTag} ${extraClass}" style="${style}"></i>`;
}

// Loads the service hierarchy and builds serviceCategories, serviceAvailability, serviceMapping
async function loadServiceHierarchyForDashboard() {
    try {
        const res = await fetch('/api/services.php?view=hierarchy');
        const json = await res.json();
        if (!json.success || !json.hierarchy) return;

        // Filter out closed services from hierarchy
        // Remove closed children, and remove categories where all children are closed
        const filtered = json.hierarchy.map(cat => {
            if (cat.children && cat.children.length > 0) {
                const openChildren = cat.children.filter(c => !c.IsClosed);
                if (openChildren.length === 0) return null; // all children closed — hide category
                return { ...cat, children: openChildren };
            }
            return cat; // standalone category — keep (availability handles closure)
        }).filter(Boolean);

        serviceCategories = filtered;
        serviceAvailability = {};
        serviceMapping = {};

        serviceCategories.forEach(cat => {
            serviceAvailability[cat.ServiceID] = true; // updated by API availability later

            if (cat.children && cat.children.length > 0) {
                cat.children.forEach(child => {
                    const containerId = 'service-' + child.ServiceID.replace(/([A-Z])/g, '-$1').toLowerCase();
                    // Strip parent name prefix from child (e.g. "Medical Exam" → "Exam")
                    let shortName = child.ServiceName;
                    if (shortName.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                        shortName = shortName.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                    }
                    serviceMapping[child.ServiceID] = {
                        containerId: containerId,
                        displayName: cat.ServiceName + ' - ' + (shortName || child.ServiceName),
                    };
                });
            } else {
                // Standalone category (no children)
                const containerId = 'service-' + cat.ServiceID;
                serviceMapping[cat.ServiceID] = {
                    containerId: containerId,
                    displayName: cat.ServiceName,
                };
            }
        });
    } catch (err) {
        console.error('Failed to load service hierarchy:', err);
    }
}

// Builds the service progress bar elements in the Availability card
function buildServiceProgressBars() {
    const container = document.getElementById('serviceProgressContainer');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(serviceMapping).forEach(([serviceID, mapping]) => {
        // Find the icon from the hierarchy — check children first, then standalone categories
        let iconTag = '';
        for (const cat of serviceCategories) {
            if (cat.children && cat.children.length > 0) {
                const child = cat.children.find(c => c.ServiceID === serviceID);
                if (child) { iconTag = child.IconTag || cat.IconTag || ''; break; }
            } else if (cat.ServiceID === serviceID) {
                iconTag = cat.IconTag || ''; break;
            }
        }

        const div = document.createElement('div');
        div.id = mapping.containerId;
        div.className = 'border rounded p-2 px-3';
        div.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-1">
                <div class="d-flex align-items-center gap-2">
                    <span class="text-primary" style="font-size: 1.1rem;"></span>
                    <span class="fw-bold" style="font-size: 0.9rem; color:black;"></span>
                </div>
                <div class="d-flex align-items-center gap-1">
                    <span class="badge fw-bold service-count" style="font-size: 0.8rem; background-color: #e9ecef; color: #495057 !important;">0/0</span>
                    <span class="badge standby-badge fw-bold d-none" style="font-size: 0.7rem; background-color: #FFF3CD; color: #7A5A00 !important; border: 1px solid #FFDA6A;">0 standby</span>
                </div>
            </div>
            <div class="progress" style="height: 6px; border-radius: 3px;">
                <div class="progress-bar bg-secondary" role="progressbar" style="width: 0%; border-radius: 3px;"></div>
            </div>`;
        // Set icon (SVG-aware)
        const iconContainer = div.querySelector('span.text-primary');
        iconContainer.innerHTML = renderIcon(iconTag, 'text-primary');
        div.querySelector('span.fw-bold').textContent = mapping.displayName;
        container.appendChild(div);
    });
}

// Builds fixed-position icon slots for the QR badge.
// Always renders one slot per service category in hierarchy order.
// Selected services show the icon with a border; unselected show an invisible placeholder.
function buildQrIconSlots(container, selectedServiceIDs, iconLookup) {
    container.innerHTML = '';
    // Map selected operational service IDs back to their parent category ID,
    // keeping track of which specific child was selected so we use its icon.
    const selectedCategoryMap = {}; // { categoryID: childServiceID }
    selectedServiceIDs.forEach(svcID => {
        // Check if the ID is a category itself
        const directCat = serviceCategories.find(c => c.ServiceID === svcID);
        if (directCat) { selectedCategoryMap[svcID] = svcID; return; }
        // Otherwise find the parent category
        for (const cat of serviceCategories) {
            if (cat.children && cat.children.some(ch => ch.ServiceID === svcID)) {
                selectedCategoryMap[cat.ServiceID] = svcID;
                return;
            }
        }
    });

    serviceCategories.forEach(cat => {
        const wrapper = document.createElement('span');
        wrapper.style.fontSize = '2.5rem';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';

        const selectedChildID = selectedCategoryMap[cat.ServiceID];
        if (selectedChildID) {
            wrapper.className = 'qr-icon-border';
            wrapper.style.color = 'black';
            wrapper.innerHTML = renderIcon(iconLookup[selectedChildID] || iconLookup[cat.ServiceID] || 'bi-circle');
        } else {
            wrapper.className = 'qr-icon-border qr-icon-empty';
        }
        container.appendChild(wrapper);
    });
}

// Active check-in state
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;
let checkInModalMode = 'registration';
let originalCheckedInServices = [];
let originalTranslatorNeeded = false;
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
const selectedPasswordUserPhone = document.getElementById('selectedPasswordUserPhone');
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

function normalizeServiceIds(serviceIds) {
    return [...new Set((serviceIds || []).map(id => String(id).trim()).filter(Boolean))].sort();
}

function areServiceSelectionsEqual(first, second) {
    if (first.length !== second.length) return false;
    for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) return false;
    }
    return true;
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

// Fetch only service stats and update progress bars (lightweight call after check-in)
function refreshServiceStats() {
    fetch('../api/registration-dashboard.php?RegistrationStatus=Registered', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.services && Array.isArray(data.services)) {
                updateServiceProgressBars(data.services);
            }
        })
        .catch(error => console.error('Error refreshing service stats:', error));
}

//updates the service progress bars based on availability data from API
function updateServiceProgressBars(servicesData) {
    if (!servicesData || !Array.isArray(servicesData)) return;

    // Build a lookup of operational service closed status
    const closedLookup = {};
    servicesData.forEach(s => { closedLookup[s.serviceID] = !!s.isClosed; });

    // Update serviceAvailability per category: available if any child (or self) is not closed
    serviceCategories.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
            serviceAvailability[cat.ServiceID] = cat.children.some(
                child => closedLookup[child.ServiceID] === false
            );
        } else {
            serviceAvailability[cat.ServiceID] = closedLookup[cat.ServiceID] === false;
        }
    });

    // Initialize all service containers first (optional - for services not in API response)
    Object.values(serviceMapping).forEach(mapping => {
        const container = document.getElementById(mapping.containerId);
        if (container) {
            const countSpan = container.querySelector('.service-count');
            const progressBar = container.querySelector('.progress-bar');
            const standbyBadge = container.querySelector('.standby-badge');
            if (countSpan) countSpan.textContent = '0/0';
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            if (standbyBadge) standbyBadge.classList.add('d-none');
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
        const standbyBadge = container.querySelector('.standby-badge');

        const maxCapacity = service.maxCapacity || 0;
        const currentAssigned = service.currentAssigned || 0;
        const standbyCount = service.standbyCount || 0;
        const standbyLimit = service.standbyLimit || 0;

        // Calculate percentage (avoid division by zero)
        const percentage = maxCapacity > 0 ? Math.round((currentAssigned / maxCapacity) * 100) : 0;

        // Update display text — show actual assigned / max capacity
        if (countSpan) {
            countSpan.textContent = `${currentAssigned}/${maxCapacity}`;
            // If over capacity, tint the count badge with the standby palette
            if (currentAssigned > maxCapacity) {
                countSpan.style.backgroundColor = '#FFF3CD';
                countSpan.style.color = '#7A5A00';
                countSpan.style.border = '1px solid #FFDA6A';
            } else {
                countSpan.style.backgroundColor = '#e9ecef';
                countSpan.style.color = '#495057';
                countSpan.style.border = 'none';
            }
        }

        // Update standby badge
        if (standbyBadge) {
            if (standbyCount > 0) {
                standbyBadge.classList.remove('d-none');
                standbyBadge.textContent = `${standbyCount} standby`;
                // Red tint when standby limit is exceeded
                if (standbyLimit > 0 && standbyCount >= standbyLimit) {
                    standbyBadge.style.backgroundColor = '#dc3545';
                    standbyBadge.style.color = '#fff';
                    standbyBadge.style.borderColor = '#dc3545';
                } else {
                    standbyBadge.style.backgroundColor = '#FFF3CD';
                    standbyBadge.style.color = '#7A5A00';
                    standbyBadge.style.borderColor = '#FFDA6A';
                }
            } else {
                standbyBadge.classList.add('d-none');
            }
        }

        // Update progress bar width and color based on capacity
        if (progressBar) {
            progressBar.style.width = Math.min(percentage, 100) + '%';

            // Remove all color classes
            progressBar.classList.remove('bg-success', 'bg-standby', 'bg-danger');

            // Add color based on percentage
            if (percentage > 100) {
                progressBar.classList.add('bg-danger');    // Red: over capacity (standby)
            } else if (percentage <= 50) {
                progressBar.classList.add('bg-success');   // Green: under 50%
            } else if (percentage < 80) {
                progressBar.classList.add('bg-standby');   // Standby tone: 50-80%
            } else {
                progressBar.classList.add('bg-danger');    // Red: 80%+
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

async function showQrBadgeModal(services, isInterpreterNeeded, isFastTracked = false) {
    const qrModal = document.getElementById('qrCodeModal');
    const printBtn = document.getElementById('printQrBtn');
    printBtn.disabled = true;
    qrModal.classList.remove('d-none');
    qrModal.classList.add('d-flex');

    const nameParts = currentClientName.split(' ');
    const firstName = nameParts[0].toUpperCase();
    const lastName = nameParts.slice(1).join(' ');

    const firstNameEl = document.getElementById('qrCardFirstName');
    const lastNameEl = document.getElementById('qrCardLastName');

    function scaledName(name, maxSize, minSize) {
        const len = name.length;
        if (len <= 6) return { text: name, size: maxSize };
        if (len <= 8) return { text: name, size: maxSize * 0.85 };
        if (len <= 10) return { text: name, size: maxSize * 0.70 };
        if (len <= 12) return { text: name, size: maxSize * 0.58 };
        if (len <= 14) return { text: name, size: maxSize * 0.50 };
        if (len <= 18) return { text: name, size: maxSize * 0.42 };
        return { text: name, size: minSize };
    }

    const first = scaledName(firstName, 2.5, 1.1);
    const last = scaledName(lastName, 1.5, 0.8);

    firstNameEl.innerText = first.text;
    firstNameEl.style.fontSize = first.size + 'rem';

    lastNameEl.innerText = last.text;
    lastNameEl.style.fontSize = last.size + 'rem';

    new QRious({
        element: document.getElementById('qr'),
        value: currentClientId,
        size: 200,
    });

    const iconLookup = {};
    serviceCategories.forEach(cat => {
        iconLookup[cat.ServiceID] = cat.IconTag || 'bi-circle';
        if (cat.children) {
            cat.children.forEach(child => {
                iconLookup[child.ServiceID] = child.IconTag || cat.IconTag || 'bi-circle';
            });
        }
    });

    const qrIconsContainer = document.getElementById('qrCardIcons');
    buildQrIconSlots(qrIconsContainer, services, iconLookup);

    await loadServiceHierarchyForDashboard();

    document.getElementById('qrCardTranslator').style.display = isInterpreterNeeded ? 'block' : 'none';

    const ftBadge = document.getElementById('qrCardFastTrack');
    if (ftBadge) {
        ftBadge.style.display = isFastTracked ? 'block' : 'none';
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => { printBtn.disabled = false; });
    });
}

// Creates the HTML for a service button based on the service type, current state, and availability. 
//State can be 1 (selected), 0 (not selected), or -1 (locked/unavailable).
function buildServiceButton(serviceType, state, iconClass, serviceKey, forceDisabled = false) {
    let colorClass = '';
    let iconColor = '';
    let disabledAttr = '';
    let lockedClass = '';
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

    if (forceDisabled) {
        disabledAttr = 'disabled';
        lockedClass = ' locked-btn';
    }

    return `
        <button class="btn ${colorClass}${lockedClass} btn-sm rounded-2 service-btn" 
                data-state="${state}" ${disabledAttr} title="${serviceType}" 
                style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
            ${renderIcon(iconClass, iconColor)}
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
    selectedPasswordUserPhone.innerText = 'Phone: -';
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
        const phoneRaw = user.Phone || '';
        const emailDisplay = emailRaw
            ? escapeHtml(emailRaw)
            : '<span class="text-muted fst-italic">No account</span>';
        return `
            <tr class="select-password-user-row" style="cursor: pointer;"
                data-client-id="${escapeHtml(user.ClientID)}"
                data-name="${fullName}"
                data-dob="${escapeHtml(dob)}"
                data-email="${escapeHtml(emailRaw)}"
                data-phone="${escapeHtml(phoneRaw)}">
                <td class="fw-semibold text-dark">${fullName}</td>
                <td class="text-secondary">${dob}</td>
                <td class="text-secondary">${emailDisplay}</td>
                <td>
                    <button type="button" class="btn btn-sm bg-primary text-white select-password-user-btn"
                        data-client-id="${escapeHtml(user.ClientID)}"
                        data-name="${fullName}"
                        data-dob="${escapeHtml(dob)}"
                        data-email="${escapeHtml(emailRaw)}"
                        data-phone="${escapeHtml(phoneRaw)}">
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
        email: sourceEl.getAttribute('data-email'),
        phone: sourceEl.getAttribute('data-phone')
    };

    const selectedEmail = selectedPasswordUser.email || '-';
    const selectedPhone = selectedPasswordUser.phone || '-';

    selectedPasswordUserName.innerText = selectedPasswordUser.name;
    selectedPasswordUserDob.innerText = `DOB: ${selectedPasswordUser.dob}`;
    selectedPasswordUserEmail.innerText = `Email: ${selectedEmail}`;
    selectedPasswordUserPhone.innerText = `Phone: ${selectedPhone}`;
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
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading...</td></tr>';

    const status = currentTab === 'checked-in' ? 'CheckedIn' : 'Registered';

    return fetch(`../api/registration-dashboard.php?RegistrationStatus=${status}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const clients = (data.data || []).filter(item => item.ClientID);
                if (currentTab === 'checked-in') {
                    populateCheckedInTable(clients);
                } else {
                    populateRegistrationTable(clients);
                    updateStats('registration', clients.length);
                }
            } else {
                tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients found.</td></tr>';
            }
            // Only update processed count when fetching the registration queue
            // (checked-in tab re-fetches return a different context and should not overwrite it)
            if (currentTab !== 'checked-in' && statCompCount && data.clientsProcessed !== undefined) {
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

        // Build service buttons dynamically from serviceCategories
        const serviceSet = new Set(patient.services || []);
        let serviceButtonsHTML = '';
        serviceCategories.forEach(cat => {
            const state = serviceSet.has(cat.ServiceID) ? 1 : 0;
            serviceButtonsHTML += buildServiceButton(cat.ServiceName, state, cat.IconTag || 'bi-circle', cat.ServiceID);
        });

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
                            ${serviceButtonsHTML}
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

// ── Checked-In Table ────────────────────────────────────────
// Renders the checked-in table with service icons and Reprint/Edit buttons.
function populateCheckedInTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No checked-in patients yet.</td></tr>';
        return;
    }

    // Build lookup: child service ID → parent category ID
    const childToCategory = {};
    serviceCategories.forEach(cat => {
        childToCategory[cat.ServiceID] = cat.ServiceID; // standalone
        if (cat.children) {
            cat.children.forEach(child => {
                childToCategory[child.ServiceID] = cat.ServiceID;
            });
        }
    });

    // Sort by Last Name, then First Name
    patientsData.sort((a, b) => {
        const lastCmp = (a.LastName || '').localeCompare(b.LastName || '', undefined, { sensitivity: 'base' });
        return lastCmp !== 0 ? lastCmp : (a.FirstName || '').localeCompare(b.FirstName || '', undefined, { sensitivity: 'base' });
    });

    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const isAbandoned = Number(patient.IsAbandoned || 0) === 1;
        const inProgressServicesEncoded = encodeURIComponent(JSON.stringify(patient.inProgressServices || []));

        // Determine which parent categories are active for this client
        const activeCategoryIDs = new Set();
        (patient.services || []).forEach(svcID => {
            const catID = childToCategory[svcID];
            if (catID) activeCategoryIDs.add(catID);
        });

        // Build service icon buttons (interactive — same as registration)
        let serviceButtonsHTML = '';
        serviceCategories.forEach(cat => {
            const state = activeCategoryIDs.has(cat.ServiceID) ? 1 : 0;
            serviceButtonsHTML += buildServiceButton(
                cat.ServiceName,
                state,
                cat.IconTag || 'bi-circle',
                cat.ServiceID,
                isAbandoned
            );
        });

        const translatorBadge = patient.TranslatorNeeded == 1
            ? '<i class="bi bi-chat-dots text-muted ms-2" title="Needs translator" style="font-size: 1rem;"></i>'
            : '';
        const abandonedBadge = isAbandoned
            ? '<span class="badge rounded-pill text-bg-danger">Abandoned</span>'
            : '';
        const reprintDisabledAttr = isAbandoned ? 'disabled' : '';
        const reprintBtnClass = isAbandoned ? 'btn btn-sm btn-outline-secondary btn-reprint-qr' : 'btn btn-sm btn-outline-primary btn-reprint-qr';
        const reprintTitle = isAbandoned
            ? 'Abandoned clients cannot be reprinted or checked in again.'
            : 'Reprint QR Badge';
        const rowClass = isAbandoned ? 'align-middle registration-row-abandoned' : 'align-middle';

        const rowHTML = `
        <tr class="${rowClass}" data-client-id="${patient.ClientID}"
            data-first-name="${patient.FirstName}"
            data-last-name="${patient.LastName}"
            data-services='${JSON.stringify(patient.services || [])}'
            data-has-in-progress="${patient.hasInProgress ? 1 : 0}"
            data-in-progress-services="${inProgressServicesEncoded}"
            data-is-abandoned="${isAbandoned ? 1 : 0}"
            data-translator="${patient.TranslatorNeeded || 0}">
            <td class="ps-4">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width: 40px; height: 40px;">
                        <i class="bi bi-person-circle" style="font-size: 1.5rem"></i>
                    </div>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <span class="fw-bold text-dark">${fullName}${translatorBadge}</span>
                        ${abandonedBadge}
                    </div>
                </div>
            </td>
            <td class="fw-medium text-secondary">${formatDOB(patient.DOB)}</td>
            <td>
                <div class="d-flex justify-content-between align-items-center pe-3">
                    <div class="d-flex gap-3">
                        ${serviceButtonsHTML}
                    </div>
                    <div class="d-flex gap-2">
                        <button class="${reprintBtnClass}" title="${reprintTitle}" ${reprintDisabledAttr}>
                            <i class="bi bi-printer"></i>
                        </button>
                    </div>
                </div>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });

    // Attach reprint handlers
    tableBody.querySelectorAll('.btn-reprint-qr').forEach(btn => {
        btn.addEventListener('click', handleReprintQR);
    });

    // Re-apply search
    if (searchInput.value.trim()) {
        applySearch();
    }
}

// ── Reprint / Re-Check-In ───────────────────────────────────
// Opens the same check-in modal as registration so the user can
// adjust services, pick sub-services, set translator, and re-check-in.
function handleReprintQR(e) {
    const row = e.target.closest('tr');
    if (!row) return;

    if (row.dataset.isAbandoned === '1') {
        Swal.fire({
            icon: 'warning',
            title: 'Client Is Abandoned',
            text: 'Abandoned clients cannot have services changed or be checked in again.',
            confirmButtonColor: '#174593'
        });
        return;
    }

    const hasInProgress = row.dataset.hasInProgress === '1';
    let inProgressServices = [];
    try {
        inProgressServices = JSON.parse(decodeURIComponent(row.dataset.inProgressServices || '[]'));
    } catch (_) {
        inProgressServices = [];
    }

    if (hasInProgress) {
        const serviceText = inProgressServices.length > 0 ? inProgressServices.join(', ') : 'an active service';
        Swal.fire({
            icon: 'warning',
            title: 'Client Is Currently In Service',
            html: `This client is currently in progress at <strong>${escapeHtml(serviceText)}</strong>.<br><br>To avoid queue mistakes, reprint and service edits are disabled until that service is completed.`,
            confirmButtonColor: '#174593'
        });
        return;
    }

    currentRowToUpdate = row;
    currentClientId = row.dataset.clientId;
    currentClientName = row.querySelector('.fw-bold.text-dark').innerText;
    checkInModalMode = 'reprint';

    // --- Build sub-service sections dynamically (same as registration check-in) ---
    const subSvcContainer = document.getElementById('modalSubServiceSections');
    subSvcContainer.innerHTML = '';

    const categoryDescriptions = {
        'medical': 'Choose Exam if this is the patient\'s first time, Follow Up if they\'ve been here before.',
        'dental': 'Extraction is surgical pulling of teeth, Hygiene is everything else.'
    };

    // Parse existing operational service IDs so we can pre-select radio buttons
    let existingServices = [];
    try { existingServices = JSON.parse(row.dataset.services || '[]'); } catch (_) {}
    originalCheckedInServices = normalizeServiceIds(existingServices);
    originalTranslatorNeeded = row.dataset.translator === '1';
    const existingSet = new Set(existingServices);

    serviceCategories.forEach(cat => {
        const btn = row.querySelector(`[title="${cat.ServiceName}"]`);
        if (!btn) return;
        const state = parseInt(btn.getAttribute('data-state'));
        const isAvailable = serviceAvailability[cat.ServiceID];

        if (state === 1 && isAvailable && cat.children && cat.children.length > 0) {
            const radioName = `${cat.ServiceID}Choice`;
            let radiosHTML = cat.children.map(child => {
                let shortLabel = child.ServiceName;
                if (shortLabel.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                    shortLabel = shortLabel.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                }
                const checked = existingSet.has(child.ServiceID) ? 'checked' : '';
                return `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="${radioName}" 
                        id="${child.ServiceID}" value="${child.ServiceID}" ${checked}>
                    <label class="form-check-label text-dark" for="${child.ServiceID}">${shortLabel || child.ServiceName}</label>
                </div>`;
            }).join('');

            const descHTML = categoryDescriptions[cat.ServiceID]
                ? `<p class="text-muted small mb-2">${categoryDescriptions[cat.ServiceID]}</p>`
                : '';

            subSvcContainer.innerHTML += `
                <div class="mb-4 p-3 border rounded bg-light sub-service-section" data-category="${cat.ServiceID}">
                    <label class="fw-bold mb-2 text-primary">Select ${cat.ServiceName} Service:</label>
                    ${descHTML}
                    <div class="d-flex gap-4">${radiosHTML}</div>
                </div>`;
        }
    });

    // Pre-fill translator checkbox
    const translatorNeeded = row.dataset.translator;
    document.getElementById('translatorCheck').checked = (translatorNeeded === '1');

    document.getElementById('modalPatientName').innerText = currentClientName;

    const modal = document.getElementById('checkInModal');
    modal.classList.remove('d-none');
    modal.classList.add('d-flex');
}

//================================================================================
// 6. TABLE EVENT LISTENERS (Service Toggles & Check-In)

// Using event delegation to handle clicks on service buttons and check-in buttons within the table body
tableBody.addEventListener('click', function (event) {

    const serviceBtn = event.target.closest('.service-btn');
    if (serviceBtn) {
        const row = serviceBtn.closest('tr');
        if (row && row.dataset.isAbandoned === '1') {
            return;
        }
        if (serviceBtn.hasAttribute('disabled') || serviceBtn.classList.contains('locked-btn')) return;

        // Toggle service state between 1 (selected) and 0 (not selected)
        let currentState = parseInt(serviceBtn.getAttribute('data-state'));
        const icon = serviceBtn.querySelector('i, .svg-icon');

        // If the service is currently selected, deselect it. If it's not selected, select it. Update button styles accordingly.
        if (currentState === 1) {
            serviceBtn.setAttribute('data-state', '0');
            serviceBtn.classList.replace('btn-success', 'btn-grey');
            if (icon) icon.classList.remove('text-white');
        } else if (currentState === 0) {
            serviceBtn.setAttribute('data-state', '1');
            serviceBtn.classList.replace('btn-grey', 'btn-success');
            if (icon) icon.classList.add('text-white');
        }
        return;
    }

    // If a check-in button was clicked, open the check-in modal and populate it with the patient's info and requested services
    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        currentRowToUpdate = checkInBtn.closest('tr');
        currentClientName = currentRowToUpdate.querySelector('.fw-bold.text-dark').innerText;
        currentClientId = currentRowToUpdate.getAttribute('data-client-id');
        checkInModalMode = 'registration';
        originalCheckedInServices = [];
        originalTranslatorNeeded = false;

        // --- Build sub-service sections dynamically ---
        const subSvcContainer = document.getElementById('modalSubServiceSections');
        subSvcContainer.innerHTML = '';

        // Help text shown below the label in the check-in modal for categories with sub-services
        const categoryDescriptions = {
            'medical': 'Choose Exam if this is the patient\'s first time, Follow Up if they\'ve been here before.',
            'dental': 'Extraction is surgical pulling of teeth, Hygiene is everything else.'
        };

        serviceCategories.forEach(cat => {
            const btn = currentRowToUpdate.querySelector(`[title="${cat.ServiceName}"]`);
            if (!btn) return;
            const state = parseInt(btn.getAttribute('data-state'));
            const isAvailable = serviceAvailability[cat.ServiceID];

            if (state === 1 && isAvailable && cat.children && cat.children.length > 0) {
                // Build radio group for sub-services with short labels (strip parent name prefix)
                const radioName = `${cat.ServiceID}Choice`;
                let radiosHTML = cat.children.map(child => {
                    let shortLabel = child.ServiceName;
                    if (shortLabel.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                        shortLabel = shortLabel.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                    }
                    return `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${radioName}" 
                            id="${child.ServiceID}" value="${child.ServiceID}">
                        <label class="form-check-label text-dark" for="${child.ServiceID}">${shortLabel || child.ServiceName}</label>
                    </div>`;
                }).join('');

                const descHTML = categoryDescriptions[cat.ServiceID]
                    ? `<p class="text-muted small mb-2">${categoryDescriptions[cat.ServiceID]}</p>`
                    : '';

                subSvcContainer.innerHTML += `
                    <div class="mb-4 p-3 border rounded bg-light sub-service-section" data-category="${cat.ServiceID}">
                        <label class="fw-bold mb-2 text-primary">Select ${cat.ServiceName} Service:</label>
                        ${descHTML}
                        <div class="d-flex gap-4">${radiosHTML}</div>
                    </div>`;
            }
        });

        // Auto-toggle translator checkbox if client was flagged as needing one (e.g. registered in Spanish)
        const translatorNeeded = currentRowToUpdate.getAttribute('data-translator');
        document.getElementById('translatorCheck').checked = (translatorNeeded === '1');

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

document.getElementById('finalizeCheckInBtn').addEventListener('click', async function () {
    const btn = this;

    if (currentRowToUpdate && currentRowToUpdate.dataset.isAbandoned === '1') {
        Swal.fire({
            icon: 'warning',
            title: 'Client Is Abandoned',
            text: 'Abandoned clients cannot have services changed or be checked in again.',
            confirmButtonColor: '#174593'
        });
        return;
    }

    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;

    // Build services array dynamically from category buttons and sub-service selections
    const services = [];
    const categoryStates = {}; // track which categories are selected for QR card

    for (const cat of serviceCategories) {
        const catBtn = currentRowToUpdate.querySelector(`[title="${cat.ServiceName}"]`);
        if (!catBtn) continue;
        const state = parseInt(catBtn.getAttribute('data-state'));
        categoryStates[cat.ServiceID] = (state === 1);

        if (state !== 1) continue;

        if (cat.children && cat.children.length > 0) {
            // Category has sub-services — require radio selection
            const radioName = `${cat.ServiceID}Choice`;
            const selected = document.querySelector(`input[name="${radioName}"]:checked`);
            if (!selected) {
                Swal.fire({
                    icon: 'error',
                    title: 'Selection Required',
                    text: `Please select a ${cat.ServiceName} sub-service to proceed.`,
                    confirmButtonColor: '#174593'
                });
                return;
            }
            services.push(selected.value);
        } else {
            // Standalone category (no children) — use category ID directly
            services.push(cat.ServiceID);
        }
    }

    if (services.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No Services Selected',
            text: 'Please keep at least one service selected before continuing.',
            confirmButtonColor: '#174593'
        });
        return;
    }

    const isReprintFlow = checkInModalMode === 'reprint';
    const selectedNormalized = normalizeServiceIds(services);
    const originalNormalized = normalizeServiceIds(originalCheckedInServices);
    const hasServiceChanges = !areServiceSelectionsEqual(selectedNormalized, originalNormalized);
    const hasTranslatorChange = isInterpreterNeeded !== originalTranslatorNeeded;

    if (isReprintFlow && !hasServiceChanges && !hasTranslatorChange) {
        closeModalAnimated();
        await showQrBadgeModal(services, isInterpreterNeeded, false);
        return;
    }

    if (isReprintFlow && (hasServiceChanges || hasTranslatorChange)) {
        const reprintChangeConfirm = await Swal.fire({
            icon: 'warning',
            title: 'Update Services And Reprint?',
            html: 'This will update the client\'s active check-in services and print a new badge.<br><br>If they are currently being served, this action will be blocked.',
            showCancelButton: true,
            confirmButtonText: 'Update and Reprint',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#174593'
        });

        if (!reprintChangeConfirm.isConfirmed) {
            return;
        }
    }

    // ── Warning: Dental selected without Medical ─────────────────────
    const dentalCat = serviceCategories.find(c => c.ServiceName.toLowerCase().includes('dental'));
    const medicalCat = serviceCategories.find(c => c.ServiceName.toLowerCase().includes('medical'));
    if (dentalCat && medicalCat && categoryStates[dentalCat.ServiceID] && !categoryStates[medicalCat.ServiceID]) {
        const result = await Swal.fire({
            icon: 'error',
            title: 'No Medical Selected',
            html: 'This client has <strong>Dental</strong> selected without a <strong>Medical</strong> service. Please confirm they have permission to receive Dental only.',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Continue',
            denyButtonText: 'Add Medical',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#174593',
            denyButtonColor: '#198754'
        });
        if (result.isDenied) {
            // Auto-select the medical button in the row
            const medBtn = currentRowToUpdate.querySelector(`[title="${medicalCat.ServiceName}"]`);
            if (medBtn && parseInt(medBtn.getAttribute('data-state')) === 0) {
                medBtn.setAttribute('data-state', '1');
                medBtn.classList.replace('btn-grey', 'btn-success');
                const medIcon = medBtn.querySelector('i, .svg-icon');
                if (medIcon) medIcon.classList.add('text-white');
            }
            // Inject the medical sub-service section into the modal if not already present
            const subSvcContainer = document.getElementById('modalSubServiceSections');
            const alreadyShown = subSvcContainer.querySelector(`[data-category="${medicalCat.ServiceID}"]`);
            if (!alreadyShown && medicalCat.children && medicalCat.children.length > 0) {
                const radioName = `${medicalCat.ServiceID}Choice`;
                let radiosHTML = medicalCat.children.map(child => {
                    let shortLabel = child.ServiceName;
                    if (shortLabel.toLowerCase().startsWith(medicalCat.ServiceName.toLowerCase())) {
                        shortLabel = shortLabel.substring(medicalCat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                    }
                    return `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${radioName}"
                            id="${child.ServiceID}" value="${child.ServiceID}">
                        <label class="form-check-label text-dark" for="${child.ServiceID}">${shortLabel || child.ServiceName}</label>
                    </div>`;
                }).join('');
                const newSection = document.createElement('div');
                newSection.className = 'mb-4 p-3 border rounded bg-light sub-service-section';
                newSection.dataset.category = medicalCat.ServiceID;
                newSection.innerHTML = `
                    <label class="fw-bold mb-2 text-primary">Select ${medicalCat.ServiceName} Service:</label>
                    <p class="text-muted small mb-2">Choose Exam if this is the patient's first time, Follow Up if they've been here before.</p>
                    <div class="d-flex gap-4">${radiosHTML}</div>`;
                subSvcContainer.insertBefore(newSection, subSvcContainer.firstChild);
            }
            return;
        }
        if (!result.isConfirmed) return;
    }

    // ── Warning: Dental + Optical both selected ─────────────────
    const opticalCat = serviceCategories.find(c => c.ServiceName.toLowerCase().includes('optical'));
    if (dentalCat && opticalCat && categoryStates[dentalCat.ServiceID] && categoryStates[opticalCat.ServiceID]) {
        const result = await Swal.fire({
            icon: 'error',
            title: 'Dental & Optical Selected',
            html: 'This client has both <strong>Dental</strong> and <strong>Optical</strong> selected. Please confirm they have permission to receive both services.',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Continue',
            denyButtonText: 'Remove Optical',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#174593',
            denyButtonColor: '#dc3545'
        });
        if (result.isDenied) {
            // Deselect the optical button in the modal
            const optBtn = currentRowToUpdate.querySelector(`[title="${opticalCat.ServiceName}"]`);
            if (optBtn) {
                optBtn.setAttribute('data-state', '0');
                optBtn.classList.replace('btn-success', 'btn-grey');
                const optIcon = optBtn.querySelector('i, .svg-icon');
                if (optIcon) optIcon.classList.remove('text-white');
            }
            // Remove optical sub-service section from modal
            const subSvcContainer = document.getElementById('modalSubServiceSections');
            const opticalSection = subSvcContainer.querySelector(`[data-category="${opticalCat.ServiceID}"]`);
            if (opticalSection) opticalSection.remove();
            // Clear the category state so the next check-in attempt skips this warning
            categoryStates[opticalCat.ServiceID] = 0;
            return;
        }
        if (!result.isConfirmed) return;
    }

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
        .then(async data => {
            if (data.success) {

                // Close check-in modal
                closeModalAnimated();

                // Only alert if the standby list is now full
                const isStandbyFull = data.standbyFull && data.standbyFull.length > 0;
                if (isStandbyFull) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Standby Full',
                        text: 'The standby list is now full for one or more services.',
                        confirmButtonColor: '#174593',
                        timer: 5000,
                        timerProgressBar: true
                    });
                }

                // Remove patient from queue table (registration tab) or refresh (checked-in tab)
                if (currentTab === 'checked-in') {
                    // Re-fetch the checked-in list so the row updates with new services
                    fetchRegistrationQueue();
                } else if (currentRowToUpdate) {
                    currentRowToUpdate.remove();
                }

                // Update Stats (only when coming from registration tab)
                if (currentTab !== 'checked-in') {
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
                }

                // Refresh service progress bars with latest counts
                refreshServiceStats();
                await showQrBadgeModal(services, isInterpreterNeeded, !!data.isFastTracked);

            } else {
                // Check-in failed logic
                closeQrModal();
                console.error('Check-in failed:', data.message);
                const blockedByInProgress = /currently being served|cannot be checked in again/i.test(data.message || '');
                Swal.fire({
                    icon: blockedByInProgress ? 'warning' : 'error',
                    title: blockedByInProgress ? 'Client Is Currently In Service' : 'Check-In Failed',
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
                font-size: 2rem !important;
                width: 46px !important;
                height: 46px !important;
                border: 2px solid black !important;
                border-radius: 8px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: #fff !important;
            }

            #qrCodeModal .qr-icon-border.qr-icon-empty {
                border: 2px dashed #c0c0c0 !important;
                background: #f5f5f5 !important;
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
// 8. PRINT VOLUNTEER BADGE

// When the "Print Volunteer Badge" button is clicked, prompt for a volunteer name, apply print-specific styles so only the volunteer label is printed, then trigger print dialog.

// Sweet Alert Popups
document.getElementById('printVolunteerBadgeBtn').addEventListener('click', async function () {
    const toTitleCase = (value) => String(value || '')
        .toLowerCase()
        .replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase());

    let trimmedName = '';
    while (true) {
        const result = await Swal.fire({
            title: 'Print Volunteer Badge',
            input: 'text',
            inputLabel: 'Volunteer name',
            inputPlaceholder: 'Enter first and last name',
            inputAttributes: {
                maxlength: '16',
                'aria-label': 'Volunteer name input (max 16 characters)'
            },
            footer: '<span aria-live="polite">Max limit of 16 characters</span>',
            showCancelButton: true,
            confirmButtonText: 'Prepare Badge',
            confirmButtonColor: '#174593',
            cancelButtonText: 'Cancel'
        });

        // Swap between input prompt and error messages until we get a valid name

        if (!result.isConfirmed) return;

        trimmedName = toTitleCase((result.value || '').trim());
        if (!trimmedName) {
            await Swal.fire({
                icon: 'error',
                title: 'Name Required',
                text: 'Please enter a volunteer name.',
                confirmButtonColor: '#174593'
            });
            continue;
        }
        break;
    }

    // Changes font size depending on length of name.

    const getVolunteerNameFontSize = (name) => {
        const length = (name || '').trim().length;
        if (length <= 8)  return 48;
        if (length <= 11) return 42;
        if (length <= 14) return 36;
        return 30;
    };

    // Fits name on the label.

    const labelName = document.getElementById('volunteerLabelName');
    if (!labelName) return;
    labelName.textContent = trimmedName;
    labelName.style.fontSize = `${getVolunteerNameFontSize(trimmedName)}px`;

    const style = document.createElement('style');
    style.textContent = `
            @media print {
                @page {
                    /* DYMO LabelWriter 450 - 30857 Badge label */
                    size: 4in 2.125in;
                    margin: 0;
                }

                /* LOCK the document height so hidden dashboard content doesn't create blank pages */
                html, body {
                    width: 4in !important;
                    height: 2.125in !important;
                    min-height: 2.125in !important;
                    max-height: 2.125in !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                }

                body > *:not(#volunteerPrintLabel) {
                    display: none !important;
                }

                #volunteerPrintLabel, #volunteerPrintLabel * {
                    visibility: visible;
                }

                #volunteerPrintLabel {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 4in !important;
                    height: 2.125in !important;
                    padding: 0.12in !important;
                    display: block !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                    background: white !important;
                }

                #volunteerPrintLabel .volunteer-label-shell {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                    border-radius: 0 !important;
                    display: flex !important;
                    align-items: flex-start !important;
                    justify-content: flex-start !important;
                    position: relative !important;
                    padding: 0.12in 0.16in !important;
                    gap: 0.12in !important;
                    box-sizing: border-box !important;
                }

                #volunteerPrintLabel .volunteer-label-content {
                    min-width: 0 !important;
                    flex: 1 1 auto !important;
                    padding-top: 0.18in !important;
                    padding-right: 1.1in !important;
                }

                #volunteerPrintLabel .volunteer-name {
                    color: #111 !important;
                    line-height: 1 !important;
                    font-weight: 800 !important;
                    white-space: nowrap !important;
                    overflow: visible !important;
                    text-overflow: clip !important;
                    width: 100% !important;
                }

                #volunteerPrintLabel .volunteer-role {
                    margin-top: 0.08in !important;
                    color: #333 !important;
                    font-size: 22px !important;
                    font-weight: 700 !important;
                    letter-spacing: 0.02em !important;
                    text-transform: uppercase !important;
                }

                #volunteerPrintLabel .volunteer-label-logo {
                    width: 1.0in !important;
                    height: auto !important;
                    object-fit: contain !important;
                    flex: 0 0 auto !important;
                    position: absolute !important;
                    bottom: 0.06in !important;
                    right: 0.06in !important;
                    clip-path: inset(0 14% 0 0) !important;
                }
            }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
        document.head.removeChild(style);
    }, 100);
});

//================================================================================
// 9. INITIALIZATION
(async () => {
    await loadServiceHierarchyForDashboard();
    buildServiceProgressBars();
    fetchRegistrationQueue();

    const refreshQueueBtn = document.getElementById('refreshQueueBtn');
    if (refreshQueueBtn) {
        refreshQueueBtn.addEventListener('click', () => spinRefreshBtn(refreshQueueBtn, fetchRegistrationQueue()));
    }
})();