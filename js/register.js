/**
 * ============================================================================
 * REGISTRATION FORM HANDLER
 * ============================================================================
 * 
 * Multi-step registration form controller for DUO Mission client registration.
 * Handles form validation, step transitions, input masking, and form submission.
 * 
 * TABLE OF CONTENTS:
 * ------------------
 * 1. CONFIGURATION & CONSTANTS
 * 2. UTILITY FUNCTIONS
 *    - Step Transition Helper
 *    - Validation Helper
 *    - Phone Formatting Helper
 * 3. PROGRESS BAR
 * 4. STEP 1: LOGIN INFORMATION
 * 5. STEP 2: PERSONAL INFORMATION
 * 6. STEP 3: ADDRESS INFORMATION
 * 7. STEP 4: EMERGENCY CONTACT
 * 8. STEP 5: SERVICE SELECTION
 * 9. INPUT MASKS
 *    - Name Fields
 *    - Phone Fields
 *    - Address Fields
 * 10. WAIVER MODAL & FORM SUBMISSION
 * 11. TESTING / DEBUG UTILITIES
 * 
 * @author DUO Mission Team
 * @version 1.0.0
 */


/* ==========================================================================
   1. CONFIGURATION & CONSTANTS
   ========================================================================== */

/**
 * Animation duration for step transitions (in milliseconds)
 * @constant {number}
 */
const TRANSITION_DURATION = 500;

/**
 * Regular expression patterns used for form validation
 * @constant {Object}
 */
const VALIDATION_PATTERNS = {
    // Standard email format: john@example.com
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,

    // Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
    password: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/,

    // Phone: at least 10 digits (allows spaces, dashes, parentheses)
    phone: /^[\d\s\-\(\)]{10,}$/,

    // Formatted phone: (123) 456-7890
    phoneFormatted: /^\(\d{3}\) \d{3}-\d{4}$/,

    // ZIP code: exactly 5 digits
    zipCode: /^[0-9]{5}$/
};

/**
 * Character filter patterns used for input masks
 * @constant {Object}
 */
const INPUT_FILTERS = {
    // Letters, hyphens, and apostrophes only (for names like O'Brien, Mary-Jane)
    name: /[^a-zA-Z'-]/g,

    // Single uppercase letter only (for middle initial)
    initial: /[^a-zA-Z]/g,

    // Letters, spaces, hyphens, apostrophes (for cities like Winston-Salem, O'Fallon)
    city: /[^a-zA-Z\s\-']/g,

    // Letters, numbers, spaces, and common address chars (#, ., -)
    address: /[^a-zA-Z0-9\s\.\-#]/g,

    // Numbers only
    numbers: /[^0-9]/g,

    // Non-digit characters (for phone stripping)
    nonDigit: /\D/g
};


/* ==========================================================================
   2. UTILITY FUNCTIONS
   ========================================================================== */

/**
 * Transitions between registration form steps with fade animation.
 * Hides the current step and reveals the target step.
 * 
 * @param {HTMLElement} fromStep - The step element to hide
 * @param {HTMLElement} toStep - The step element to show
 * @param {number} targetStepNumber - The step number (1-5) for progress bar update
 */
function transitionToStep(fromStep, toStep, targetStepNumber) {
    // Fade out current step
    fromStep.style.opacity = '0';

    setTimeout(() => {
        // Hide the current step completely
        fromStep.classList.remove('step-visible');
        fromStep.classList.add('step-hidden');

        // Reveal the target step
        toStep.classList.remove('step-hidden');
        toStep.classList.add('step-visible');
        toStep.style.opacity = '1';

        // Update progress indicator
        updateProgressBar(targetStepNumber);
    }, TRANSITION_DURATION);
}

/**
 * Sets the validation state of a form field.
 * Adds/removes Bootstrap validation classes.
 * 
 * @param {HTMLElement} field - The input element to validate
 * @param {boolean} isValid - Whether the field is valid
 */
function setFieldValidation(field, isValid) {
    if (isValid) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    } else {
        field.classList.remove('is-valid');
        field.classList.add('is-invalid');
    }
}

/**
 * Formats a numeric string as a US phone number: (123) 456-7890
 * 
 * @param {string} value - Raw input value (may contain non-digits)
 * @returns {string} Formatted phone number string
 */
function formatPhoneNumber(value) {
    // Strip all non-digit characters
    let digits = value.replace(INPUT_FILTERS.nonDigit, '');

    // Limit to 10 digits maximum
    if (digits.length > 10) {
        digits = digits.substring(0, 10);
    }

    // Build formatted string based on digit count
    if (digits.length === 0) {
        return '';
    } else if (digits.length <= 3) {
        return '(' + digits;
    } else if (digits.length <= 6) {
        return '(' + digits.substring(0, 3) + ') ' + digits.substring(3);
    } else {
        return '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
    }
}


/* ==========================================================================
   3. PROGRESS BAR
   ========================================================================== */

/**
 * Updates the progress bar to reflect the current step.
 * Each step represents 20% progress (5 steps total).
 * Final step shows 99% to indicate completion pending.
 * 
 * @param {number} step - Current step number (1-5)
 */
function updateProgressBar(step) {
    const progressBar = document.getElementById('progressBarTop');

    // Calculate percentage (20% per step, cap at 99% for final step)
    const percentage = (step === 5) ? 99 : step * 20;

    // Update progress bar width, text, and ARIA attributes
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);
}


/* ==========================================================================
   4. STEP 1: LOGIN INFORMATION
   ========================================================================== */

/**
 * Navigates from Step 1 to Step 2.
 * Called after successful Step 1 validation.
 */
function goToStepTwo() {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    transitionToStep(stepOne, stepTwo, 2);
}

/**
 * Validates Step 1 form fields (email and password).
 * Proceeds to Step 2 if all validations pass.
 */
function stepOneSubmit() {
    const emailInput = document.getElementById('clientRegisterEmail');
    const passInput = document.getElementById('clientRegisterPass');
    let isValid = true;

    // Validate email format
    if (!VALIDATION_PATTERNS.email.test(emailInput.value)) {
        setFieldValidation(emailInput, false);
        isValid = false;
    } else {
        setFieldValidation(emailInput, true);
    }

    // Validate password strength
    if (!VALIDATION_PATTERNS.password.test(passInput.value)) {
        setFieldValidation(passInput, false);
        isValid = false;
    } else {
        setFieldValidation(passInput, true);
    }

    if (isValid) {
        goToStepTwo();
    }
}

// --- Step 1 Event Listeners ---

// Submit form on Enter key press
document.getElementById('clientRegisterFormStep1').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext1').click();
    }
});

