// ============================================================================
// CONFIG
// ============================================================================

//There was some stuff about transitions let me know if I need to include them!

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

// Submit
document.getElementById('clientLoginForm').addEventListener('submit', function (e) {
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
            btn.disabled = false;
            if (data.success) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Login Successful',
                        confirmButtonColor: '#174593'
                    }).then(() => {
                        window.location.href = 'index.html';
                    });
                } else {
                    window.location.href = 'index.html';
                }
            } else {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Login Failed',
                        text: data.message || 'Invalid email or password.',
                        confirmButtonColor: '#174593'
                    });
                } else {
                    alert(data.message || 'Login failed.');
                }
            }
        })
        .catch(() => {
            btn.disabled = false;
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Connection Error',
                    text: 'Unable to connect to the server. Please try again later.',
                    confirmButtonColor: '#174593'
                });
            } else {
                alert('Connection error.');
            }
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

// Check for error codes in URL and show alert if present
const params = new URLSearchParams(window.location.search);

const errors = {
    "1": "Invalid Email and or password",
    "2": "Invalid Email format",
    "3": "Database connection error",
    "4": "Method not allowed",
    "5": "missing email parameter",
    "6": "Server error",
    "7": "Password parameter error"
};

if (params.has("error")) {
    Swal.fire("Error", errors[params.get("error")] || "Unknown error", "error");
}
