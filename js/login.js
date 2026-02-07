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
                window.location.href = '../register.html';
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
    .catch(error => {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Unable to connect to the server.',
            confirmButtonColor: '#174593'
        });
    });
}