// "Next" button click handler
document.getElementById('btnRegisterNext1').addEventListener('click', stepOneSubmit);

// Toggle password visibility checkbox
document.getElementById('toggleClientRegisterPass').addEventListener('change', function () {
    const passwordInput = document.getElementById('clientLoginPass');
    passwordInput.type = this.checked ? 'text' : 'password';
});


/* ==========================================================================
   5. STEP 2: PERSONAL INFORMATION
   ========================================================================== */

/**
 * Navigates from Step 2 to Step 3.
 * Called after successful Step 2 validation.
 */
function goToStepThree() {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    transitionToStep(stepTwo, stepThree, 3);
}

/**
 * Validates Step 2 form fields (personal information).
 * Required fields: first name, last name, DOB, sex.
 * Optional field: phone (validated if provided).
 */
function stepTwoSubmit() {
    const firstName = document.getElementById('clientFirstName');
    const lastName = document.getElementById('clientLastName');
    const dob = document.getElementById('clientDOB');
    const phone = document.getElementById('clientPhone');
    const sexRadios = document.querySelectorAll('input[name="clientSex"]');
    const sexError = document.getElementById('sexError');

    let isValid = true;

    // Validate first name (required)
    if (!firstName.value.trim()) {
        setFieldValidation(firstName, false);
        isValid = false;
    } else {
        setFieldValidation(firstName, true);
    }

    // Validate last name (required)
    if (!lastName.value.trim()) {
        setFieldValidation(lastName, false);
        isValid = false;
    } else {
        setFieldValidation(lastName, true);
    }

    // Validate date of birth (required)
    if (!dob.value) {
        setFieldValidation(dob, false);
        isValid = false;
    } else {
        setFieldValidation(dob, true);
    }

    // Validate sex selection (required)
    const sexSelected = Array.from(sexRadios).some(radio => radio.checked);
    sexError.style.display = sexSelected ? 'none' : 'block';
    if (!sexSelected) {
        isValid = false;
    }

    // Validate phone format (optional, but must be valid if provided)
    if (phone.value.length > 0) {
        const strippedPhone = phone.value.replace(/\s/g, '');
        if (!VALIDATION_PATTERNS.phone.test(strippedPhone)) {
            setFieldValidation(phone, false);
            isValid = false;
        } else {
            setFieldValidation(phone, true);
        }
    }

    if (isValid) {
        goToStepThree();
    }
}

// --- Step 2 Event Listeners ---

