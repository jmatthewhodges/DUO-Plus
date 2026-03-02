/**
 * ============================================================
 *  File:        login.js
 *  Purpose:     Handles login form validation, authentication
 *               via the login API, and password visibility
 *               toggle functionality.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 26 @ 9:51 PM
 *  Changes Made:      Changed input validation to use SweetAlert
 * ============================================================
 */

// Config
const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    password: /.+/ // login just checks presence (not strength)
};

// Events

// Blur handlers — green checkmark on valid input
document.getElementById('txtClientEmail').addEventListener('blur', function () {
    if (VALIDATION_PATTERNS.email.test(this.value.trim())) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid');
        this.classList.remove('is-invalid');
    }
});

document.getElementById('txtClientPassword').addEventListener('blur', function () {
    if (VALIDATION_PATTERNS.password.test(this.value.trim())) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid');
        this.classList.remove('is-invalid');
    }
});

// Login button click
document.getElementById('btnClientLogin').addEventListener('click', function (e) {
    e.preventDefault();

    const emailInput = document.getElementById('txtClientEmail');
    const passInput = document.getElementById('txtClientPassword');
    const errors = [];

    if (!VALIDATION_PATTERNS.email.test(emailInput.value.trim())) {
        errors.push('Please enter a valid email address.');
    }

    if (!VALIDATION_PATTERNS.password.test(passInput.value.trim())) {
        errors.push('Please enter your password.');
    }

    if (errors.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Check your info',
            html: errors.map(e => `• ${e}`).join('<br>'),
            confirmButtonColor: '#174593'
        });
        return;
    }

    // Loading state
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...`;

    const email = emailInput.value;
    const password = passInput.value;

    // Send login request to API
    fetch('../api/Login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Welcome Back!',
                    html: `Hello, <strong>${data.data.FirstName}</strong>! Redirecting you now...`,
                    timer: 1500,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false
                }).then(() => {
                    // Pass clientID via URL — no session storage needed
                    window.location.href = `pages/register.html?clientID=${data.data.ClientID}`;
                });
            } else {
                // Failed - clear password and show error
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
