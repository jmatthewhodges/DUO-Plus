/**
 * DUO+ Registration Form - Multi-step form handling, validation, and event management
 */

// ============================================================================
// STEP 1: EMAIL & PASSWORD VALIDATION
// ============================================================================

function validateRegisterForm(emailInput, passwordInput) {
    let isValid = true;

    // Reset validation states
    [emailInput, passwordInput].forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
        input.removeAttribute('aria-invalid');
    });

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
        emailInput.classList.add('is-invalid');
        emailInput.setAttribute('aria-invalid', 'true');
        const errorDiv = document.getElementById('emailError');
        if (errorDiv) errorDiv.textContent = emailError;
        isValid = false;
    } else {
        emailInput.classList.add('is-valid');
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
        passwordInput.classList.add('is-invalid');
        passwordInput.setAttribute('aria-invalid', 'true');
        const errorDiv = document.getElementById('passwordError');
        if (errorDiv) errorDiv.textContent = passwordError;
        isValid = false;
    } else {
        passwordInput.classList.add('is-valid');
    }

    return isValid;
}

function validateEmail(email) {
    if (!email) return 'Email address is required.';
    if (email.length < 3) return 'Email address is too short.';
    if (email.length > 254) return 'Email address is too long (maximum 254 characters).';

    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]*[a-zA-Z0-9]@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
        if (!email.includes('@')) return 'Email must contain an @ symbol.';
        if (!email.includes('.')) return 'Email must contain a domain (e.g., gmail.com).';
        if (email.indexOf('@') !== email.lastIndexOf('@')) return 'Email can only contain one @ symbol.';
        if (email.startsWith('@')) return 'Email cannot start with @.';
        if (email.endsWith('@')) return 'Email must include a domain after @.';
        if (email.includes('..')) return 'Email cannot contain consecutive dots.';
        if (email.includes(' ')) return 'Email cannot contain spaces.';
        
        const parts = email.split('@');
        if (parts[1] && !parts[1].includes('.')) return 'Domain must include a period (e.g., gmail.com).';
        if (parts[1] && parts[1].endsWith('.')) return 'Domain cannot end with a period.';
        return 'Please enter a valid email address (e.g., user@example.com).';
    }

    const localPart = email.split('@')[0];
    if (localPart.length > 64) return 'The part before @ is too long (maximum 64 characters).';

    return null;
}

function validatePassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (password.length > 128) return 'Password is too long (maximum 128 characters).';

    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter (a-z).';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter (A-Z).';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number (0-9).';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return 'Password must include at least one special character (!@#$%^&*...).';
    }

    const commonPasswords = ['password', 'password1', 'password123', '12345678', 'qwerty', 'abc123',
                             'letmein', 'welcome', 'monkey', '1234567890', 'password1234'];
    if (commonPasswords.includes(password.toLowerCase())) {
        return 'This password is too common. Please choose a more unique password.';
    }

    if (/([a-zA-Z0-9])\1{3,}/.test(password)) {
        return 'Password cannot contain more than 3 consecutive identical characters.';
    }

    const sequenceRegex = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/i;
    if (sequenceRegex.test(password)) {
        return 'Password cannot contain sequential characters (e.g., 1234, abcd).';
    }

    return null;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function proceedToNextStep(email, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const registrationData = {
            email: email,
            password_hash: hashedPassword,
            step: 1,
            timestamp: new Date().toISOString()
        };
        sessionStorage.setItem('registrationData', JSON.stringify(registrationData));
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

// ============================================================================
// STEP 2: PERSONAL INFORMATION VALIDATION
// ============================================================================

function validateStep2Form() {
    let isValid = true;
    
    const firstNameInput = document.getElementById('txtFirstName');
    const lastNameInput = document.getElementById('txtLastName');
    const sexSelect = document.getElementById('selectSex');
    const dobInput = document.getElementById('txtDOB');
    const phoneInput = document.getElementById('txtPhoneNumber');

    // First Name
    if (!firstNameInput.value.trim()) {
        firstNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        firstNameInput.classList.remove('is-invalid');
        firstNameInput.classList.add('is-valid');
    }

    // Last Name
    if (!lastNameInput.value.trim()) {
        lastNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        lastNameInput.classList.remove('is-invalid');
        lastNameInput.classList.add('is-valid');
    }

    // Middle Initial (optional)
    const middleInitialInput = document.getElementById('txtMiddleInitial');
    middleInitialInput.classList.remove('is-invalid');
    middleInitialInput.classList.add('is-valid');

    // Sex
    if (!sexSelect.value) {
        sexSelect.classList.add('is-invalid');
        isValid = false;
    } else {
        sexSelect.classList.remove('is-invalid');
        sexSelect.classList.add('is-valid');
    }

    // Date of Birth
    if (!dobInput.value) {
        dobInput.classList.add('is-invalid');
        isValid = false;
    } else {
        dobInput.classList.remove('is-invalid');
        dobInput.classList.add('is-valid');
    }

    // Phone Number (optional, validate format if provided)
    const phoneValue = phoneInput.value.trim();
    if (phoneValue) {
        const digitsOnly = phoneValue.replace(/\D/g, '');
        if (digitsOnly.length !== 10) {
            phoneInput.classList.add('is-invalid');
            isValid = false;
        } else {
            phoneInput.classList.remove('is-invalid');
            phoneInput.classList.add('is-valid');
        }
    } else {
        phoneInput.classList.remove('is-invalid');
        phoneInput.classList.add('is-valid');
    }

    return isValid;
}

// ============================================================================
// STEP 3: ADDRESS INFORMATION VALIDATION
// ============================================================================

/**
 * Validate Step 3 form fields (Address Information)
 * @returns {boolean} True if validation passes
 */
function validateStep3Form() {
    // If user checked "I don't have a permanent address", skip validation
    const chkNoAddress = document.getElementById('chkNoAddress');
    if (chkNoAddress && chkNoAddress.checked) {
        return true;
    }
    
    let isValid = true;
    
    const streetAddressInput = document.getElementById('txtStreetAddress');
    const cityInput = document.getElementById('txtCity');
    const stateInput = document.getElementById('txtState');
    const zipInput = document.getElementById('txtZip');

    // Street Address (required)
    if (!streetAddressInput.value.trim()) {
        streetAddressInput.classList.add('is-invalid');
        isValid = false;
    } else {
        streetAddressInput.classList.remove('is-invalid');
        streetAddressInput.classList.add('is-valid');
    }

    // City (required)
    if (!cityInput.value.trim()) {
        cityInput.classList.add('is-invalid');
        isValid = false;
    } else {
        cityInput.classList.remove('is-invalid');
        cityInput.classList.add('is-valid');
    }

    // State (required)
    if (!stateInput.value) {
        stateInput.classList.add('is-invalid');
        const stateError = document.getElementById('stateError');
        if (stateError) stateError.textContent = 'State is required.';
        isValid = false;
    } else {
        stateInput.classList.remove('is-invalid');
        stateInput.classList.add('is-valid');
    }

    // ZIP Code (required, 5 digits)
    const zipValue = zipInput.value.trim();
    if (!zipValue) {
        zipInput.classList.add('is-invalid');
        const zipError = document.getElementById('zipError');
        if (zipError) zipError.textContent = 'ZIP code is required.';
        isValid = false;
    } else if (!/^\d{5}$/.test(zipValue)) {
        zipInput.classList.add('is-invalid');
        const zipError = document.getElementById('zipError');
        if (zipError) zipError.textContent = 'Enter a valid 5-digit ZIP.';
        isValid = false;
    } else {
        zipInput.classList.remove('is-invalid');
        zipInput.classList.add('is-valid');
    }

    return isValid;
}

// ============================================================================
// STEP NAVIGATION
// ============================================================================

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

    // Hide all steps
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';

    if (stepNumber === 1) {
        if (step1) step1.style.display = 'block';
        stepCircle1.classList.add('active');
        stepCircle1.classList.remove('completed');
        stepCircle2.classList.remove('active', 'completed');
        stepCircle3.classList.remove('active', 'completed');
        stepLine1.classList.remove('completed');
        stepLine2.classList.remove('completed');
        if (footerSection) footerSection.style.display = 'block';
        if (lifeLogo) lifeLogo.style.display = 'block';
    } else if (stepNumber === 2) {
        if (step2) step2.style.display = 'block';
        stepCircle1.classList.remove('active');
        stepCircle1.classList.add('completed');
        stepCircle2.classList.add('active');
        stepCircle2.classList.remove('completed');
        stepCircle3.classList.remove('active', 'completed');
        stepLine1.classList.add('completed');
        stepLine2.classList.remove('completed');
        if (footerSection) footerSection.style.display = 'none';
        if (lifeLogo) lifeLogo.style.display = 'none';
    } else if (stepNumber === 3) {
        if (step3) step3.style.display = 'block';
        stepCircle1.classList.remove('active');
        stepCircle1.classList.add('completed');
        stepCircle2.classList.remove('active');
        stepCircle2.classList.add('completed');
        stepCircle3.classList.add('active');
        stepLine1.classList.add('completed');
        stepLine2.classList.add('completed');
        if (footerSection) footerSection.style.display = 'none';
        if (lifeLogo) lifeLogo.style.display = 'none';
    }

    // Scroll to top
    const card = document.querySelector('.card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function goBackToStep1() {
    showStep(1);
}

function goBackToStep2() {
    showStep(2);
}

function showError(message) {
    const passwordInput = document.getElementById('txtRegClientPassword');
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.type = 'password';
    }
    const passwordToggle = document.getElementById('toggleClientPassword');
    if (passwordToggle) {
        passwordToggle.checked = false;
    }

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

// ============================================================================
// DOM INITIALIZATION & EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    const step1NextBtn = document.getElementById('btnStep1Next');
    const step2BackBtn = document.getElementById('btnStep2Back');
    const step2NextBtn = document.getElementById('btnStep2Next');
    const step3BackBtn = document.getElementById('btnStep3Back');
    const step3SubmitBtn = document.getElementById('btnStep3Submit');
    const emailInput = document.getElementById('txtRegClientEmail');
    const passwordInput = document.getElementById('txtRegClientPassword');
    const passwordToggle = document.getElementById('toggleClientPassword');

    // --- DROPDOWN CHANGE LISTENERS ---
    const sexSelectEl = document.getElementById('selectSex');
    sexSelectEl?.addEventListener('change', () => {
        sexSelectEl.classList.remove('is-invalid');
        sexSelectEl.classList.add('is-valid');
    });

    const stateSelectEl = document.getElementById('txtState');
    stateSelectEl?.addEventListener('change', () => {
        stateSelectEl.classList.remove('is-invalid');
        stateSelectEl.classList.add('is-valid');
    });

    // --- STEP 1: EMAIL & PASSWORD ---
    if (step1NextBtn && emailInput && passwordInput) {
        step1NextBtn.addEventListener('click', () => {
            if (!validateRegisterForm(emailInput, passwordInput)) return;
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            proceedToNextStep(email, password);
        });

        [emailInput, passwordInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') step1NextBtn.click();
            });
        });
    }

    // Password visibility toggle
    if (passwordInput && passwordToggle) {
        passwordToggle.addEventListener('change', () => {
            passwordInput.type = passwordToggle.checked ? 'text' : 'password';
        });
    }

    // --- DATE PICKER (AIR DATEPICKER) ---
    const dobInput = document.getElementById('txtDOB');
    if (dobInput && typeof AirDatepicker !== 'undefined') {
        const mobileMediaQuery = window.matchMedia('(max-width: 767px)');
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
            isMobile: mobileMediaQuery.matches,
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
        const dobPicker = new AirDatepicker(dobInput, opts);
        window.dobPicker = dobPicker;

        // Real-time mobile detection
        mobileMediaQuery.addEventListener('change', (e) => {
            if (dobPicker) dobPicker.update({ isMobile: e.matches });
        });
    }

    // --- PHONE NUMBER FORMATTING ---
    const phoneInput = document.getElementById('txtPhoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '').substring(0, 10);
            let formatted = '';
            if (value.length > 0) {
                formatted = '(' + value.substring(0, 3);
                if (value.length >= 3) formatted += ') ' + value.substring(3, 6);
                if (value.length >= 6) formatted += '-' + value.substring(6, 10);
            }
            e.target.value = formatted;
        });
    }

    // --- STEP 2: PERSONAL INFORMATION ---
    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', goBackToStep1);
    }

    if (step2NextBtn) {
        step2NextBtn.addEventListener('click', () => {
            if (!validateStep2Form()) return;
            showStep(3);
        });

        ['txtFirstName', 'txtMiddleInitial', 'txtLastName', 'txtPhoneNumber'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') step2NextBtn.click();
                });
            }
        });
    }

    // --- STEP 3: ADDRESS INFORMATION ---
    if (step3BackBtn) {
        step3BackBtn.addEventListener('click', goBackToStep2);
    }

    // Toggle address fields visibility
    const chkNoAddress = document.getElementById('chkNoAddress');
    const addressFields = document.getElementById('addressFields');
    if (chkNoAddress && addressFields) {
        chkNoAddress.addEventListener('change', () => {
            addressFields.style.display = chkNoAddress.checked ? 'none' : 'block';
            const addressInputs = addressFields.querySelectorAll('input[required]');
            addressInputs.forEach(input => {
                if (chkNoAddress.checked) {
                    input.removeAttribute('required');
                } else {
                    input.setAttribute('required', '');
                }
            });
        });
    }

    if (step3SubmitBtn) {
        step3SubmitBtn.addEventListener('click', () => {
            if (!validateStep3Form()) return;
            showStep(4);
        });

        ['txtStreetAddress', 'txtStreetAddress2', 'txtCity', 'txtState', 'txtZip'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') step3SubmitBtn.click();
                });
            }
        });
    }
});