// Submit form on Enter key press
document.getElementById('clientRegisterFormStep2').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext2').click();
    }
});

// "Next" button click handler
document.getElementById('btnRegisterNext2').addEventListener('click', stepTwoSubmit);

// "Back" button - return to Step 1
document.getElementById('btnRegisterBack2').addEventListener('click', function () {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    transitionToStep(stepTwo, stepOne, 1);
});


/* ==========================================================================
   6. STEP 3: ADDRESS INFORMATION
   ========================================================================== */

/**
 * Navigates from Step 3 to Step 4.
 * Called after successful Step 3 validation or when "no address" is checked.
 */
function goToStepFour() {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    transitionToStep(stepThree, stepFour, 4);
}

// --- "No Address" Checkbox Toggle ---

const noAddressCheckbox = document.getElementById('noAddress');

// List of address-related form fields
const addressFields = [
    document.getElementById('clientAddress1'),
    document.getElementById('clientAddress2'),
    document.getElementById('clientCity'),
    document.getElementById('selectState'),
    document.getElementById('clientZipCode')
];

/**
 * Toggles visibility and required state of address fields
 * when "I don't have an address" checkbox is changed.
 */
noAddressCheckbox.addEventListener('change', function () {
    addressFields.forEach(field => {
        const container = field.closest('.mb-3');

        if (this.checked) {
            // Hide field and remove required attribute
            container.style.display = 'none';
            field.removeAttribute('required');
        } else {
            // Show field and restore required (except Address 2 which is optional)
            container.style.display = 'block';
            if (field.id !== 'clientAddress2') {
                field.setAttribute('required', '');
            }
        }
    });
});

// --- Step 3 Validation and Navigation ---

// "Next" button - validate and proceed to Step 4
document.getElementById('btnRegisterNext3').addEventListener('click', function () {
    const noAddress = document.getElementById('noAddress').checked;

    // Skip validation if user has no address
    if (noAddress) {
        goToStepFour();
        return;
    }

    let isValid = true;

    // Validate Address Line 1 (required)
    const address1 = document.getElementById('clientAddress1');
    if (!address1.value.trim()) {
        address1.classList.add('is-invalid');
        isValid = false;
    } else {
        address1.classList.remove('is-invalid');
    }

    // Validate City (required)
    const city = document.getElementById('clientCity');
    if (!city.value.trim()) {
        city.classList.add('is-invalid');
        isValid = false;
    } else {
        city.classList.remove('is-invalid');
    }

    // Validate State selection (required)
    const state = document.getElementById('selectState');
    if (!state.value) {
        state.classList.add('is-invalid');
        isValid = false;
    } else {
        state.classList.remove('is-invalid');
    }

    // Validate ZIP Code (must be exactly 5 digits)
    const zipCode = document.getElementById('clientZipCode');
    if (!zipCode.value.match(VALIDATION_PATTERNS.zipCode)) {
        zipCode.classList.add('is-invalid');
        isValid = false;
    } else {
        zipCode.classList.remove('is-invalid');
    }

    if (isValid) {
        goToStepFour();
    }
});

// "Back" button - return to Step 2
document.getElementById('btnRegisterBack3').addEventListener('click', function () {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    transitionToStep(stepThree, stepTwo, 2);
});


/* ==========================================================================
   7. STEP 4: EMERGENCY CONTACT
   ========================================================================== */

/**
 * Navigates from Step 4 to Step 5.
 * Called after successful Step 4 validation or when "no emergency contact" is checked.
 */
function goToStepFive() {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    transitionToStep(stepFour, stepFive, 5);
}

// --- "No Emergency Contact" Checkbox Toggle ---

const noEmergencyContactCheckbox = document.getElementById('noEmergencyContact');

// List of emergency contact form fields
const emergencyContactFields = [
    document.getElementById('emergencyContactFirstName'),
    document.getElementById('emergencyContactLastName'),
    document.getElementById('emergencyContactPhone')
];

/**
 * Toggles visibility and required state of emergency contact fields
 * when "I don't have an emergency contact" checkbox is changed.
 */
noEmergencyContactCheckbox.addEventListener('change', function () {
    emergencyContactFields.forEach(field => {
        const container = field.closest('.mb-3');

        if (this.checked) {
            // Hide field, remove required, and clear any validation errors
            container.style.display = 'none';
            field.removeAttribute('required');
            field.classList.remove('is-invalid');
        } else {
            // Show field and restore required attribute
            container.style.display = 'block';
            field.setAttribute('required', '');
        }
    });
});

// --- Step 4 Validation and Navigation ---

