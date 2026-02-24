/**
 * ============================================================
 *  File:        login.js
 *  Description: Handles login form validation, authentication
 *               via the login API, and password visibility
 *               toggle functionality.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 18 @ 2:48 PM
 *  Changes Made:      Added multi-line comment header and cleaned up code
 * ============================================================
*/

// Config
const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    password: /.+/ // login just checks presence (not strength)
};

// Adds or removes Bootstrap validation classes
function setFieldValidation(field, isValid) {
    if (isValid) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    } else {
        field.classList.remove('is-valid');
        field.classList.add('is-invalid');
    }
}

// Login validation
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

    // Password
    if (!VALIDATION_PATTERNS.password.test(passInput.value.trim())) {
        setFieldValidation(passInput, false);
        isValid = false;
    } else {
        setFieldValidation(passInput, true);
    }

    return isValid;
}

// Events

// Login button click
document.getElementById('btnClientLogin').addEventListener('click', function (e) {
    e.preventDefault();

    if (!validateLoginForm()) {
        return;
    }

    // Loading state
    const btn = document.getElementById('btnClientLogin');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...`;

    const email = document.getElementById('txtClientEmail').value;
    const password = document.getElementById('txtClientPassword').value;

    // Send login request to API
    fetch('../api/Login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Save user data and redirect
                sessionStorage.setItem('userData', JSON.stringify(data.data));

                Swal.fire({
                    icon: 'success',
                    title: 'Welcome Back!',
                    html: `Hello, <strong>${data.data.FirstName}</strong>! Redirecting you now...`,
                    timer: 2000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false
                }).then(() => {
                    window.location.href = 'pages/register.html';
                });
            } else {
                // Failed - clear password and show error
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
            // Network or server error
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Unable to connect to the server.',
                confirmButtonColor: '#174593'
            });
        })
        .finally(() => {
            // Re-enable button after request completes
            btn.disabled = false;
            btn.innerHTML = 'Login';
        })
});

// Show/hide password checkbox
document.getElementById('toggleClientPassword').addEventListener('change', function () {
    const passwordInput = document.getElementById('txtClientPassword');
    passwordInput.type = this.checked ? 'text' : 'password';
});

// Enter key on email field triggers login
document.getElementById('txtClientEmail').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnClientLogin').click();
    }
});

// Enter key on password field triggers login
document.getElementById('txtClientPassword').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnClientLogin').click();
    }
});
