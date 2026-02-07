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
    // Disable button and show spinner
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...`;

    const email = document.getElementById('txtClientEmail').value;
    const password = document.getElementById('txtClientPassword').value;

    fetch('../api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Store user data in sessionStorage
            sessionStorage.setItem('userData', JSON.stringify(data.data));

            Swal.fire({
                icon: 'success',
                title: 'Welcome Back!',
                text: `Hello, ${data.data.FirstName}! Redirecting you now...`,
                timer: 3500,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'pages/register.html';
                
            });
        } else {
            // Clear password field and reset validation
            const passInput = document.getElementById('txtClientPassword');
            passInput.value = '';
            passInput.classList.remove('is-valid', 'is-invalid');

            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: data.message || 'Invalid email or password.',
                confirmButtonColor: '#174593'
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Unable to connect to the server.',
            confirmButtonColor: '#174593'
        });
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = 'Login';
    })
});


// ============================================================================
// SHOW / HIDE PASSWORD TOGGLE
// ============================================================================

document.getElementById('toggleClientPassword').addEventListener('change', function () {
    const passwordInput = document.getElementById('txtClientPassword');
    passwordInput.type = this.checked ? 'text' : 'password';
});

// Enter Key on Email or Password
document.getElementById('txtClientEmail').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnClientLogin').click();
    }
});

document.getElementById('txtClientPassword').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnClientLogin').click();
    }
});
