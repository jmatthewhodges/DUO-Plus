/**
 * ============================================================
 *  File:        pinCode.js
 *  Purpose:     Handles user authentication via a PIN modal.
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:51 PM
 *  Changes Made:      Code cleanup
 * ============================================================
*/

// PIN Modal - Fully modular component
// Add to any page: <script src="../js/pinCode.js"></script>

function initializePINModal() {
    // HTML INJECTION: Create and inject modal into page if not already present
    // Modal includes PIN input fields, name input, error message display, and verify button
    if (!document.getElementById('pinCodeModal')) {
        const modalHTML = `
        <div class="modal fade" id="pinCodeModal" tabindex="-1" aria-labelledby="pinCodeModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
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
                            <div id="pinErrorMessage" class="alert alert-danger d-none" role="alert" style="font-size: 0.75rem; padding: 0.375rem 0.5rem; margin-bottom: 0.75rem;"></div>
                            <button type="submit" id="submitPinBtn" aria-label="Verify PIN button" class="btn btn-primary w-100">Verify PIN</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const clearInputs = (inputs) => inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
    const showError = (msg, err) => err.textContent = msg;
    const hideError = (err) => err.classList.add('d-none');

    // PERSISTENCE: Check if user already verified PIN in this browser
    let pinVerified = localStorage.getItem('pinVerified') === 'true' ? true : false;

    // DOM element references
    const inputs = document.querySelectorAll('.pin-input');
    const form = document.getElementById('pinCodeForm');
    const errorMsg = document.getElementById('pinErrorMessage');
    const modal = document.getElementById('pinCodeModal');
    const submitBtn = document.getElementById('submitPinBtn');
    const nameEntry = document.getElementById('nameEntry');

    // QR CODE AUTO-FILL: Check for PIN in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    const stationId = urlParams.get('stationId');
    
    // Store stationId globally if provided
    if (stationId) {
        window.stationId = stationId;
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

    // INITIALIZATION: If already verified in session, skip modal
    // Otherwise apply blur and show modal
    const blurTarget = document.querySelector('.container-fluid') || document.body;
    
    if (pinVerified) {
        blurTarget.classList.add('pin-verified');
    } else {
        // Apply blur while waiting for PIN
        blurTarget.style.filter = 'blur(4px)';
        setTimeout(() => new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false }).show(), 500);
    }

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
    const nameInput = nameEntry.querySelector('input[type="text"]');
    
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
        const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'unknown';

        // UI FEEDBACK: Show loading spinner while verifying
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

        try {
            // BACKEND REQUEST: Send PIN, name, and page name to /api/verify-pin.php for validation
            const response = await fetch('/api/VerifyPin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, name: name, pageName: pageName })
            });

            const data = await response.json();

            // ERROR HANDLING: Check response from backend
            if (!data.success) {
                throw new Error(data.error || 'Verification failed');
            }

            // SUCCESS: Set session, unblur screen, close modal
            pinVerified = true;
            localStorage.setItem('pinVerified', 'true');
            document.body.setAttribute('data-pin-verified', 'true');
            hideError(errorMsg);
            const blurTarget = document.querySelector('.container-fluid') || document.body;
            blurTarget.style.filter = '';  // Remove inline blur
            blurTarget.classList.add('pin-verified');
            bootstrap.Modal.getInstance(modal).hide();
        } catch (err) {
            // FAILURE: Display error message
            showError(err.message, errorMsg);
            errorMsg.classList.remove('d-none');
            
            // Clear only the invalid field - keep the valid one
            if (err.message === 'Invalid PIN' || err.message === 'Invalid PIN format') {
                // PIN is wrong or invalid format, keep name, clear PIN and refocus on PIN
                clearInputs(inputs);
                inputs[0].focus();
            } else if (err.message === 'Please enter your name') {
                // Name is missing, keep PIN, clear name and refocus on name
                nameInput.value = '';
                nameInput.focus();
            } else {
                // Other errors (rate limit, etc) - clear name only
                nameInput.value = '';
                nameInput.focus();
            }
        } finally {
            // RESTORE UI: Re-enable button after response
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Verify PIN';
        }
    });

    // MODAL SHOW EVENT: Reset form state when modal opens
    modal.addEventListener('show.bs.modal', () => {
        if (pinVerified) {
            return false;
        }
        inputs[0].focus();
        clearInputs(inputs);
        hideError(errorMsg);
    });
}

// AUTO-INITIALIZE: Run PIN modal setup when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePINModal);
} else {
    initializePINModal();
}
