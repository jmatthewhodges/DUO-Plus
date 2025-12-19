/**
 * Validate registration form fields using Hope UI/Bootstrap classes
 * @param {HTMLInputElement} emailInput - The email input element
 * @param {HTMLInputElement} passwordInput - The password input element
 * @returns {boolean} True if validation passes
 */
function validateRegisterForm(emailInput, passwordInput) {
    let isValid = true;

    // Reset validation states
    [emailInput, passwordInput].forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
        input.removeAttribute('aria-invalid');
    });

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate email format with comprehensive checks
    const emailError = validateEmail(email);
    if (emailError) {
        emailInput.classList.add('is-invalid');
        emailInput.setAttribute('aria-invalid', 'true');
        const errorDiv = document.getElementById('emailError');
        if (errorDiv) {
            errorDiv.textContent = emailError;
        }
        isValid = false;
    } else {
        emailInput.classList.add('is-valid');
    }

    // Validate password with comprehensive strength checks
    const passwordError = validatePassword(password);
    if (passwordError) {
        passwordInput.classList.add('is-invalid');
        passwordInput.setAttribute('aria-invalid', 'true');
        const errorDiv = document.getElementById('passwordError');
        if (errorDiv) {
            errorDiv.textContent = passwordError;
        }
        isValid = false;
    } else {
        passwordInput.classList.add('is-valid');
    }

    return isValid;
}

/**
 * Validate email address with industry-standard checks
 * @param {string} email - Email address to validate
 * @returns {string|null} Error message or null if valid
 */
function validateEmail(email) {
    // Check if email is empty
    if (!email) {
        return 'Email address is required.';
    }

    // Check minimum length
    if (email.length < 3) {
        return 'Email address is too short.';
    }

    // Check maximum length (RFC 5321)
    if (email.length > 254) {
        return 'Email address is too long (maximum 254 characters).';
    }

    // Comprehensive email regex following RFC 5322 standards
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]*[a-zA-Z0-9]@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
        // Check for common mistakes
        if (!email.includes('@')) {
            return 'Email must contain an @ symbol.';
        }
        if (!email.includes('.')) {
            return 'Email must contain a domain (e.g., gmail.com).';
        }
        if (email.indexOf('@') !== email.lastIndexOf('@')) {
            return 'Email can only contain one @ symbol.';
        }
        if (email.startsWith('@')) {
            return 'Email cannot start with @.';
        }
        if (email.endsWith('@')) {
            return 'Email must include a domain after @.';
        }
        if (email.includes('..')) {
            return 'Email cannot contain consecutive dots.';
        }
        if (email.includes(' ')) {
            return 'Email cannot contain spaces.';
        }
        const parts = email.split('@');
        if (parts[1] && !parts[1].includes('.')) {
            return 'Domain must include a period (e.g., gmail.com).';
        }
        if (parts[1] && parts[1].endsWith('.')) {
            return 'Domain cannot end with a period.';
        }
        return 'Please enter a valid email address (e.g., user@example.com).';
    }

    // Validate local part (before @)
    const localPart = email.split('@')[0];
    if (localPart.length > 64) {
        return 'The part before @ is too long (maximum 64 characters).';
    }

    return null; // Email is valid
}

/**
 * Validate password with industry-standard security requirements
 * @param {string} password - Password to validate
 * @returns {string|null} Error message or null if valid
 */
function validatePassword(password) {
    // Check if password is empty
    if (!password) {
        return 'Password is required.';
    }

    // Check minimum length (industry standard: 8-12 characters)
    if (password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }

    // Check maximum length for security (prevents DoS attacks)
    if (password.length > 128) {
        return 'Password is too long (maximum 128 characters).';
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
        return 'Password must include at least one lowercase letter (a-z).';
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        return 'Password must include at least one uppercase letter (A-Z).';
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
        return 'Password must include at least one number (0-9).';
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return 'Password must include at least one special character (!@#$%^&*...).';
    }

    // Check for common weak passwords
    const commonPasswords = [
        'password', 'password1', 'password123', '12345678', 'qwerty', 'abc123',
        'letmein', 'welcome', 'monkey', '1234567890', 'password1234'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
        return 'This password is too common. Please choose a more unique password.';
    }

    // Check for repeating characters (e.g., "aaaa", "1111")
    if (/([a-zA-Z0-9])\1{3,}/.test(password)) {
        return 'Password cannot contain more than 3 consecutive identical characters.';
    }

    // Check for sequential characters (e.g., "1234", "abcd")
    const sequenceRegex = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/i;
    if (sequenceRegex.test(password)) {
        return 'Password cannot contain sequential characters (e.g., 1234, abcd).';
    }

    return null; // Password is valid
}

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
 * Save registration step 1 data and proceed to next step
 * @param {string} email - User email
 * @param {string} password - User password (will be hashed before storing)
 */
async function proceedToNextStep(email, password) {
    try {
        // Hash password before storing
        const hashedPassword = await hashPassword(password);
        
        // Store step 1 data in sessionStorage
        const registrationData = {
            email: email,
            password_hash: hashedPassword,
            step: 1,
            timestamp: new Date().toISOString()
        };
        
        sessionStorage.setItem('registrationData', JSON.stringify(registrationData));
        
        // Move to step 2
        showStep(2);
        
    } catch (error) {
        console.error('Error saving registration data:', error);
        showError('An error occurred. Please try again.');
    }
}

/**
 * Show specific registration step
 * @param {number} stepNumber - Step number to show (1 or 2)
 */
