const clearInputs = (inputs) => inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
const showError = (msg, err) => err.textContent = msg;
const hideError = (err) => err.classList.add('d-none');

document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.pin-input');
    const form = document.getElementById('pinCodeForm');
    const errorMsg = document.getElementById('pinErrorMessage');
    const modal = document.getElementById('pinCodeModal');
    const submitBtn = document.getElementById('submitPinBtn');

    setTimeout(() => new bootstrap.Modal(modal).show(), 500);

    inputs.forEach((input, i) => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            this.classList.toggle('filled', !!this.value);
            if (this.value && i < inputs.length - 1) inputs[i + 1].focus();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && i > 0) inputs[i - 1].focus();
            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete', 'Tab'].includes(e.key))
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
            await new Promise(r => setTimeout(r, 1500));
            if (pin !== '123456') throw new Error('Invalid PIN');
            hideError(errorMsg);
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