// "Next" button - validate and proceed to Step 5
document.getElementById('btnRegisterNext4').addEventListener('click', function () {
    const noEmergencyContact = document.getElementById('noEmergencyContact').checked;

    // Skip validation if user has no emergency contact
    if (noEmergencyContact) {
        goToStepFive();
        return;
    }

    let isValid = true;

    // Validate First Name (required)
    const firstName = document.getElementById('emergencyContactFirstName');
    if (!firstName.value.trim()) {
        firstName.classList.add('is-invalid');
        isValid = false;
    } else {
        firstName.classList.remove('is-invalid');
    }

    // Validate Last Name (required)
    const lastName = document.getElementById('emergencyContactLastName');
    if (!lastName.value.trim()) {
        lastName.classList.add('is-invalid');
        isValid = false;
    } else {
        lastName.classList.remove('is-invalid');
    }

    // Validate Phone (must be formatted as (123) 456-7890)
    const phone = document.getElementById('emergencyContactPhone');
    if (!phone.value.match(VALIDATION_PATTERNS.phoneFormatted)) {
        phone.classList.add('is-invalid');
        isValid = false;
    } else {
        phone.classList.remove('is-invalid');
    }

    if (isValid) {
        goToStepFive();
        console.log('Step 4 complete - with emergency contact');
    }
});

// "Back" button - return to Step 3
document.getElementById('btnRegisterBack4').addEventListener('click', function () {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    transitionToStep(stepFour, stepThree, 3);
});


/* ==========================================================================
   8. STEP 5: SERVICE SELECTION
   ========================================================================== */

// "Next" button - validate service selection and show waiver modal
document.getElementById('btnRegisterNext5').addEventListener('click', function () {
    const services = document.querySelectorAll('input[name="clientServices"]:checked');
    const serviceError = document.getElementById('serviceError');

    // At least one service must be selected
    if (services.length === 0) {
        serviceError.style.display = 'block';
        return;
    }

    serviceError.style.display = 'none';

    // Log selected services for debugging
    const selectedServices = Array.from(services).map(s => s.value);
    console.log('Selected services:', selectedServices);
    console.log('Registration complete!');

    // Show the waiver/confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('registrationCompleteModal'));
    modal.show();
});

// "Back" button - return to Step 4
document.getElementById('btnRegisterBack5').addEventListener('click', function () {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    transitionToStep(stepFive, stepFour, 4);
});


/* ==========================================================================
   9. INPUT MASKS
   ========================================================================== */

/*
 * Input masks restrict user input to valid characters only.
 * They provide immediate feedback and prevent invalid data entry.
 */

// --- 9.1 Name Fields ---

// First name: letters, hyphens, apostrophes only (e.g., Mary-Jane, O'Brien)
document.getElementById('clientFirstName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

// Middle initial: single uppercase letter only
document.getElementById('clientMiddleInitial').addEventListener('input', function (e) {
    e.target.value = e.target.value
        .replace(INPUT_FILTERS.initial, '')
        .substring(0, 1)
        .toUpperCase();
});

// Last name: letters, hyphens, apostrophes only
document.getElementById('clientLastName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

// --- 9.2 Phone Fields ---

// Client phone: auto-formats as (123) 456-7890
document.getElementById('clientPhone').addEventListener('input', function (e) {
    e.target.value = formatPhoneNumber(e.target.value);
});

// Emergency contact phone: auto-formats as (123) 456-7890
document.getElementById('emergencyContactPhone').addEventListener('input', function (e) {
    e.target.value = formatPhoneNumber(e.target.value);
});

// --- 9.3 Address Fields ---

// ZIP code: numbers only (5 digits enforced by maxlength attribute)
document.getElementById('clientZipCode').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.numbers, '');
});

// City: letters, spaces, hyphens, apostrophes (e.g., Winston-Salem, O'Fallon)
document.getElementById('clientCity').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.city, '');
});

// Address Line 1: letters, numbers, spaces, and common address chars (#, ., -)
document.getElementById('clientAddress1').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.address, '');
});

// Address Line 2: same restrictions as Address Line 1
document.getElementById('clientAddress2').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.address, '');
});

// --- 9.4 Emergency Contact Name Fields ---

