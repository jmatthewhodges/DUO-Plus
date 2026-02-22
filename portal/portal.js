// ============================================================================
//  API METHODS REGISTRY
//  ──────────────────────────────────────────────────────────────────────────
//  To add a new method: copy an existing object, change the values.
//  To edit a method:    find its object below and update it.
//
//  Each entry:
//    id          – unique string identifier
//    name        – display name in sidebar
//    category    – sidebar group label
//    method      – HTTP verb (GET | POST | PUT | DELETE)
//    endpoint    – relative path from base URL (e.g. /api/login.php)
//    description – one-liner shown above the form
//    params[]    – array of parameter definitions:
//        name        – field/key name sent in request
//        type        – input type: text | password | email | number | textarea
//                      | checkbox | select | array
//        required    – bool
//        default     – pre-filled value (string | bool | array)
//        description – helper text under the label
//        options     – (for select type) array of { value, label }
//    testData    – object with sample values to auto-fill in TEST mode
// ============================================================================

const API_METHODS = [

    // ─── Authentication ───────────────────────────────────────────────────
    {
        id: 'login',
        name: 'Client Login',
        category: 'Authentication',
        method: 'POST',
        endpoint: '/api/Login.php',
        description: 'Authenticate a client with email and password. Returns full client data on success.',
        params: [
            { name: 'email', type: 'email', required: true, default: '', description: 'Client email address' },
            { name: 'password', type: 'password', required: true, default: '', description: 'Client password' }
        ],
        testData: {
            email: 'testuser@duo.org',
            password: 'password123'
        }
    },
    {
        id: 'verify-pin',
        name: 'Verify Volunteer PIN',
        category: 'Authentication',
        method: 'POST',
        endpoint: '/api/VerifyPin.php',
        description: 'Verify a 6-digit volunteer PIN code. Rate-limited (5 attempts per 15 min).',
        params: [
            { name: 'pin', type: 'text', required: true, default: '', description: '6-digit numeric PIN' },
            { name: 'name', type: 'text', required: true, default: '', description: 'Volunteer name' },
            { name: 'pageName', type: 'text', required: false, default: '', description: 'Page the PIN was entered on (for logging)' }
        ],
        testData: {
            pin: '123456',
            name: 'Jane Volunteer',
            pageName: 'registration-dashboard'
        }
    },
    {
        id: 'CreatePin',
        name: 'Create Pin',
        category: 'Authentication',
        method: 'POST',
        endpoint: '/api/CreatePin.php',
        description: 'Create a new 6-digit PIN code entry in tblPinCode.',
        params: [
            {
                name: 'PinValue',
                type: 'string',
                required: true,
                description: 'Exactly 6 numeric digits (e.g. "847291")'
            }
        ],
        testData: {
            PinValue: '123456'
        }
    },
    {
        id: 'register',
        name: 'Register',
        category: 'Authentication',
        method: 'POST',
        endpoint: '/api/Register.php',
        description: 'Create a brand-new client with personal info, address, emergency contact, and services.',
        params: [
            { name: 'firstName', type: 'text', required: true, default: '', description: 'First name' },
            { name: 'middleInitial', type: 'text', required: false, default: '', description: 'Middle initial (single letter)' },
            { name: 'lastName', type: 'text', required: true, default: '', description: 'Last name' },
            { name: 'dob', type: 'text', required: true, default: '', description: 'Date of birth (YYYY-MM-DD)' },
            { name: 'sex', type: 'select', required: true, default: 'Male', description: 'Sex', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Intersex', label: 'Intersex' }] },
            { name: 'phone', type: 'text', required: false, default: '', description: 'Phone number' },
            { name: 'email', type: 'email', required: true, default: '', description: 'Login email' },
            { name: 'password', type: 'password', required: true, default: '', description: 'Login password (will be hashed)' },
            { name: 'noAddress', type: 'checkbox', required: false, default: true, description: 'Client has no address?' },
            { name: 'address1', type: 'text', required: false, default: '', description: 'Street address line 1' },
            { name: 'address2', type: 'text', required: false, default: '', description: 'Street address line 2' },
            { name: 'city', type: 'text', required: false, default: '', description: 'City' },
            { name: 'state', type: 'text', required: false, default: '', description: 'State (2-letter code)' },
            { name: 'zipCode', type: 'text', required: false, default: '', description: 'ZIP code' },
            { name: 'noEmergencyContact', type: 'checkbox', required: false, default: true, description: 'No emergency contact?' },
            { name: 'emergencyFirstName', type: 'text', required: false, default: '', description: 'Emergency contact first name' },
            { name: 'emergencyLastName', type: 'text', required: false, default: '', description: 'Emergency contact last name' },
            { name: 'emergencyPhone', type: 'text', required: false, default: '', description: 'Emergency contact phone' },
            { name: 'EventID', type: 'text', required: true, default: '4cbde538985861b9', description: 'ID of the event attending' },
            { name: 'services', type: 'array', required: false, default: '["medical"]', description: 'JSON array of services: medical, optical, dental, haircut' }
        ],
        testData: () => {
            const pick = arr => arr[Math.floor(Math.random() * arr.length)];
            const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

            const firstNames = ['John', 'Maria', 'Carlos', 'Emily', 'James', 'Sofia', 'David', 'Ana', 'Michael', 'Rosa', 'Luis', 'Sarah', 'Daniel', 'Elena', 'Robert'];
            const lastNames = ['Smith', 'Garcia', 'Johnson', 'Martinez', 'Williams', 'Lopez', 'Brown', 'Gonzalez', 'Jones', 'Rodriguez', 'Davis', 'Hernandez', 'Miller', 'Perez'];
            const streets = ['Main St', 'Oak Ave', 'Elm Dr', 'Cedar Ln', 'Pine Rd', 'Maple Blvd', '1st St', '2nd Ave', 'Park Dr', 'Lake Rd'];
            const cities = ['Oklahoma City', 'Tulsa', 'Norman', 'Edmond', 'Broken Arrow', 'Lawton', 'Moore', 'Stillwater', 'Midwest City', 'Enid'];
            const initials = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const allServices = ['medical', 'optical', 'dental', 'haircut'];

            const first = pick(firstNames);
            const last = pick(lastNames);
            const sex = pick(['Male', 'Female']);
            const year = rand(1950, 2005);
            const month = String(rand(1, 12)).padStart(2, '0');
            const day = String(rand(1, 28)).padStart(2, '0');
            const num = rand(1000, 9999);

            // Pick 1-3 random services
            const serviceCount = rand(1, 3);
            const shuffled = [...allServices].sort(() => Math.random() - 0.5);
            const services = shuffled.slice(0, serviceCount);

            return {
                firstName: first,
                middleInitial: pick([...initials]),
                lastName: last,
                dob: `${year}-${month}-${day}`,
                sex,
                phone: `555-${rand(100, 999)}-${rand(1000, 9999)}`,
                email: `${first.toLowerCase()}.${last.toLowerCase()}${num}@test.com`,
                password: 'testpass123',
                noAddress: false,
                address1: `${rand(100, 9999)} ${pick(streets)}`,
                address2: pick(['', '', `Apt ${rand(1, 20)}${pick(['A', 'B', 'C', ''])}`]),
                city: pick(cities),
                state: 'OK',
                zipCode: String(rand(73001, 74999)),
                noEmergencyContact: false,
                emergencyFirstName: pick(firstNames),
                emergencyLastName: pick(lastNames),
                emergencyPhone: `555-${rand(100, 999)}-${rand(1000, 9999)}`,
                services: JSON.stringify(services)
            };
        }
    },

    // ─── Event ────────────────────────────────────────────────────────────
    {
        id: 'CreateEvent',
        name: 'Create Event',
        category: 'Event',
        method: 'POST',
        endpoint: '/api/CreateEvent.php',
        description: 'Create a new event.',
        params: [
            { name: 'EventDate', type: 'date', required: true, default: '', description: 'Date the event takes place' },
            { name: 'LocationName', type: 'text', required: true, default: '', description: 'Name for the location of the event' },
            { name: 'IsActive', type: 'checkbox', required: true, default: '', description: 'Active status for the event' }
        ],
        testData: {
            EventDate: '2000-01-01',
            LocationName: 'LifeChurchCookeville',
            IsActive: true,
        }
    },
    {
        id: 'AddEventService',
        name: 'Add Event Service',
        category: 'Event',
        method: 'POST',
        endpoint: '/api/AddEventService.php',
        description: 'Add a service to an event.',
        params: [
            { name: 'EventID', type: 'text', required: true, default: '', description: 'ID for the event that is getting the service' },
            { name: 'ServiceID', type: 'text', required: true, default: '', description: 'ID for the service that is getting added to the event' },
            { name: 'MaxCapacity', type: 'number', required: true, default: '', description: 'Max capacity for the service' },
            { name: 'CurrentAssigned', type: 'number', required: true, default: '', description: 'Number of clients currently assigned to this service' },
            { name: 'IsClosed', type: 'checkbox', required: true, default: '', description: 'Status for if the event is currently offering this service' }
        ],
    },

    // ─── Service ──────────────────────────────────────────────────────────
    {
        id: 'CreateService',
        name: 'Create Service',
        category: 'Service',
        method: 'POST',
        endpoint: '/api/CreateService.php',
        description: 'Create a new service.',
        params: [
            { name: 'ServiceID', type: 'text', required: true, default: '', description: 'Unique identifier for the service' },
            { name: 'ServiceName', type: 'text', required: true, default: '', description: 'Name for the service' },
            { name: 'IconTag', type: 'text', required: true, default: '', description: 'Offical icon tag for the service' }
        ],
        testData: {
            ServiceID: 'MedicalFollowUp',
            ServiceName: 'Medical - Follow Up',
            IconTag: "faUpArrow",
        }
    },

    // ─── Registration Dashboard ───────────────────────────────────────────
    {
        id: 'registration-dashboard',
        name: 'Registration Dashboard',
        category: 'Registration Dashboard',
        method: 'GET',
        endpoint: '/api/GrabQueue.php?RegistrationStatus=Registered',
        description: 'Fetch all clients currently in the "registration" queue with their services and info. No parameters required.',
        params: [],
        testData: {}
    },
    {
        id: 'check-in',
        name: 'Check-In',
        category: 'Registration Dashboard',
        method: 'POST',
        endpoint: '/api/CheckIn.php',
        description: 'Check a registered client into the waiting room and set their selected services.',
        params: [
            { name: 'clientID', type: 'text', required: true, default: '', description: 'Client UUID' },
            { name: 'services', type: 'array', required: false, default: '["medical"]', description: 'JSON array: medical, optical, dental, haircut' },
            { name: 'needsInterpreter', type: 'checkbox', required: false, default: false, description: 'Does the client need an interpreter?' }
        ],
        testData: {
            clientID: '0be5ec66ldee1ee0',
            services: '["medical", "dental"]',
            needsInterpreter: true
        }
    },

    // ─── Analytics ────────────────────────────────────────────────────────
    {
        id: 'CreateStat',
        name: 'Create Statistic',
        category: 'Analytics',
        method: 'POST',
        endpoint: '/api/CreateStat.php',
        description: 'Create a new statistic to track.',
        params: [
            { name: 'StatID', type: 'text', required: true, default: '', description: 'Unique identifier for the statistic' },
            { name: 'EventID', type: 'text', required: true, default: '', description: 'Event that statistic is getting tracked for' },
            { name: 'StatKey', type: 'text', required: true, default: '', description: 'Name of the statistic' },
            { name: 'StatValue', type: 'text', required: true, default: '', description: 'Starting value of the statistic' }
        ],
        testData: {
            StatID: 'opticalWaiting',
            EventID: '4cbde538985861b9',
            StatKey: "Optical - Waiting",
            StatValue: 0
        }
    },

    // ─── Testing ──────────────────────────────────────────────────────────
    {
        id: 'ClearClients',
        name: 'Clear Clients',
        category: 'Testing',
        method: 'POST',
        endpoint: '/api/ClearClients.php',
        description: 'Remove all current client information from the database.',
        params: [
        ],
        testData: {
        }
    },

];


// ============================================================================
//  PORTAL APP
// ============================================================================

(function () {
    'use strict';

    // DOM refs
    const methodListEl = document.getElementById('methodList');
    const searchInput = document.getElementById('sidebarSearch');
    const mainContent = document.getElementById('mainContent');
    const sidebarEl = document.getElementById('portalSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    let activeMethodId = null;
    let lastResponse = null;
    let currentMode = 'test'; // 'test' or 'manual'

    // ─── Init ─────────────────────────────────────────────────────────────
    renderSidebar();
    showWelcome();

    searchInput.addEventListener('input', () => renderSidebar(searchInput.value.trim()));

    // Mobile sidebar toggle
    sidebarToggle.addEventListener('click', () => {
        sidebarEl.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebarEl.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });

    // ─── Render Sidebar ───────────────────────────────────────────────────
    function renderSidebar(filter = '') {
        const lowerFilter = filter.toLowerCase();
        const categories = {};

        API_METHODS.forEach(m => {
            if (lowerFilter && !m.name.toLowerCase().includes(lowerFilter) && !m.category.toLowerCase().includes(lowerFilter)) return;
            if (!categories[m.category]) categories[m.category] = [];
            categories[m.category].push(m);
        });

        let html = '';
        for (const [cat, methods] of Object.entries(categories)) {
            html += `<div class="method-category">${cat}</div>`;
            methods.forEach(m => {
                html += `
                    <div class="method-item ${m.id === activeMethodId ? 'active' : ''}" data-id="${m.id}">
                        <span class="method-badge ${m.method.toLowerCase()}">${m.method}</span>
                        <span class="method-name">${m.name}</span>
                    </div>`;
            });
        }

        if (!html) {
            html = '<div style="padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">No methods match your search.</div>';
        }

        methodListEl.innerHTML = html;

        // Attach click listeners
        methodListEl.querySelectorAll('.method-item').forEach(el => {
            el.addEventListener('click', () => selectMethod(el.dataset.id));
        });
    }

    // ─── Select Method ────────────────────────────────────────────────────
    function selectMethod(id) {
        activeMethodId = id;
        const method = API_METHODS.find(m => m.id === id);
        if (!method) return;

        // Close mobile sidebar
        sidebarEl.classList.remove('open');
        sidebarOverlay.classList.remove('active');

        // Update sidebar active state
        methodListEl.querySelectorAll('.method-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });

        renderMethodDetail(method);
    }

    // ─── Render Method Detail ─────────────────────────────────────────────
    function renderMethodDetail(method) {
        const methodLower = method.method.toLowerCase();
        currentMode = 'test'; // always default to test mode

        let paramsHTML = '';
        if (method.params.length === 0) {
            paramsHTML = '<p class="no-params-msg">This endpoint requires no parameters.</p>';
        } else {
            method.params.forEach(p => {
                paramsHTML += buildParamField(p);
            });
        }

        const hasParams = method.params.length > 0;
        const modeToggleHTML = hasParams ? `
            <div class="mode-toggle">
                <button type="button" class="mode-btn active" data-mode="test"><i class="bi bi-lightning-fill"></i> Test</button>
                <button type="button" class="mode-btn" data-mode="manual"><i class="bi bi-pencil-fill"></i> Manual</button>
            </div>` : '';

        mainContent.innerHTML = `
            <div class="method-detail">
                <div class="portal-panel">

                    <!-- Panel header -->
                    <div class="panel-header">
                        <div class="panel-title-row">
                            <h4 class="panel-title">${method.name}</h4>
                            <div class="panel-endpoint">
                                <span class="endpoint-method ${methodLower}">${method.method}</span>
                                <code class="endpoint-url" id="fullEndpointUrl">${getFullURL(method.endpoint)}</code>
                            </div>
                        </div>
                        <p class="panel-description">${method.description}</p>
                    </div>

                    <!-- Parameters section -->
                    <div class="panel-section">
                        <div class="section-label-row">
                            <div class="section-label"><i class="bi bi-sliders"></i> Parameters</div>
                            ${modeToggleHTML}
                        </div>
                        <form id="paramForm" autocomplete="off">
                            ${paramsHTML}
                            <div class="send-area">
                                <button type="submit" class="btn-send" id="btnSend">
                                    <span class="send-text"><i class="bi bi-send-fill"></i> Send Request</span>
                                    <span class="spinner"></span>
                                </button>
                                <button type="button" class="btn-clear" id="btnClear">
                                    <i class="bi bi-arrow-counterclockwise"></i> Reset
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Response section -->
                    <div class="panel-section panel-response-section">
                        <div class="section-label"><i class="bi bi-terminal"></i> Response</div>
                        <div id="responseContainer">
                            <div class="response-empty">
                                <i class="bi bi-cursor"></i>
                                Click <strong>Send Request</strong> to see the response here.
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Auto-fill test data on load
        if (hasParams && method.testData) {
            fillForm(method, getTestData(method));
        }


        // Mode toggle listeners
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                currentMode = mode;

                // Update active button
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (mode === 'test' && method.testData) {
                    fillForm(method, getTestData(method));
                } else {
                    clearForm(method);
                }
            });
        });

        // Form submission
        document.getElementById('paramForm').addEventListener('submit', (e) => {
            e.preventDefault();
            sendRequest(method);
        });

        // Reset button — resets to current mode
        document.getElementById('btnClear').addEventListener('click', () => {
            if (currentMode === 'test' && method.testData) {
                fillForm(method, getTestData(method));
            } else {
                clearForm(method);
            }
        });
    }

    // ─── Fill Form with Data ──────────────────────────────────────────────
    function fillForm(method, data) {
        method.params.forEach(p => {
            const el = document.getElementById('param_' + p.name);
            if (!el) return;
            const val = data[p.name];
            if (val === undefined) return;

            if (p.type === 'checkbox') {
                el.checked = !!val;
                const label = el.parentElement?.querySelector('span');
                if (label) label.textContent = val ? 'Yes' : 'No';
            } else if (p.type === 'select') {
                el.value = val;
            } else {
                el.value = typeof val === 'object' ? JSON.stringify(val) : val;
            }
        });
    }

    // ─── Clear Form to Defaults ───────────────────────────────────────────
    function clearForm(method) {
        method.params.forEach(p => {
            const el = document.getElementById('param_' + p.name);
            if (!el) return;

            if (p.type === 'checkbox') {
                el.checked = !!p.default;
                const label = el.parentElement?.querySelector('span');
                if (label) label.textContent = p.default ? 'Yes' : 'No';
            } else if (p.type === 'select') {
                el.value = p.default || '';
            } else {
                el.value = p.default || '';
            }
        });
    }

    // ─── Build Parameter Field ────────────────────────────────────────────
    function buildParamField(param) {
        const id = 'param_' + param.name;
        let inputHTML = '';

        switch (param.type) {
            case 'checkbox':
                inputHTML = `
                    <div class="param-toggle">
                        <input type="checkbox" id="${id}" ${param.default ? 'checked' : ''}>
                        <span>${param.default ? 'Yes' : 'No'}</span>
                    </div>`;
                break;

            case 'select':
                const opts = (param.options || []).map(o =>
                    `<option value="${o.value}" ${o.value === param.default ? 'selected' : ''}>${o.label}</option>`
                ).join('');
                inputHTML = `<select id="${id}" class="param-input">${opts}</select>`;
                break;

            case 'textarea':
                inputHTML = `<textarea id="${id}" class="param-input" placeholder="${param.description || ''}">${param.default || ''}</textarea>`;
                break;

            case 'array':
                inputHTML = `
                    <input type="text" id="${id}" class="param-input" value='${param.default || '[]'}' placeholder='["value1", "value2"]'>
                    <div class="array-helper">Enter as a JSON array, e.g. ["medical", "optical"]</div>`;
                break;

            default:
                inputHTML = `<input type="${param.type}" id="${id}" class="param-input" value="${param.default || ''}" placeholder="${param.description || ''}">`;
        }

        return `
            <div class="param-group">
                <div class="param-label">
                    <label for="${id}">${param.name}</label>
                    ${param.required ? '<span class="required-dot" title="Required"></span>' : ''}
                    <span class="param-type">${param.type}</span>
                </div>
                ${param.description ? `<div class="param-description">${param.description}</div>` : ''}
                ${inputHTML}
            </div>`;
    }

    // ─── Send Request ─────────────────────────────────────────────────────
    async function sendRequest(method) {
        const btn = document.getElementById('btnSend');
        btn.classList.add('loading');

        // Build request body
        const body = {};
        method.params.forEach(p => {
            const el = document.getElementById('param_' + p.name);
            if (!el) return;

            if (p.type === 'checkbox') {
                body[p.name] = el.checked;
            } else if (p.type === 'array') {
                try {
                    body[p.name] = JSON.parse(el.value);
                } catch {
                    body[p.name] = el.value;
                }
            } else if (p.type === 'number') {
                // Convert to number if not empty
                const val = el.value.trim();
                if (val !== '') body[p.name] = Number(val);
            } else {
                const val = el.value.trim();
                if (val !== '') body[p.name] = val;
            }
        });

        const url = getFullURL(method.endpoint);
        const startTime = performance.now();

        try {
            const fetchOpts = {
                method: method.method,
                headers: { 'Content-Type': 'application/json' },
            };

            if (method.method !== 'GET') {
                fetchOpts.body = JSON.stringify(body);
            }

            const res = await fetch(url, fetchOpts);
            const elapsed = Math.round(performance.now() - startTime);
            let data;
            const text = await res.text();
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }

            lastResponse = { status: res.status, data, elapsed };
            renderResponse(res.status, data, elapsed);
        } catch (err) {
            const elapsed = Math.round(performance.now() - startTime);
            lastResponse = { status: 0, data: err.message, elapsed };
            renderNetworkError(err.message, elapsed);
        } finally {
            btn.classList.remove('loading');
        }
    }

    // ─── Render Response ──────────────────────────────────────────────────
    function renderResponse(status, data, elapsed) {
        const container = document.getElementById('responseContainer');
        const statusClass = status < 300 ? 'success' : status < 500 ? 'client-error' : 'server-error';
        const statusLabel = status < 300 ? 'Success' : status < 500 ? 'Client Error' : 'Server Error';

        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

        container.innerHTML = `
            <div class="response-meta">
                <span class="status-badge ${statusClass}">
                    <i class="bi bi-circle-fill" style="font-size: 0.5rem;"></i>
                    ${status} ${statusLabel}
                </span>
                <span class="response-time"><i class="bi bi-clock"></i> ${elapsed}ms</span>
            </div>
            <div class="response-body">
                <button class="btn-copy" id="btnCopy"><i class="bi bi-clipboard"></i> Copy</button>
                <pre id="responseJSON">${highlightJSON(jsonStr)}</pre>
            </div>
        `;

        document.getElementById('btnCopy').addEventListener('click', copyResponse);
    }

    function renderNetworkError(message, elapsed) {
        const container = document.getElementById('responseContainer');
        container.innerHTML = `
            <div class="response-meta">
                <span class="status-badge network-error">
                    <i class="bi bi-exclamation-triangle-fill" style="font-size: 0.65rem;"></i>
                    Network Error
                </span>
                <span class="response-time"><i class="bi bi-clock"></i> ${elapsed}ms</span>
            </div>
            <div class="response-body">
                <pre style="color: #fb7185;">${escapeHTML(message)}</pre>
            </div>
        `;
    }

    // ─── JSON Syntax Highlight ────────────────────────────────────────────
    function highlightJSON(json) {
        const escaped = escapeHTML(json);
        return escaped.replace(
            /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
            (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? 'json-key' : 'json-string';
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    // ─── Copy to Clipboard ────────────────────────────────────────────────
    function copyResponse() {
        if (!lastResponse) return;
        const text = typeof lastResponse.data === 'string' ? lastResponse.data : JSON.stringify(lastResponse.data, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('btnCopy');
            btn.classList.add('copied');
            btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            }, 2000);
        });
    }

    // ─── Welcome Screen ──────────────────────────────────────────────────
    function showWelcome() {
        mainContent.innerHTML = `
            <div class="portal-welcome">
                <i class="bi bi-braces-asterisk welcome-icon"></i>
                <h3>DUO+ API Portal</h3>
                <p>Select a method from the sidebar to view its parameters and test it against the backend.</p>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem;">
                    <span class="method-badge post" style="font-size: 0.72rem;">POST</span>
                    <span class="method-badge get" style="font-size: 0.72rem;">GET</span>
                    <span style="color: #94a3b8; font-size: 0.8rem;">${API_METHODS.length} methods available</span>
                </div>
            </div>
        `;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────
    function getTestData(method) {
        return typeof method.testData === 'function' ? method.testData() : method.testData;
    }

    function getFullURL(endpoint) {
        const base = window.location.origin;
        return base + endpoint;
    }

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

})();
