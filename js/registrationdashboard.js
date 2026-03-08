/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  Feb 28 @ 12:12 PM
 * Changes Made:      Removed automatic refresh
 * ============================================================
*/

// 1. GLOBAL SETTINGS & STATE

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

        serviceCategories = json.hierarchy;
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
                if (child) { iconTag = cat.IconTag || ''; break; }
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
                <span class="badge fw-bold service-count" style="font-size: 0.8rem; background-color: #e9ecef; color: #495057 !important;">0/0</span>
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

// Active check-in state
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;

// Search elements
const searchInput = document.getElementById('registrationSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const noSearchResults = document.getElementById('noSearchResults');
const noSearchTerm = document.getElementById('noSearchTerm');

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

//formats "YYYY-MM-DD" to "MM/DD/YYYY", returns "N/A" if input is empty or null
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
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
            if (countSpan) countSpan.textContent = '0/0';
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
            countSpan.textContent = `${currentAssigned}/${maxCapacity}`;
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
            ${renderIcon(iconClass, iconColor)}
        </button>
    `;
}

// Filters the visible table rows based on the current search query.
// Rows whose name contains the query (case-insensitive) are shown; others are hidden.
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
// 4. DATA FETCHING & TABLE RENDERING

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

//================================================================================
// 5. TABLE EVENT LISTENERS (Service Toggles & Check-In)

// Using event delegation to handle clicks on service buttons and check-in buttons within the table body
tableBody.addEventListener('click', function (event) {

    const serviceBtn = event.target.closest('.service-btn');
    if (serviceBtn) {
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
// 6. CHECK-IN MODAL SUBMISSION

// When the "Finalize Check-In" button is clicked, gather the selected services and interpreter need, send the data to the API, 
// and show the QR code modal with the generated QR code and service icons. Also handles loading state and error messages.
document.getElementById('cancelCheckInBtn').addEventListener('click', () => {
    closeModalAnimated();
});

document.getElementById('finalizeCheckInBtn').addEventListener('click', function () {
    const btn = this;
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
                    icon: 'warning',
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

                // Refresh service progress bars with latest counts
                refreshServiceStats();

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
                    if (len <= 6) return { text: name, size: maxSize };
                    if (len <= 8) return { text: name, size: maxSize * 0.85 };
                    if (len <= 10) return { text: name, size: maxSize * 0.70 };
                    if (len <= 12) return { text: name, size: maxSize * 0.58 };
                    if (len <= 14) return { text: name, size: maxSize * 0.50 };
                    // Beyond 14 chars: truncate and use minimum size
                    return { text: name.slice(0, 14) + '…', size: minSize };
                }

                const first = scaledName(firstName, 2.5, 1.1);
                const last = scaledName(lastName, 1.5, 0.8);

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

                // Re-fetch service hierarchy to pick up any icon changes made in admin
                await loadServiceHierarchyForDashboard();

                // Build QR card icons from the actual selected services (not parent categories)
                // Build a lookup of all service IDs → IconTag (categories + children)
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
                qrIconsContainer.innerHTML = '';
                services.forEach(svcID => {
                    const wrapper = document.createElement('span');
                    wrapper.className = 'qr-icon-border';
                    wrapper.style.fontSize = '2.5rem';
                    wrapper.style.color = 'black';
                    wrapper.style.display = 'inline-flex';
                    wrapper.innerHTML = renderIcon(iconLookup[svcID] || 'bi-circle');
                    qrIconsContainer.appendChild(wrapper);
                });
                document.getElementById('qrCardTranslator').style.display = 'none';

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
// 7. PRINT QR CODE

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
// 8. INITIALIZATION
(async () => {
    await loadServiceHierarchyForDashboard();
    buildServiceProgressBars();
    fetchRegistrationQueue();
})();