// Emergency contact first name: letters, hyphens, apostrophes only
document.getElementById('emergencyContactFirstName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

// Emergency contact last name: letters, hyphens, apostrophes only
document.getElementById('emergencyContactLastName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});


/* ==========================================================================
   10. WAIVER MODAL & FORM SUBMISSION
   ========================================================================== */

/**
 * Handles final form submission when user agrees to waiver.
 * Collects all form data and sends to the registration API.
 */
document.getElementById('btnWaiverSubmit').addEventListener('click', function () {
    const waiverCheckbox = document.getElementById('waiverAgree');
    const waiverError = document.getElementById('waiverError');

    // Validate waiver agreement checkbox
    if (!waiverCheckbox.checked) {
        waiverError.style.display = 'block';
        return;
    }

    waiverError.style.display = 'none';

    // --- Collect All Form Data ---

    const formData = {
        // Step 1: Login credentials
        email: document.getElementById('clientRegisterEmail').value,
        password: document.getElementById('clientRegisterPass').value,

        // Step 2: Personal information
        firstName: document.getElementById('clientFirstName').value,
        middleInitial: document.getElementById('clientMiddleInitial').value,
        lastName: document.getElementById('clientLastName').value,
        dob: document.getElementById('clientDOB').value,
        phone: document.getElementById('clientPhone').value,
        sex: document.querySelector('input[name="clientSex"]:checked')?.value || '',

        // Step 3: Address information
        address1: document.getElementById('clientAddress1').value,
        address2: document.getElementById('clientAddress2').value,
        city: document.getElementById('clientCity').value,
        state: document.getElementById('selectState').value,
        zipCode: document.getElementById('clientZipCode').value,

        // Step 4: Emergency contact
        emergencyFirstName: document.getElementById('emergencyContactFirstName').value,
        emergencyLastName: document.getElementById('emergencyContactLastName').value,
        emergencyPhone: document.getElementById('emergencyContactPhone').value,

        // Step 5: Selected services
        services: Array.from(
            document.querySelectorAll('input[name="clientServices"]:checked')
        ).map(s => s.value),
    };

    // --- Submit to Registration API ---

    fetch('../api/register.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
        .then(response => response.json())
        .then(data => {
            // Close the waiver modal
            const modal = bootstrap.Modal.getInstance(
                document.getElementById('registrationCompleteModal')
            );
            modal.hide();

            if (data.success) {
                // Success: Show confirmation and redirect to login
                Swal.fire({
                    icon: 'success',
                    title: 'Registration Complete!',
                    text: 'Your account has been created successfully.',
                    confirmButtonColor: '#174593'
                }).then(() => {
                    window.location.href = 'index.html';
                });
            } else {
                // API returned an error
                Swal.fire({
                    icon: 'error',
                    title: 'Registration Failed',
                    text: data.message || 'An error occurred. Please try again.',
                    confirmButtonColor: '#174593'
                });
            }
        })
        .catch(error => {
            // Network or server error
            console.error('Error:', error);

            // Close the modal
            const modal = bootstrap.Modal.getInstance(
                document.getElementById('registrationCompleteModal')
            );
            modal.hide();

            Swal.fire({
                icon: 'error',
                title: 'Connection Error',
                text: 'Unable to connect to the server. Please try again later.',
                confirmButtonColor: '#174593'
            });
        });
});


/* ==========================================================================
   11. TESTING / DEBUG UTILITIES
   ========================================================================== */

/*
 * Debug utilities for development and testing.
 * These functions allow direct navigation to any step without validation.
 * 
 * IMPORTANT: Remove or disable these in production!
 */

/**
 * Jumps directly to a specific step without validation or animation.
 * Useful for testing individual step functionality.
 * 
 * @param {number} stepNumber - The step to show (1-5)
 */
function showStepOnly(stepNumber) {
    // Get all step containers
    const allSteps = [
        document.getElementById('divStepOne'),
        document.getElementById('divStepTwo'),
        document.getElementById('divStepThree'),
        document.getElementById('divStepFour'),
        document.getElementById('divStepFive')
    ];

    // Show only the target step, hide all others
    allSteps.forEach((step, index) => {
        if (step) {
            if (index === stepNumber - 1) {
                // Show this step
                step.classList.remove('step-hidden');
                step.classList.add('step-visible');
                step.style.opacity = '1';
            } else {
                // Hide this step
                step.classList.remove('step-visible');
                step.classList.add('step-hidden');
                step.style.opacity = '0';
            }
        }
    });

    // Update progress bar to match
    updateProgressBar(stepNumber);
}

// --- Debug Navigation Button Handlers ---

document.getElementById('skipStep1').addEventListener('click', () => showStepOnly(1));
document.getElementById('skipStep2').addEventListener('click', () => showStepOnly(2));
document.getElementById('skipStep3').addEventListener('click', () => showStepOnly(3));
document.getElementById('skipStep4').addEventListener('click', () => showStepOnly(4));
document.getElementById('skipStep5').addEventListener('click', () => showStepOnly(5));