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
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i,
    password: /.+/ // login just checks presence (not strength)
};

// Helper to get current language translations
function getLang() {
    var lang = sessionStorage.getItem("lang") || "en";
    return translations[lang];
}

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
    const t = getLang();

    const emailValid = VALIDATION_PATTERNS.email.test(emailInput.value.trim());
    const passValid = VALIDATION_PATTERNS.password.test(passInput.value.trim());

    if (!emailValid) {
        errors.push(t.loginValidEmail);
        emailInput.classList.add('is-invalid');
        emailInput.classList.remove('is-valid');
        emailInput.setAttribute('aria-invalid', 'true');
    } else {
        emailInput.classList.remove('is-invalid');
        emailInput.removeAttribute('aria-invalid');
    }

    if (!passValid) {
        errors.push(t.loginEnterPassword);
        passInput.classList.add('is-invalid');
        passInput.classList.remove('is-valid');
        passInput.setAttribute('aria-invalid', 'true');
    } else {
        passInput.classList.remove('is-invalid');
        passInput.removeAttribute('aria-invalid');
    }

    if (errors.length > 0) {
        Swal.fire({
            icon: 'error',
            title: t.checkYourInfo,
            html: errors.map(e => `• ${e}`).join('<br>'),
            confirmButtonColor: '#174593'
        });
        return;
    }

    // Loading state
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${t.loggingIn}`;

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
                    title: t.loginWelcomeTitle,
                    html: `${t.loginWelcomeHello}<strong>${data.data.FirstName}</strong>${t.loginWelcomeRedirect}`,
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
                passInput.removeAttribute('aria-invalid');

                Swal.fire({
                    icon: 'error',
                    title: t.loginFailedTitle,
                    text: data.message || t.loginFailedText,
                    confirmButtonColor: '#174593'
                });
            }
        })
        .catch(error => {
            // Network or server error
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: t.loginConnectionErrorTitle,
                text: t.loginConnectionErrorText,
                confirmButtonColor: '#174593'
            });
        })
        .finally(() => {
            // Re-enable button after request completes
            btn.disabled = false;
            btn.innerHTML = t.btnClientLogin || 'Login';
        })
});

// Clear invalid state as soon as the user starts correcting a field
document.getElementById('txtClientEmail').addEventListener('input', function () {
    this.classList.remove('is-invalid');
    this.removeAttribute('aria-invalid');
});

document.getElementById('txtClientPassword').addEventListener('input', function () {
    this.classList.remove('is-invalid');
    this.removeAttribute('aria-invalid');
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
