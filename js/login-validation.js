/**
 * Login Validation Logic
 * Shared between Patient (index.html) and Volunteer (vol-login.html)
 */

/**
 * Validate login form fields using Hope UI/Bootstrap classes
 * @param {HTMLInputElement} emailInput - The actual <input> element (NOT just the value string)
 * @param {HTMLInputElement} passwordInput - The actual <input> element
 * @returns {boolean} - True if validation passes
 */

function validateLoginForm(emailInput, passwordInput) {
    let isValid = true;

    // Reset visual classes and screen reader tags
    emailInput.classList.remove('is-invalid', 'is-valid');
    passwordInput.classList.remove('is-invalid', 'is-valid');
    emailInput.removeAttribute('aria-invalid');
    passwordInput.removeAttribute('aria-invalid');

    // Get values from the elements
    const email = emailInput.value.replace(/\s/g, '');
    const password = passwordInput.value.replace(/\s/g, '');

    // Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        // Shows red text under input
        emailInput.classList.add('is-invalid'); 
        emailInput.setAttribute('aria-invalid', 'true');
        isValid = false;
    } else {
        emailInput.classList.remove('is-invalid');
    }

    // Validate Password Length (Min 6 chars)
    if (!password || password.length < 6) {
        passwordInput.classList.add('is-invalid'); 
        passwordInput.setAttribute('aria-invalid', 'true');
        isValid = false;
    } else {
       passwordInput.classList.remove('is-invalid');
    }

    return isValid;
}

/**
 * CLIENT LOGIN PAGE LOGIC
 */
document.addEventListener('DOMContentLoaded', function() {
    const clientForm = document.getElementById('clientLoginForm');

    // Only run on index.html
    if (clientForm) {
        clientForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            if (validateLoginForm(emailInput, passwordInput)) {
                 alert('Login successful');
                 // clientForm.submit(); // Uncomment when ready to connect to PHP
            }
        });

        // Allow Enter key to submit from input fields
        const formInputs = clientForm.querySelectorAll('input');
        formInputs.forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clientForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            });
        });
    }
});