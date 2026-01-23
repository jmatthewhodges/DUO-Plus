/**
 * Validate login form fields using Hope UI/Bootstrap classes
 * @param {HTMLInputElement} emailInput - The email input element
 * @param {HTMLInputElement} passwordInput - The password input element
 * @returns {boolean} True if validation passes
 */
function validateLoginForm(emailInput, passwordInput) {
    let isValid = true;

    // Reset validation states
    [emailInput, passwordInput].forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
        input.removeAttribute('aria-invalid');
    });

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate email format
    if (!email || !email.includes('@') || !email.includes('.')) {
        emailInput.classList.add('is-invalid');
        emailInput.setAttribute('aria-invalid', 'true');
        isValid = false;
    }

    // Validate password length (minimum 6 characters)
    if (!password || password.length < 6) {
        passwordInput.classList.add('is-invalid');
        passwordInput.setAttribute('aria-invalid', 'true');
        isValid = false;
    }

    return isValid;
}

/**
 * Create form submission handler
 * @param {Function} submitFunction - Function to call on form submission
 * @param {string} emailInputId - ID of email input
 * @param {string} passwordInputId - ID of password input
 * @param {HTMLElement} errorDiv - Error message container (optional)
 * @returns {Function} Event handler function
 */
function createSubmitHandler(submitFunction, emailInputId, passwordInputId, errorDiv = null) {
    return function (e) {
        e.preventDefault();

        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        const emailInput = document.getElementById(emailInputId);
        const passwordInput = document.getElementById(passwordInputId);

        if (!validateLoginForm(emailInput, passwordInput)) {
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        submitFunction(email, password, errorDiv).catch(error => {
            console.error('Login submission error:', error);
            const errorMessage = 'An error occurred during login. Please try again.';
            errorDiv ? showError(errorMessage, errorDiv) : alert(errorMessage);
        });
    };
}

/**
 * Initialize login form handlers when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function () {
    // ------------ Client Login Form Handling ------------
    const clientLoginBtn = document.getElementById('btnClientLogin');
    const clientEmailInput = document.getElementById('txtClientEmail');
    const clientPasswordInput = document.getElementById('txtClientPassword');
    const clientPasswordToggle = document.getElementById('toggleClientPassword');

    if (clientLoginBtn && clientEmailInput && clientPasswordInput) {
        // Direct click handler for client login button
        clientLoginBtn.addEventListener('click', () => {
            if (!validateLoginForm(clientEmailInput, clientPasswordInput)) {
                return;
            }
            const email = clientEmailInput.value.trim();
            const password = clientPasswordInput.value.trim();
            submitClientLogin(email, password);
        });

        // Enter key support
        clientEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clientLoginBtn.click();
            }
        });
        clientPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clientLoginBtn.click();
            }
        });
    }

    // Client password visibility toggle
    if (clientPasswordInput && clientPasswordToggle) {
        clientPasswordToggle.addEventListener('change', () => {
            clientPasswordInput.type = clientPasswordToggle.checked ? 'text' : 'password';
        });
    }

    // ------------ Volunteer Login Form Handling ------------
    const volLoginBtn = document.getElementById('btnVolLogin');
    const volEmailInput = document.getElementById('txtVolEmail');
    const volPasswordInput = document.getElementById('txtVolPassword');
    const volPasswordToggle = document.getElementById('toggleVolPassword');
    const errorDiv = document.getElementById('errorMessage');

    if (volLoginBtn && volEmailInput && volPasswordInput) {
        const volSubmitHandler = createSubmitHandler(submitVolunteerLogin, 'txtVolEmail', 'txtVolPassword', errorDiv);
        volLoginBtn.addEventListener('click', volSubmitHandler);
        volEmailInput.addEventListener('keypress', (e) => e.key === 'Enter' && volSubmitHandler(e));
        volPasswordInput.addEventListener('keypress', (e) => e.key === 'Enter' && volSubmitHandler(e));
    }

    // Volunteer password visibility toggle
    if (volPasswordInput && volPasswordToggle) {
        volPasswordToggle.addEventListener('change', () => {
            volPasswordInput.type = volPasswordToggle.checked ? 'text' : 'password';
        });
    }
});

/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password as hex string
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Process login response from server
 * @param {Response} response - Fetch API response
 * @returns {Promise<Object>} Parsed JSON data
 */
async function processLoginResponse(response) {
    const responseText = await response.text();

    try {
        return JSON.parse(responseText);
    } catch (jsonError) {
        console.error('Invalid JSON response:', responseText);
        throw new Error('Server returned an invalid response. Please check the server logs.');
    }
}

/**
 * Submit client login request to server
 * @param {string} email - User email
 * @param {string} password - User password (will be hashed before sending)
 */
async function submitClientLogin(email, password) {
    try {
        const form = document.getElementById('clientLoginForm');
        const actionUrl = form.getAttribute('action');
        const hashedPassword = await hashPassword(password);

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password_hash', hashedPassword);

        const response = await fetch(actionUrl, {
            method: 'POST',
            body: formData
        });

        const data = await processLoginResponse(response);

        if (!response.ok) {
            throw new Error(data.message || 'Network response was not ok');
        }

        if (data.success) {
            handleLoginSuccess(data);
        } else {
            showError(data.message || 'Login failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('Login error:', error);

        const errorMessage = error.message.includes('invalid response')
            ? 'Server error. Please contact administrator if the problem persists.'
            : error.message || 'An error occurred during login. Please try again.';

        showError(errorMessage);
    }
}

/**
 * Submit volunteer login request to server
 * @param {string} email - User email
 * @param {string} password - User password (will be hashed before sending)
 * @param {HTMLElement} errorDiv - Error message container
 */
async function submitVolunteerLogin(email, password, errorDiv) {
    try {
        // Show loading spinner
        const loginBtn = document.getElementById('btnVolLogin');
        const loadingBtn = document.getElementById('btnVolLoading');
        if (loginBtn && loadingBtn) {
            loginBtn.style.display = 'none';
            loadingBtn.style.display = 'block';
        }

        const form = document.getElementById('volunteerLoginForm');
        const actionUrl = form.getAttribute('action');
        const hashedPassword = await hashPassword(password);

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password_hash', hashedPassword);

        const response = await fetch(actionUrl, {
            method: 'POST',
            body: formData
        });

        const data = await processLoginResponse(response);

        if (!response.ok) {
            throw new Error(data.message || 'Network response was not ok');
        }

        if (data.success) {
            handleLoginSuccess(data);
        } else {
            const loginBtn = document.getElementById('btnVolLogin');
            const loadingBtn = document.getElementById('btnVolLoading');
            if (loginBtn && loadingBtn) {
                loginBtn.style.display = 'block';
                loadingBtn.style.display = 'none';
            }
            showError(data.message || 'Login failed. Please check your credentials.', errorDiv);
        }
    } catch (error) {
        console.error('Login error:', error);

        const loginBtn = document.getElementById('btnVolLogin');
        const loadingBtn = document.getElementById('btnVolLoading');
        if (loginBtn && loadingBtn) {
            loginBtn.style.display = 'block';
            loadingBtn.style.display = 'none';
        }

        const errorMessage = error.message.includes('invalid response')
            ? 'Server error. Please contact administrator if the problem persists.'
            : error.message || 'An error occurred during login. Please try again.';

        showError(errorMessage, errorDiv);
    }
}

/**
 * Handle successful login
 * @param {Object} data - Response data from server
 */
function handleLoginSuccess(data) {
    Swal.fire({
        title: 'Login Successful!',
        text: 'Redirecting to dashboard...',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
    }).then(() => {
        // --- Reset button state and clear password in case user returns ---
        const loginBtn = document.getElementById('btnVolLogin');
        const loadingBtn = document.getElementById('btnVolLoading');
        const volPasswordInput = document.getElementById('txtVolPassword');
        if (loginBtn && loadingBtn) {
            loginBtn.style.display = 'block';
            loadingBtn.style.display = 'none';
        }
        if (volPasswordInput) {
            volPasswordInput.value = '';
        }
        window.location.href = data.redirect || '../pages/volunteer-dashboard.php';
    });
}

/**
 * Display error message
 * @param {string} message - Error message to display
 * @param {HTMLElement} errorDiv - Error message container
 */
function showError(message, errorDiv) {
    // Clear input fields on error
    const clearInputs = () => {
        const volPasswordInput = document.getElementById('txtVolPassword');
        const clientPasswordInput = document.getElementById('txtClientPassword');

        if (volPasswordInput) volPasswordInput.value = '';
        if (clientPasswordInput) clientPasswordInput.value = '';

        // Reset password toggle switches
        const volPasswordToggle = document.getElementById('toggleVolPassword');
        const clientPasswordToggle = document.getElementById('toggleClientPassword');
        if (volPasswordToggle) volPasswordToggle.checked = false;
        if (clientPasswordToggle) clientPasswordToggle.checked = false;

        // Reset password fields to type="password"
        if (volPasswordInput) volPasswordInput.type = 'password';
        if (clientPasswordInput) clientPasswordInput.type = 'password';
    };

    // Use SweetAlert for volunteer login errors
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Login Failed',
            text: message,
            icon: 'error',
            confirmButtonText: 'Try Again',
            confirmButtonColor: '#174593'
        }).then(() => {
            clearInputs();
        });
    } else if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        clearInputs();
    } else {
        console.error('Login error:', message);
        alert(message);
        clearInputs();
    }
}