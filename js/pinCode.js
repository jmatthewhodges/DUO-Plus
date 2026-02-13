const clearInputs = (inputs) => inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
const showError = (msg, err) => err.textContent = msg;
const hideError = (err) => err.classList.add('d-none');

document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.pin-input');
    const form = document.getElementById('pinCodeForm');
    const errorMsg = document.getElementById('pinErrorMessage');
    const modal = document.getElementById('pinCodeModal');
    const submitBtn = document.getElementById('submitPinBtn');
    let pinVerified = false;

    // Prevent modal from closing before PIN verification
    modal.addEventListener('hide.bs.modal', function(e) {
        if (!pinVerified) {
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

    setTimeout(() => new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false }).show(), 500);

    inputs.forEach((input, i) => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            this.classList.toggle('filled', !!this.value);
            if (this.value && i < inputs.length - 1) inputs[i + 1].focus();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && i > 0) inputs[i - 1].focus();
            if (e.key === 'Enter' && i === inputs.length - 1) form.dispatchEvent(new Event('submit'));
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
        const pin = Array.from(inputs).map(i => i.value).join('');

        if (pin.length !== 6) {
            showError('Enter all 6 digits', errorMsg);
            errorMsg.classList.remove('d-none');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

        try {
            // Send PIN to backend for verification
            const response = await fetch('/api/verify-pin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Invalid PIN');
            }

            // Mark as verified and close
            pinVerified = true;
            hideError(errorMsg);
            document.querySelector('.container-fluid').classList.add('pin-verified');
            bootstrap.Modal.getInstance(modal).hide();
            console.log('PIN verified');
        } catch (err) {
            showError(err.message || 'Verification failed', errorMsg);
            errorMsg.classList.remove('d-none');
            clearInputs(inputs);
            inputs[0].focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Verify PIN';
        }
    });

    modal.addEventListener('show.bs.modal', () => {
        inputs[0].focus();
        clearInputs(inputs);
        hideError(errorMsg);
    });
});
