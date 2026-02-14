// PIN Modal - Fully modular component
// Add to any page: <script src="../js/pinCode.js"></script>

function initializePINModal() {
    // Inject modal HTML if it doesn't exist
    if (!document.getElementById('pinCodeModal')) {
        const modalHTML = `
        <div class="modal fade" id="pinCodeModal" tabindex="-1" aria-labelledby="pinCodeModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0" style="background-color:#174593">
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
                            <div id="pinErrorMessage" class="alert alert-danger d-none" role="alert"></div>
                            <button type="submit" id="submitPinBtn" class="btn btn-primary w-100">Verify PIN</button>
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

    // Check if already verified in this session
    let pinVerified = sessionStorage.getItem('pinVerified') === 'true' ? true : false;

    const inputs = document.querySelectorAll('.pin-input');
    const form = document.getElementById('pinCodeForm');
    const errorMsg = document.getElementById('pinErrorMessage');
    const modal = document.getElementById('pinCodeModal');
    const submitBtn = document.getElementById('submitPinBtn');
    const nameEntry = document.getElementById('nameEntry');

    // Prevent modal from closing before PIN verification AND name entry
    modal.addEventListener('hide.bs.modal', function(e) {
        const nameInput = nameEntry.querySelector('input[type="text"]');
        if (!pinVerified || !nameInput || !nameInput.value.trim()) {
            e.preventDefault();
        }
    });


    // Prevent escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !pinVerified) {
            e.preventDefault();
        }
    });

    // Prevent back button
    history.pushState(null, null, window.location.href);
    window.addEventListener('popstate', function(e) {
        if (!pinVerified) {
            e.preventDefault();
            history.pushState(null, null, window.location.href);
        }
    });

    // Remove any close buttons
    const closeButtons = modal.querySelectorAll('.btn-close');
    closeButtons.forEach(btn => btn.style.display = 'none');

    // If already verified in session, unblur screen and skip modal
    if (pinVerified) {
        const blurTarget = document.querySelector('.container-fluid') || document.body;
        blurTarget.classList.add('pin-verified');
    } else {
        setTimeout(() => new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false }).show(), 500);
    }

    inputs.forEach((input, i) => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            this.classList.toggle('filled', !!this.value);
            if (this.value && i < inputs.length - 1) inputs[i + 1].focus();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && i > 0) inputs[i - 1].focus();
            if (e.key === 'Enter' && i === inputs.length - 1) {
                // Move focus to name input on Enter from last PIN digit
                const nameInput = nameEntry.querySelector('input[type="text"]');
                if (nameInput) nameInput.focus();
            }
            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab', 'Enter'].includes(e.key))
                e.preventDefault();
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const digits = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
            digits.split('').forEach((d, j) => {
                if (i + j < inputs.length) {
                    inputs[i + j].value = d;
                    inputs[i + j].classList.add('filled');
                }
            });
            inputs[Math.min(i + digits.length - 1, inputs.length - 1)].focus();
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
    });

    // Handle name entry form submission
    const nameInput = nameEntry.querySelector('input[type="text"]');
    
    // Allow Enter key on name input
    nameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            nameEntry.dispatchEvent(new Event('submit'));
        }
    });

    nameEntry.addEventListener('submit', async function(e) {
        e.preventDefault();
        const pin = Array.from(inputs).map(i => i.value).join('');
        const name = nameInput.value.trim();

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

        try {
            const response = await fetch('/api/verify-pin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, name: name })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Verification failed');
            }

            pinVerified = true;
            sessionStorage.setItem('pinVerified', 'true');
            document.body.setAttribute('data-pin-verified', 'true');
            hideError(errorMsg);
            const blurTarget = document.querySelector('.container-fluid') || document.body;
            blurTarget.classList.add('pin-verified');
            bootstrap.Modal.getInstance(modal).hide();
        } catch (err) {
            showError(err.message, errorMsg);
            errorMsg.classList.remove('d-none');
            clearInputs(inputs);
            inputs[0].focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Verify PIN';
        }
    });

    modal.addEventListener('show.bs.modal', () => {
        if (pinVerified) {
            return false;
        }
        inputs[0].focus();
        clearInputs(inputs);
        hideError(errorMsg);
    });
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePINModal);
} else {
    initializePINModal();
}
