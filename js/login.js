// ============================================================================
// CONFIG
// ============================================================================

const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    password: /.+/ // login just checks presence (not strength)
};

// ============================================================================
// UTILITY
// ============================================================================

function setFieldValidation(field, isValid) {
    if (isValid) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    } else {
        field.classList.remove('is-valid');
        field.classList.add('is-invalid');
    }
}

// ============================================================================
// LOGIN VALIDATION
// ============================================================================

function validateLoginForm() {
    const emailInput = document.getElementById('txtClientEmail');
    const passInput = document.getElementById('txtClientPassword');

    let isValid = true;

    // Email
    if (!VALIDATION_PATTERNS.email.test(emailInput.value.trim())) {
        setFieldValidation(emailInput, false);
        isValid = false;
    } else {
        setFieldValidation(emailInput, true);
    }

    // Password (required only)
    if (!VALIDATION_PATTERNS.password.test(passInput.value.trim())) {
        setFieldValidation(passInput, false);
        isValid = false;
    } else {
        setFieldValidation(passInput, true);
    }

    return isValid;
}

// ============================================================================
// EVENTS
// ============================================================================

// Button Click Event
document.getElementById('btnClientLogin').addEventListener('click', function (e) {
    e.preventDefault();

    if (!validateLoginForm()) {
        return;
    }

    // Optional: loading state
    const btn = document.getElementById('btnClientLogin');
    btn.disabled = true;

    const formData = {
        email: document.getElementById('txtClientEmail').value,
        password: document.getElementById('txtClientPassword').value
    };

    fetch('../api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Login Successful',
                    confirmButtonColor: '#174593'
                }).then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: data.message || 'Invalid email or password.',
                    confirmButtonColor: '#174593'
                });
            }
        })
        .catch(() => {
            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Unable to connect to the server. Please try again later.',
                confirmButtonColor: '#174593'
            });
        })
});

// Enter key support
document.getElementById('clientLoginForm').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnClientLogin').click();
    }
}); 

// Show / hide password
document.getElementById('toggleClientPassword').addEventListener('change', function () {
    const passwordInput = document.getElementById('txtClientPassword');
    passwordInput.type = this.checked ? 'text' : 'password';
}); 
