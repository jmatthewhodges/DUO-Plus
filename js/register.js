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
 * @param {number} stepNumber - Step number to show (1, 2, or 3)
 */
function showStep(stepNumber) {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const stepCircle1 = document.getElementById('stepCircle1');
    const stepCircle2 = document.getElementById('stepCircle2');
    const stepCircle3 = document.getElementById('stepCircle3');
    const stepLine1 = document.getElementById('stepLine1');
    const stepLine2 = document.getElementById('stepLine2');
    
    const footerSection = document.getElementById('footerSection');
    const lifeLogo = document.getElementById('lifeLogo');
    
    // Hide all steps first
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';
    
    if (stepNumber === 1) {
        // Show step 1, hide step 2 and 3
        if (step1) step1.style.display = 'block';
        
        // Update progress indicator
        stepCircle1.classList.add('active');
        stepCircle1.classList.remove('completed');
        stepCircle2.classList.remove('active', 'completed');
        stepCircle3.classList.remove('active', 'completed');
        stepLine1.classList.remove('completed');
        stepLine2.classList.remove('completed');
        
        // Show footer during step 1
        if (footerSection) footerSection.style.display = 'block';
        if (lifeLogo) lifeLogo.style.display = 'block';
        
    } else if (stepNumber === 2) {
        // Hide step 1 and 3, show step 2
        if (step2) step2.style.display = 'block';
        
        // Update progress indicator
        stepCircle1.classList.remove('active');
        stepCircle1.classList.add('completed');
        stepCircle2.classList.add('active');
        stepCircle2.classList.remove('completed');
        stepCircle3.classList.remove('active', 'completed');
        stepLine1.classList.add('completed');
        stepLine2.classList.remove('completed');
        
        // Hide footer during step 2
        if (footerSection) footerSection.style.display = 'none';
        if (lifeLogo) lifeLogo.style.display = 'none';
        
    } else if (stepNumber === 3) {
        // Hide step 1 and 2, show step 3
        if (step3) step3.style.display = 'block';
        
        // Update progress indicator
        stepCircle1.classList.remove('active');
        stepCircle1.classList.add('completed');
        stepCircle2.classList.remove('active');
        stepCircle2.classList.add('completed');
        stepCircle3.classList.add('active');
        stepLine1.classList.add('completed');
        stepLine2.classList.add('completed');
        
        // Hide footer during step 3
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
 * Validate section 2 form fields
 */
function validateStep2Form() {
    let isValid = true;
    
    const firstNameInput = document.getElementById('txtFirstName');
    const middleInitialInput = document.getElementById('txtMiddleInitial');
    const lastNameInput = document.getElementById('txtLastName');
    const sexSelect = document.getElementById('selectSex');
    const dobInput = document.getElementById('txtDOB');
    const phoneInput = document.getElementById('txtPhoneNumber');
    
    // Validate First Name
    if (!firstNameInput.value.trim()) {
        firstNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        firstNameInput.classList.remove('is-invalid');
        firstNameInput.classList.add('is-valid');
    }
    
    // Middle Initial (optional, but add valid class for visual consistency)
    middleInitialInput.classList.remove('is-invalid');
    middleInitialInput.classList.add('is-valid');
    
    // Validate Last Name
    if (!lastNameInput.value.trim()) {
        lastNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        lastNameInput.classList.remove('is-invalid');
        lastNameInput.classList.add('is-valid');
    }
    
    // Validate Sex
    if (!sexSelect.value) {
        sexSelect.classList.add('is-invalid');
        isValid = false;
    } else {
        sexSelect.classList.remove('is-invalid');
        sexSelect.classList.add('is-valid');
    }
    
    // Validate DOB
    if (!dobInput.value) {
        dobInput.classList.add('is-invalid');
        isValid = false;
    } else {
        dobInput.classList.remove('is-invalid');
        dobInput.classList.add('is-valid');
    }
    
    // Phone Number (optional, but validate format if provided)
    const phoneValue = phoneInput.value.trim();
    if (phoneValue) {
        // Validate phone number format (XXX) XXX-XXXX
        const digitsOnly = phoneValue.replace(/\D/g, '');
        if (digitsOnly.length !== 10) {
            phoneInput.classList.add('is-invalid');
            isValid = false;
        } else {
            phoneInput.classList.remove('is-invalid');
            phoneInput.classList.add('is-valid');
        }
    } else {
        // Empty is valid since it's optional
        phoneInput.classList.remove('is-invalid');
        phoneInput.classList.add('is-valid');
    }
    
    return isValid;
}

function goBackToStep2() {
    showStep(2);
}

// Navigate back to step 1
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
    const step2NextBtn = document.getElementById('btnStep2Next');
    const step3BackBtn = document.getElementById('btnStep3Back');
    const step3SubmitBtn = document.getElementById('btnStep3Submit');
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
    
    // Initialize Air Datepicker for DOB field (supports local v3 or fallback v2)
    const dobInput = document.getElementById('txtDOB');
    let dobPicker = null;
    if (dobInput && typeof AirDatepicker !== 'undefined') {
        // English locale fallback (avoids default RU text if locale file not present)
        const englishLocale = {
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            daysMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            today: 'Today',
            clear: 'Clear',
            dateFormat: 'MM/dd/yyyy',
            timeFormat: 'hh:mm aa',
            firstDay: 0
        };

        const opts = {
            autoClose: true,
            dateFormat: 'MM/dd/yyyy',
            maxDate: new Date(),
            keyboardNav: true,
            selectedDates: dobInput.value ? [new Date(dobInput.value)] : [],
            onSelect({ formattedDate }) {
                dobInput.value = formattedDate || '';
            }
        };
        if (AirDatepicker.locales && AirDatepicker.locales.en) {
            opts.locale = AirDatepicker.locales.en;
        } else {
            opts.locale = englishLocale;
        }
        dobPicker = new AirDatepicker(dobInput, opts);
        window.dobPicker = dobPicker;
    } else if (dobInput && typeof Datepicker !== 'undefined') {
        dobPicker = new Datepicker(dobInput, {
            autoClose: true,
            dateFormat: 'MM/dd/yyyy',
            maxDate: new Date(),
            keyboardNav: true,
            language: 'en',
            selectedDates: dobInput.value ? [new Date(dobInput.value)] : [],
            onSelect({ formattedDate }) {
                dobInput.value = formattedDate || '';
            }
        });
        window.dobPicker = dobPicker;
    } else if (dobInput) {
        console.warn('Air Datepicker not loaded.');
    }
    
    // Phone number formatting
    const phoneInput = document.getElementById('txtPhoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            // Remove all non-digit characters
            let value = e.target.value.replace(/\D/g, '');
            
            // Limit to 10 digits
            value = value.substring(0, 10);
            
            // Format as (XXX) XXX-XXXX
            let formattedValue = '';
            if (value.length > 0) {
                formattedValue = '(' + value.substring(0, 3);
                if (value.length >= 3) {
                    formattedValue += ') ' + value.substring(3, 6);
                }
                if (value.length >= 6) {
                    formattedValue += '-' + value.substring(6, 10);
                }
            }
            
            e.target.value = formattedValue;
        });
    }
    
    // Step 2: Back button handler
    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', () => {
            goBackToStep1();
        });
    }
    
    // Step 2: Next button handler (proceed to step 3)
    if (step2NextBtn) {
        step2NextBtn.addEventListener('click', () => {
            if (!validateStep2Form()) {
                return;
            }
            showStep(3);
        });
    }
    
    // Step 3: Back button handler
    if (step3BackBtn) {
        step3BackBtn.addEventListener('click', () => {
            goBackToStep2();
        });
    }
    
    // Step 3: Address checkbox toggle
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
    
    // Step 3: Submit button handler (placeholder for now)
    if (step3SubmitBtn) {
        step3SubmitBtn.addEventListener('click', () => {
            // TODO: Add step 3 validation and final submission
            console.log('Step 3 submit - to be implemented');
        });
    }
    
    // Password visibility toggle
    if (passwordInput && passwordToggle) {
        passwordToggle.addEventListener('change', () => {
            passwordInput.type = passwordToggle.checked ? 'text' : 'password';
        });
    }
});