function showStep(stepNumber) {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const stepCircle1 = document.getElementById('stepCircle1');
    const stepCircle2 = document.getElementById('stepCircle2');
    const stepLine1 = document.getElementById('stepLine1');
    
    const footerSection = document.getElementById('footerSection');
    const lifeLogo = document.getElementById('lifeLogo');
    
    if (stepNumber === 1) {
        // Show step 1, hide step 2
        step1.style.display = 'block';
        step2.style.display = 'none';
        
        // Update progress indicator
        stepCircle1.classList.add('active');
        stepCircle1.classList.remove('completed');
        stepCircle2.classList.remove('active');
        stepLine1.classList.remove('completed');
        
        // Show footer during step 1
        if (footerSection) footerSection.style.display = 'block';
        if (lifeLogo) lifeLogo.style.display = 'block';
        
    } else if (stepNumber === 2) {
        // Hide step 1, show step 2
        step1.style.display = 'none';
        step2.style.display = 'block';
        
        // Update progress indicator
        stepCircle1.classList.remove('active');
        stepCircle1.classList.add('completed');
        stepCircle2.classList.add('active');
        stepLine1.classList.add('completed');
        
        // Hide footer during step 2 to save space
        if (footerSection) footerSection.style.display = 'none';
        if (lifeLogo) lifeLogo.style.display = 'none';
    }
    
    // Scroll to top of card
    const card = document.querySelector('.card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Go back to previous step
 */
function goBackToStep1() {
    showStep(1);
}

/**
 * Display error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Clear password field on error
    const passwordInput = document.getElementById('txtRegClientPassword');
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.type = 'password';
    }
    
    const passwordToggle = document.getElementById('toggleClientPassword');
    if (passwordToggle) {
        passwordToggle.checked = false;
    }
    
    // Use SweetAlert if available
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Registration Failed',
            text: message,
            icon: 'error',
            confirmButtonText: 'Try Again',
            confirmButtonColor: '#174593'
        });
    } else {
        alert(message);
    }
}

/**
 * Initialize registration form handlers when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    const step1NextBtn = document.getElementById('btnStep1Next');
    const step2BackBtn = document.getElementById('btnStep2Back');
    const step2SubmitBtn = document.getElementById('btnStep2Submit');
    const emailInput = document.getElementById('txtRegClientEmail');
    const passwordInput = document.getElementById('txtRegClientPassword');
    const passwordToggle = document.getElementById('toggleClientPassword');
    
    // Step 1: Next button handler
    if (step1NextBtn && emailInput && passwordInput) {
        step1NextBtn.addEventListener('click', () => {
            if (!validateRegisterForm(emailInput, passwordInput)) {
                return;
            }
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            proceedToNextStep(email, password);
        });
        
        // Enter key support for step 1
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                step1NextBtn.click();
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                step1NextBtn.click();
            }
        });
    }
    
    // Step 2: Back button handler
    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', () => {
            goBackToStep1();
        });
    }
    
    // Step 2: Address checkbox toggle
    const chkNoAddress = document.getElementById('chkNoAddress');
    const addressFields = document.getElementById('addressFields');
    if (chkNoAddress && addressFields) {
        chkNoAddress.addEventListener('change', () => {
            const shouldHide = chkNoAddress.checked;
            addressFields.style.display = shouldHide ? 'none' : 'block';
            
            // Toggle required attribute on address fields
            const addressInputs = addressFields.querySelectorAll('input[required]');
            addressInputs.forEach(input => {
                if (shouldHide) {
                    input.removeAttribute('required');
                } else {
                    input.setAttribute('required', '');
                }
            });
        });
    }
    
    // Step 2: Submit button handler (placeholder for now)
    if (step2SubmitBtn) {
        step2SubmitBtn.addEventListener('click', () => {
            // TODO: Add step 2 validation and final submission
            console.log('Step 2 submit - to be implemented');
        });
    }
    
    // Password visibility toggle
    if (passwordInput && passwordToggle) {
        passwordToggle.addEventListener('change', () => {
            passwordInput.type = passwordToggle.checked ? 'text' : 'password';
        });
    }
    
    // Real-time validation feedback
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            if (emailInput.value.trim()) {
                const emailError = validateEmail(emailInput.value.trim());
                const errorDiv = document.getElementById('emailError');
                if (!emailError) {
                    emailInput.classList.remove('is-invalid');
                    emailInput.classList.add('is-valid');
                    emailInput.removeAttribute('aria-invalid');
                } else {
                    emailInput.classList.remove('is-valid');
                    emailInput.classList.add('is-invalid');
                    emailInput.setAttribute('aria-invalid', 'true');
                    if (errorDiv) {
                        errorDiv.textContent = emailError;
                    }
                }
            }
        });
        
        emailInput.addEventListener('input', () => {
            if (emailInput.classList.contains('is-invalid') || emailInput.classList.contains('is-valid')) {
                emailInput.classList.remove('is-invalid', 'is-valid');
                emailInput.removeAttribute('aria-invalid');
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('blur', () => {
            if (passwordInput.value.trim()) {
                const passwordError = validatePassword(passwordInput.value.trim());
                const errorDiv = document.getElementById('passwordError');
                if (!passwordError) {
                    passwordInput.classList.remove('is-invalid');
                    passwordInput.classList.add('is-valid');
                    passwordInput.removeAttribute('aria-invalid');
                } else {
                    passwordInput.classList.remove('is-valid');
                    passwordInput.classList.add('is-invalid');
                    passwordInput.setAttribute('aria-invalid', 'true');
                    if (errorDiv) {
                        errorDiv.textContent = passwordError;
                    }
                }
            }
        });
        
        passwordInput.addEventListener('input', () => {
            if (passwordInput.classList.contains('is-invalid') || passwordInput.classList.contains('is-valid')) {
                passwordInput.classList.remove('is-invalid', 'is-valid');
                passwordInput.removeAttribute('aria-invalid');
            }
        });
    }
});
