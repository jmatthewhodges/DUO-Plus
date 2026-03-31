/**
 * ============================================================
 * File:        devMode.js
 * Description: Developer mode toggle, protected by admin PIN.
 *              Activate by clicking the DUO+ logo 5 times on
 *              the login page. State persists for the session.
 *              Injects a floating toolbar with page shortcuts
 *              and reveals any .dev-only elements on the page.
 * ============================================================
 */

(function () {
    const DEV_KEY = 'duo_dev_mode';

    function isDevMode() {
        return sessionStorage.getItem(DEV_KEY) === '1';
    }

    function enableDevMode() {
        sessionStorage.setItem(DEV_KEY, '1');
        applyDevMode();
    }

    function disableDevMode() {
        sessionStorage.removeItem(DEV_KEY);
        const toolbar = document.getElementById('devToolbar');
        if (toolbar) toolbar.remove();
        document.querySelectorAll('.dev-only').forEach(el => el.classList.add('d-none'));
    }

    function applyDevMode() {
        document.querySelectorAll('.dev-only').forEach(el => el.classList.remove('d-none'));

        // On index.html an inline panel lives under the Life Church logo — wire it up,
        // no floating FAB needed there.
        const inlinePanel = document.getElementById('devIndexPanel');
        if (inlinePanel) {
            wireInlinePanel();
        } else if (!document.getElementById('devToolbar')) {
            injectToolbar();
        }
    }

    function wireInlinePanel() {
        const btn = document.getElementById('devIndexDisableBtn');
        if (!btn || btn._wired) return;
        btn._wired = true;
        btn.addEventListener('click', () => {
            disableDevMode();
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Dev Mode Off', timer: 1000, showConfirmButton: false });
            }
        });
    }

    function injectToolbar() {
        const inPages = window.location.pathname.toLowerCase().includes('/pages/');
        const p = inPages ? '' : 'pages/';       // prefix for pages/ links
        const r = inPages ? '../' : '';            // prefix for root links

        const toolbar = document.createElement('div');
        toolbar.id = 'devToolbar';
        toolbar.innerHTML = `
            <button id="devFab" title="Developer mode is active">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/>
                    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/>
                </svg>
                Dev
            </button>
            <div id="devPanel">
                <div class="dev-panel-header">
                    <span class="dev-panel-title">Developer Mode</span>
                    <button id="devDisableBtn" title="Disable dev mode">Disable</button>
                </div>
                <div class="dev-panel-links">
                    <span class="dev-panel-section">Pages</span>
                    <a href="${r}portal/">API Portal</a>
                    <a href="${p}registration-dashboard.html">Reg. Dashboard</a>
                    <a href="${p}waitingroom.html">Waiting Room</a>
                    <a href="${p}service-scan.html">Service Scan</a>
                    <a href="${p}food-truck.html">Food Truck</a>
                    <a href="${p}admin.html">Admin</a>
                </div>
            </div>`;
        document.body.appendChild(toolbar);

        const panel = document.getElementById('devPanel');
        document.getElementById('devFab').addEventListener('click', () => {
            panel.classList.toggle('dev-panel-open');
        });
        document.getElementById('devDisableBtn').addEventListener('click', () => {
            disableDevMode();
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Dev Mode Off', timer: 1000, showConfirmButton: false });
            }
        });

        // Close panel when clicking outside
        document.addEventListener('click', e => {
            if (!toolbar.contains(e.target)) panel.classList.remove('dev-panel-open');
        });
    }

    // Secret trigger: tap/click the DUO+ logo 5 times within 3 seconds
    function setupSecretTrigger() {
        let count = 0;
        let timer = null;

        function onTrigger() {
            count++;
            clearTimeout(timer);
            timer = setTimeout(() => { count = 0; }, 3000);
            if (count >= 5) {
                count = 0;
                clearTimeout(timer);
                if (isDevMode()) {
                    disableDevMode();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'info', title: 'Dev Mode Off', timer: 1000, showConfirmButton: false });
                    }
                } else {
                    promptAdminPin();
                }
            }
        }

        // Attach to the logo on the login page
        const logo = document.querySelector('.logo-section img');
        if (logo) {
            logo.style.cursor = 'pointer';
            logo.addEventListener('click', onTrigger);
        }
    }

    async function promptAdminPin() {
        if (typeof Swal === 'undefined') return;

        const { value: pin } = await Swal.fire({
            title: 'Developer Mode',
            html: '<p class="text-muted small mb-0">Enter the admin PIN to enable developer mode for this session.</p>',
            input: 'password',
            inputAttributes: { maxlength: '6', autocomplete: 'off', inputmode: 'numeric', placeholder: '6-digit admin PIN' },
            showCancelButton: true,
            confirmButtonText: 'Enable',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#174593',
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: (value) => {
                if (!value || value.trim() === '') {
                    Swal.showValidationMessage('Please enter the PIN.');
                    return false;
                }
                if (!/^\d{6}$/.test(value)) {
                    Swal.showValidationMessage('PIN must be exactly 6 digits.');
                    return false;
                }
                return value;
            }
        });

        if (!pin) return;

        try {
            const res = await fetch('/api/VerifyPin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, name: 'Developer', pageName: 'devmode', pinType: 'admin' })
            });
            const data = await res.json();
            if (data.success) {
                enableDevMode();
                Swal.fire({ icon: 'success', title: 'Dev Mode On', text: 'Developer tools are now active for this session.', timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'Access Denied', text: data.error || 'Incorrect PIN.' });
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Could not reach the server.' });
        }
    }

    // Boot
    function init() {
        setupSecretTrigger();
        if (isDevMode()) applyDevMode();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
