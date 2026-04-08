/*
 * ============================================================
 *  File:        pinCode.js
 *  Description: modular script for handling PIN code verification.
 *               Hides content until PIN is verified.
 *
 *  Last Modified By:  Cameron Jasper
 *  Last Modified On:  Apr 7 11:00 PM
 *  Changes Made:      Added PIN-specific relock handling, cross-tab reset
 *                     notifications, and clearer expired-session messaging.
 * ============================================================
*/
// PIN Modal - Fully modular component
//
// SECURITY SETUP:
// ===============
// 1. Frontend: This script hides content until PIN verified
// 2. IMPORTANT!!!! Backend: Protect any API endpoints by adding this line to 
//    each API file that fetches protected data:
//    Add to top any page: <script src="../js/pinCode.js"></script>
//    Add to top any API file: require_once __DIR__ . '/pin-required.php';

//
// Example: In /api/GrabQueue.php, add after other requires:
//    require_once __DIR__ . '/pin-required.php';
//
// This will:
// - Return 403 JSON error if API request lacks valid PIN session
// - Redirect to /index.html if HTML page request lacks valid session

// Hide page content immediately (before it renders)
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .container-fluid {
            display: none !important;
        }
        body.pin-verified .container-fluid {
            display: block !important;
        }
    `;
    document.head.appendChild(style);
})();

function initializePINModal() {
    // HTML INJECTION: Create and inject modal into page if not already present
    // Modal includes PIN input fields, name input, error message display, and verify button
    if (!document.getElementById('pinCodeModal')) {
        const modalHTML = `
        <div class="modal fade" id="pinCodeModal" tabindex="-1" aria-labelledby="pinCodeModalLabel" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0 bg-primary">
                        <h5 class="modal-title mb-1" id="pinCodeModalLabel" style="color:white">Enter PIN Code</h5>
                    </div>
                    <div class="modal-body text-center pt-4">
                        <p class="text-muted mb-4">Please enter the 6-digit PIN code</p>
                        <form id="pinCodeForm">
                            <div class="pin-input-group d-flex justify-content-center gap-3 mb-4">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 1">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 2">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 3">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 4">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 5">
                                <input type="text" maxlength="1" class="pin-input" inputmode="numeric" aria-label="PIN digit 6">
                            </div>
                        </form>
                        <form id="nameEntry">
                            <div class="d-flex justify-content-center gap-3 mb-4">
                                <input type="text" maxlength="30" class="form-control" placeholder="Enter Name" aria-label="Enter Name">
                            </div>
                            <button type="submit" id="submitPinBtn" aria-label="Verify PIN button" class="btn btn-primary w-100">Verify PIN</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const clearInputs = (inputs) => inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });

    // Track PIN verification in this session (frontend only - real verification is server-side)
    let pinVerified = false;

    // Determine pin type based on page — admin page uses the admin PIN
    const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'unknown';
    const pinType  = (pageName === 'admin') ? 'admin' : 'general';

    // Check if user already has a valid server session for this pin type
    async function checkServerSession() {
        try {
            const response = await fetch('/api/VerifyPin.php?type=' + pinType, { cache: 'no-store' });
            const data = await response.json();
            return data.verified === true;
        } catch (e) {
            return false;
        }
    }

    // DOM element references
    const inputs = document.querySelectorAll('.pin-input');
    const form = document.getElementById('pinCodeForm');
    const modal = document.getElementById('pinCodeModal');
    const submitBtn = document.getElementById('submitPinBtn');
    const nameEntry = document.getElementById('nameEntry');
    const nameInput = nameEntry.querySelector('input[type="text"]');

    // These two browser-level channels let one tab tell other open tabs that
    // a PIN was changed from the admin page, so they can relock immediately.
    const PIN_RESET_EVENT_KEY = 'duoPlusPinReset';
    const pinResetChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('duo-plus-pin-reset') : null;
    let sessionMonitorId = null;
    let relockAlertOpen = false;

    function showPinModal() {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modal, { backdrop: 'static', keyboard: false });
        modalInstance.show();
    }

    function lockPageForPinReset(message = 'Your PIN session is no longer valid. Please enter the PIN again to continue.', title = 'PIN Required') {
        if (relockAlertOpen) return;

        relockAlertOpen = true;
        pinVerified = false;
        document.body.classList.remove('pin-verified');
        clearInputs(inputs);

        if (nameInput) {
            nameInput.value = '';
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Verify PIN';
        showPinModal();

        Swal.fire({
            icon: 'warning',
            title: title,
            text: message,
            confirmButtonText: 'Re-enter PIN',
            allowOutsideClick: false
        }).then(() => {
            relockAlertOpen = false;
            setTimeout(() => inputs[0].focus(), 150);
        });
    }

    async function validateActivePinSession() {
        if (!pinVerified) return false;

        const isStillVerified = await checkServerSession();
        if (!isStillVerified) {
            lockPageForPinReset('Your PIN session expired or was cleared. Please enter the PIN again to continue.', 'PIN Required');
        }
        return isStillVerified;
    }

    function startPinSessionMonitor() {
        if (sessionMonitorId !== null) return;

        sessionMonitorId = window.setInterval(() => {
            if (pinVerified && !document.hidden) {
                validateActivePinSession();
            }
        }, 1000);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            validateActivePinSession();
        }
    });

    window.addEventListener('focus', () => {
        validateActivePinSession();
    });

    document.addEventListener('pinSessionExpired', (event) => {
        if (pinVerified) {
            lockPageForPinReset(
                event.detail?.message || 'Your PIN session is no longer valid. Please enter the PIN again to continue.',
                event.detail?.title || 'PIN Required'
            );
        }
    });

    // Only relock pages whose required PIN type matches the PIN that was
    // actually changed. General PIN updates should not kick out admin pages, and vice versa.
    function handlePinResetSignal(detail = {}) {
        const resetType = (detail.pinType === 'admin') ? 'admin' : 'general';
        if (resetType !== pinType) return;

        lockPageForPinReset(
            detail.message || 'This PIN was updated. Please enter the new PIN to continue.',
            detail.title || 'PIN Updated'
        );
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== PIN_RESET_EVENT_KEY || !event.newValue) return;

        try {
            handlePinResetSignal(JSON.parse(event.newValue));
        } catch (_) {
            // Ignore malformed storage payloads.
        }
    });

    window.addEventListener('duo-pin-reset', (event) => {
        handlePinResetSignal(event.detail || {});
    });

    if (pinResetChannel) {
        pinResetChannel.addEventListener('message', (event) => {
            handlePinResetSignal(event.data || {});
        });
    }

    if (!window.__pinFetchWrapped) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            if (pinVerified && response.status === 403) {
                const contentType = (response.headers.get('content-type') || '').toLowerCase();
                if (contentType.includes('application/json')) {
                    try {
                        const payload = await response.clone().json();
                        const errorText = String(payload?.error || '');
                        if (/pin verification required|admin pin verification required/i.test(errorText)) {
                            lockPageForPinReset('Your PIN session is no longer valid. Please enter the PIN again to continue.', 'PIN Required');
                        }
                    } catch (_) {
                        // Ignore JSON parsing failures and return the original response.
                    }
                }
            }

            return response;
        };
        window.__pinFetchWrapped = true;
    }

    // QR CODE AUTO-FILL: Check for PIN in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    const serviceID = urlParams.get('ServiceID');
    
    // Store ServiceID globally if provided
    if (serviceID) {
        window.serviceID = serviceID;
    }

    // ANTI-BYPASS: Prevent modal from closing before PIN verification AND name entry
    modal.addEventListener('hide.bs.modal', function(e) {
        const nameInput = nameEntry.querySelector('input[type="text"]');
        if (!pinVerified || !nameInput || !nameInput.value.trim()) {
            e.preventDefault();
        }
    });

    // Auto-fill PIN when modal is shown (if provided in URL)
    modal.addEventListener('shown.bs.modal', function() {
        if (urlPin && urlPin.length === 6 && /^\d+$/.test(urlPin)) {
            const pinInputs = document.querySelectorAll('.pin-input');
            urlPin.split('').forEach((digit, index) => {
                if (pinInputs[index]) {
                    pinInputs[index].value = digit;
                    pinInputs[index].classList.add('filled');
                }
            });
        }
    });

    // ANTI-BYPASS: Prevent escape key from closing modal before verification
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !pinVerified) {
            e.preventDefault();
        }
    });

    // ANTI-BYPASS: Prevent browser back button before verification
    history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', function(e) {
        if (!pinVerified) {
            e.preventDefault();
            history.pushState(null, null, window.location.href);
        }
    });

    // ANTI-BYPASS: Remove close button from modal header
    const closeButtons = modal.querySelectorAll('.btn-close');
    closeButtons.forEach(btn => btn.style.display = 'none');

    // INITIALIZATION: Check server session, show content if verified
    const pinModal = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false });
    
    // Check if user has valid session
    checkServerSession().then(isVerified => {
        if (isVerified) {
            // User already verified - show content
            pinVerified = true;
            document.body.classList.add('pin-verified');
            startPinSessionMonitor();
            // Notify other JS files that PIN is verified
            document.dispatchEvent(new CustomEvent('pinVerified'));
        } else {
            // User not verified - show modal
            showPinModal();
        }
    }).catch(() => {
        // On error, show modal to be safe
        showPinModal();
    });

    // PIN INPUT HANDLING: Setup event listeners for each PIN digit input
    inputs.forEach((input, i) => {
        // INPUT EVENT: Auto-focus to next field when digit entered, add visual feedback
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            this.classList.toggle('filled', !!this.value);
            if (this.value && i < inputs.length - 1) inputs[i + 1].focus();
        });

        // KEYBOARD EVENT: Handle backspace navigation, Enter submission, and block non-numeric keys
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && i > 0) inputs[i - 1].focus();
            if (e.key === 'Enter' && i === inputs.length - 1) {
                const nameInput = nameEntry.querySelector('input[type="text"]');
                if (nameInput) nameInput.focus();
            }
            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab', 'Enter'].includes(e.key))
                e.preventDefault();
        });
    });

    // Prevent form submission on Enter key in PIN inputs
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
    });

    // NAME ENTRY HANDLING: Process user's name submission
    // Allow Enter key to submit name entry form
    nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            nameEntry.dispatchEvent(new Event('submit'));
        }
    });

    // FORM SUBMISSION: Send PIN and name to backend for verification
    nameEntry.addEventListener('submit', async function(e) {
        e.preventDefault();
        const pin = Array.from(inputs).map(i => i.value).join('');
        const name = nameInput.value.trim();

        // Client-side validation: PIN first, then name
        const pinComplete = pin.length === 6 && /^\d{6}$/.test(pin);

        if (!pinComplete) {
            if (document.activeElement) document.activeElement.blur();
            Swal.fire({
                icon: 'error',
                title: 'PIN Required',
                text: 'Please enter the 6-digit PIN',
                confirmButtonText: 'OK',
                allowOutsideClick: false
            }).then(() => {
                clearInputs(inputs);
                setTimeout(() => inputs[0].focus(), 300);
            });
            return;
        }

        if (!name) {
            if (document.activeElement) document.activeElement.blur();
            Swal.fire({
                icon: 'error',
                title: 'Name Required',
                text: 'Please enter your name',
                confirmButtonText: 'OK',
                allowOutsideClick: false
            }).then(() => {
                setTimeout(() => nameInput.focus(), 300);
            });
            return;
        }

        // UI FEEDBACK: Show loading spinner while verifying
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

        try {
            // BACKEND REQUEST: Send PIN, name, page name, and pin type for validation
            const response = await fetch('/api/VerifyPin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, name: name, pageName: pageName, pinType: pinType })
            });

            const data = await response.json();

            // ERROR HANDLING: Check response from backend
            if (!data.success) {
                throw new Error(data.error || 'Verification failed');
            }

            // SUCCESS: Show content, close modal
            pinVerified = true;
            document.body.classList.add('pin-verified');
            startPinSessionMonitor();
            document.dispatchEvent(new CustomEvent('pinVerified'));
            
            // Close modal and remove backdrop
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            
            // Remove the modal backdrop if it exists
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            
            // Refresh page to load all data with authenticated session
            setTimeout(() => {
                location.reload();
            }, 500);

        } catch (err) {
            // Blur any focused input so the mobile keyboard closes before the alert
            if (document.activeElement) document.activeElement.blur();

            // FAILURE: Display error using SweetAlert
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message,
                confirmButtonText: 'OK',
                allowOutsideClick: false
            }).then(() => {
                // Re-enable button after alert is dismissed
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Verify PIN';
                isSubmitting = false; // Allow new submissions

                // PIN was wrong — clear it and reset to first digit
                clearInputs(inputs);
                setTimeout(() => inputs[0].focus(), 300);
            });
        } finally {
        }
    });

    // MODAL SHOW EVENT: Reset form state when modal opens
    modal.addEventListener('show.bs.modal', () => {
        if (pinVerified) {
            return false;
        }
        inputs[0].focus();
        clearInputs(inputs);
    });
}

// AUTO-INITIALIZE: Run PIN modal setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePINModal);
} else {
    initializePINModal();
}
