/**
 * ============================================================
 *  File:        register.js
 *  Description: Multi-step registration form logic. Handles
 *               validation, input masks, step navigation,
 *               waiver agreement, and API submission for
 *               both new and returning users.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 26 @ 9:47 PM
 *  Changes Made:      Increased SweetAlert timer from 1000ms to 1500ms
 * ============================================================
*/

let dobMask;

// Config
const TRANSITION_DURATION = 500; // ms for step fade animation

// Validation regex patterns
const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    password: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\S{8,}$/,  // 8+ non-space chars, upper, lower, number
    phone: /^[\d\s\-\(\)]{10,}$/,
    phoneFormatted: /^\(\d{3}\) \d{3}-\d{4}$/,
    zipCode: /^[0-9]{5}$/
};

// Input filter patterns (for masking invalid characters)
const INPUT_FILTERS = {
    name: /[^a-zA-Z'-]/g,           // letters, hyphens, apostrophes
    initial: /[^a-zA-Z]/g,          // letters only
    city: /[^a-zA-Z\s\-']/g,        // letters, spaces, hyphens, apostrophes
    address: /[^a-zA-Z0-9\s\.\-#]/g, // letters, numbers, spaces, common chars
    numbers: /[^0-9]/g,
    nonDigit: /\D/g
};

// Utility functions
// Fade transition between steps
function transitionToStep(fromStep, toStep, targetStepNumber) {
    fromStep.style.opacity = '0';

    setTimeout(() => {
        fromStep.classList.remove('step-visible');
        fromStep.classList.add('step-hidden');

        toStep.classList.remove('step-hidden');
        toStep.classList.add('step-visible');
        toStep.style.opacity = '1';

        updateProgressBar(targetStepNumber);
    }, TRANSITION_DURATION);
}

// Add/remove Bootstrap validation classes
function setFieldValidation(field, isValid) {
    if (isValid) {
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    } else {
        field.classList.remove('is-valid');
        field.classList.add('is-invalid');
    }
}

// Format phone as (123) 456-7890
function formatPhoneNumber(value) {
    let digits = value.replace(INPUT_FILTERS.nonDigit, '');

    if (digits.length > 10) {
        digits = digits.substring(0, 10);
    }

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

// Progress bar
function updateProgressBar(step) {
    const progressBar = document.getElementById('progressBarTop');
    const percentages = { 1: 17, 2: 34, 3: 51, 4: 68, 5: 85 };
    const percentage = percentages[step] ?? 17;

    progressBar.style.width = percentage + '%';
    progressBar.textContent = ''; // Remove the "0%" text
    progressBar.setAttribute('aria-valuenow', percentage);
    progressBar.setAttribute('aria-label', `Registration progress, step ${step} of 5`);
}

// Create or recreate DOB mask based on language
// EN = MM/DD/YYYY, ES = DD/MM/YYYY
function createDobMask(lang) {
    const dobInput = document.getElementById('clientDOB');
    const isSpanish = (lang === 'es');

    // Preserve current value before destroying
    const currentValue = dobMask ? dobMask.value : '';
    if (dobMask) dobMask.destroy();

    dobMask = IMask(dobInput, {
        mask: Date,
        pattern: isSpanish ? 'd/`m/`Y' : 'm/`d/`Y',
        blocks: {
            d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
            m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
            Y: { mask: IMask.MaskedRange, from: 1900, to: new Date().getFullYear() }
        },
        format: (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return isSpanish ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
        },
        parse: (str) => {
            const parts = str.split('/');
            if (isSpanish) {
                const [d, m, y] = parts;
                return new Date(y, m - 1, d);
            } else {
                const [m, d, y] = parts;
                return new Date(y, m - 1, d);
            }
        },
        min: new Date(1900, 0, 1),
        max: new Date(),
        lazy: true,
        autofix: true,
    });

    // Update placeholder to match format
    dobInput.placeholder = isSpanish ? 'DD/MM/AAAA' : 'MM/DD/YYYY';

    // Restore value if switching language mid-form
    if (currentValue) {
        try { dobMask.value = currentValue; } catch (e) { /* clear if incompatible */ dobMask.value = ''; }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Initialize DOB mask with saved language (or default to English)
    const savedLang = sessionStorage.getItem('lang') || 'en';
    createDobMask(savedLang);

    // Re-create mask when language changes
    document.getElementById('selLanguageSwitch').addEventListener('change', function () {
        createDobMask(this.value);
    });

    // Check if returning user via URL param (e.g. ?clientID=abc123)
    const urlParams = new URLSearchParams(window.location.search);
    const clientIDFromUrl = urlParams.get('clientID');

    // If already logged in, jump instantly to Step 5 (service selection only)
    // Use direct show/hide instead of the animated transition so Step 1 never flickers
    if (clientIDFromUrl) {
        document.getElementById('btnRegisterBack5').style.display = 'none';
        ['divStepOne', 'divStepTwo', 'divStepThree', 'divStepFour', 'divStepFive'].forEach((id, i) => {
            const step = document.getElementById(id);
            if (i === 4) {
                step.classList.remove('step-hidden');
                step.classList.add('step-visible');
                step.style.opacity = '1';
            } else {
                step.classList.remove('step-visible');
                step.classList.add('step-hidden');
                step.style.opacity = '0';
            }
        });
        updateProgressBar(5);
    }
});

//  Step 1 - Login Info
function goToStepTwo() {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    transitionToStep(stepOne, stepTwo, 2);
}

function stepOneSubmit() {

    const emailInput = document.getElementById('clientRegisterEmail');
    const passInput = document.getElementById('clientRegisterPass');
    const errors = [];

    if (!VALIDATION_PATTERNS.email.test(emailInput.value.trim())) {
        errors.push('Please enter a valid email address.');
    }

    if (!VALIDATION_PATTERNS.password.test(passInput.value)) {
        errors.push('Please enter a valid password.');
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

    goToStepTwo();
}

// Step 1 event listeners
document.getElementById('clientRegisterFormStep1').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext1').click();
    }
});

document.getElementById('btnRegisterNext1').addEventListener('click', stepOneSubmit);

document.getElementById('btnRegisterBack1').addEventListener('click', function () {
    window.location.href = '../index.html';
});

// Step 2 - Personal Info
function goToStepThree() {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    transitionToStep(stepTwo, stepThree, 3);
}

function stepTwoSubmit() {
    const firstName = document.getElementById('clientFirstName');
    const lastName = document.getElementById('clientLastName');
    const dob = document.getElementById('clientDOB');
    const phone = document.getElementById('clientPhone');
    const sexRadios = document.querySelectorAll('input[name="clientSex"]');
    const errors = [];

    if (!firstName.value.trim()) {
        errors.push('Please enter your first name.');
    }

    if (!lastName.value.trim()) {
        errors.push('Please enter your last name.');
    }

    const sexSelected = Array.from(sexRadios).some(radio => radio.checked);
    if (!sexSelected) {
        errors.push('Please select your sex.');
    }

    // DOB 18+ validation
    if (!dob.value || !dobMask.masked.isComplete) {
        errors.push('Please enter your date of birth.');
    } else {
        const parts = dob.value.split('/');
        const currentLang = sessionStorage.getItem('lang') || 'en';
        let enteredDate;
        if (currentLang === 'es') {
            enteredDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            enteredDate = new Date(parts[2], parts[0] - 1, parts[1]);
        }
        const today = new Date();
        const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        if (enteredDate > minAgeDate) {
            errors.push('You must be at least 18 years old.');
        }
    }

    // Phone optional but must match format if provided
    if (phone.value.length > 0 && !VALIDATION_PATTERNS.phoneFormatted.test(phone.value)) {
        errors.push('Please enter a valid 10-digit phone number — (123) 456-7890.');
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

    goToStepThree();
}

// Step 2 event listeners
document.getElementById('clientRegisterFormStep2').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext2').click();
    }
});

document.getElementById('btnRegisterNext2').addEventListener('click', stepTwoSubmit);

document.getElementById('btnRegisterBack2').addEventListener('click', function () {
    const userData = JSON.parse(sessionStorage.getItem('userData'));

    // If logged in, go back to home instead of step 1
    if (userData) {
        return;
    }

    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    transitionToStep(stepTwo, stepOne, 1);
});

// Step 3 - Address Info
function goToStepFour() {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    transitionToStep(stepThree, stepFour, 4);
}

// "No address" checkbox - hides/shows address fields
const noAddressCheckbox = document.getElementById('noAddress');
const addressFields = [
    document.getElementById('clientAddress1'),
    document.getElementById('clientAddress2'),
    document.getElementById('clientCity'),
    document.getElementById('selectState'),
    document.getElementById('clientZipCode')
];

noAddressCheckbox.addEventListener('change', function () {
    addressFields.forEach(field => {
        const container = field.closest('.mb-3');

        if (this.checked) {
            container.style.display = 'none';
            field.removeAttribute('required');
        } else {
            container.style.display = 'block';
            if (field.id !== 'clientAddress2') {
                field.setAttribute('required', '');
            }
        }
    });
});

// Step 3 validation
document.getElementById('btnRegisterNext3').addEventListener('click', function () {
    const noAddress = document.getElementById('noAddress').checked;

    // Skip validation if no address
    if (noAddress) {
        goToStepFour();
        return;
    }

    const errors = [];

    const address1 = document.getElementById('clientAddress1');
    if (!address1.value.trim() || address1.value.trim().length < 5) {
        errors.push('Please enter a street address (at least 5 characters).');
    }

    const city = document.getElementById('clientCity');
    if (!city.value.trim() || city.value.trim().length < 2) {
        errors.push('Please enter a city (at least 2 characters).');
    }

    const state = document.getElementById('selectState');
    if (!state.value) {
        errors.push('Please select a state.');
    }

    const zipCode = document.getElementById('clientZipCode');
    if (!zipCode.value.match(VALIDATION_PATTERNS.zipCode)) {
        errors.push('Please enter a valid 5-digit zip code.');
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

    goToStepFour();
});

document.getElementById('btnRegisterBack3').addEventListener('click', function () {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    transitionToStep(stepThree, stepTwo, 2);
});

document.getElementById('clientRegisterFormStep3').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext3').click();
    }
});

// Step 4 - Emergency Contact
function goToStepFive() {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    transitionToStep(stepFour, stepFive, 5);
}

// "No emergency contact" checkbox - hides/shows fields
const noEmergencyContactCheckbox = document.getElementById('noEmergencyContact');
const emergencyContactFields = [
    document.getElementById('emergencyContactFirstName'),
    document.getElementById('emergencyContactLastName'),
    document.getElementById('emergencyContactPhone')
];

noEmergencyContactCheckbox.addEventListener('change', function () {
    emergencyContactFields.forEach(field => {
        const container = field.closest('.mb-3');

        if (this.checked) {
            container.style.display = 'none';
            field.removeAttribute('required');
            field.classList.remove('is-invalid');
        } else {
            container.style.display = 'block';
            field.setAttribute('required', '');
        }
    });
});

// Step 4 validation
document.getElementById('btnRegisterNext4').addEventListener('click', function () {
    const noEmergencyContact = document.getElementById('noEmergencyContact').checked;

    if (noEmergencyContact) {
        goToStepFive();
        return;
    }

    const errors = [];

    const firstName = document.getElementById('emergencyContactFirstName');
    if (!firstName.value.trim()) {
        errors.push('Please enter a first name for your contact.');
    }

    const lastName = document.getElementById('emergencyContactLastName');
    if (!lastName.value.trim()) {
        errors.push('Please enter a last name for your contact.');
    }

    const phone = document.getElementById('emergencyContactPhone');
    if (!VALIDATION_PATTERNS.phoneFormatted.test(phone.value)) {
        errors.push('Please enter a valid 10-digit phone number — (123) 456-7890.');
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

    goToStepFive();
});

document.getElementById('btnRegisterBack4').addEventListener('click', function () {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    transitionToStep(stepFour, stepThree, 3);
});

document.getElementById('clientRegisterFormStep4').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext4').click();
    }
});

// Step 5 - Service Selection
document.getElementById('btnRegisterNext5').addEventListener('click', function () {
    const services = document.querySelectorAll('input[name="clientServices"]:checked');

    if (services.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Check your info',
            html: '• Please select at least one service.',
            confirmButtonColor: '#174593'
        });
        return;
    }

    // Show waiver modal
    const modal = new bootstrap.Modal(document.getElementById('registrationCompleteModal'));
    modal.show();
});

document.getElementById('btnRegisterBack5').addEventListener('click', function () {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    transitionToStep(stepFive, stepFour, 4);
});

// Input masks
// Step 1 - Valid feedback on blur (green checkmark when leaving field)
document.getElementById('clientRegisterEmail').addEventListener('blur', function () {
    if (VALIDATION_PATTERNS.email.test(this.value.trim())) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid');
        this.classList.remove('is-invalid');
    }
});

document.getElementById('clientRegisterPass').addEventListener('blur', function () {
    if (VALIDATION_PATTERNS.password.test(this.value)) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid');
        this.classList.remove('is-invalid');
    }
});

// Step 2 - Valid feedback on blur
document.getElementById('clientFirstName').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
    } else {
        this.classList.remove('is-valid');
    }
    this.classList.remove('is-invalid');
});

document.getElementById('clientMiddleInitial').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('clientLastName').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
    } else {
        this.classList.remove('is-valid');
    }
    this.classList.remove('is-invalid');
});

document.getElementById('clientDOB').addEventListener('blur', function () {
    if (!this.value || !dobMask.masked.isComplete) {
        this.classList.remove('is-valid', 'is-invalid');
        return;
    }
    const parts = this.value.split('/');
    const currentLang = sessionStorage.getItem('lang') || 'en';
    let enteredDate;
    if (currentLang === 'es') {
        enteredDate = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
        enteredDate = new Date(parts[2], parts[0] - 1, parts[1]);
    }
    const today = new Date();
    const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    if (enteredDate <= minAgeDate) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('clientPhone').addEventListener('blur', function () {
    if (this.value.length === 0) {
        this.classList.remove('is-valid', 'is-invalid');
    } else if (VALIDATION_PATTERNS.phoneFormatted.test(this.value)) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        // Partially filled — just go neutral, don't punish them yet
        this.classList.remove('is-valid', 'is-invalid');
    }
});

// Names - letters, hyphens, apostrophes only
document.getElementById('clientFirstName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

document.getElementById('clientMiddleInitial').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.initial, '').substring(0, 1).toUpperCase();
});

document.getElementById('clientLastName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

// Phone - auto format as (123) 456-7890
document.getElementById('clientPhone').addEventListener('input', function (e) {
    e.target.value = formatPhoneNumber(e.target.value);
});

document.getElementById('emergencyContactPhone').addEventListener('input', function (e) {
    e.target.value = formatPhoneNumber(e.target.value);
});

// Address fields
document.getElementById('clientZipCode').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.numbers, '');
});

document.getElementById('clientCity').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.city, '');
});

document.getElementById('clientAddress1').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.address, '');
});

document.getElementById('clientAddress2').addEventListener('input', function () {
    this.value = this.value.replace(INPUT_FILTERS.address, '');
});

// Step 3 blur handlers — green checkmark on valid input
document.getElementById('clientAddress1').addEventListener('blur', function () {
    if (this.value.trim().length >= 5) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('clientAddress2').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('clientCity').addEventListener('blur', function () {
    if (this.value.trim().length >= 2) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('selectState').addEventListener('change', function () {
    if (this.value) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('clientZipCode').addEventListener('blur', function () {
    if (this.value.match(VALIDATION_PATTERNS.zipCode)) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

// Emergency contact names
document.getElementById('emergencyContactFirstName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

document.getElementById('emergencyContactLastName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

// Step 4 blur handlers — green checkmark on valid input
document.getElementById('emergencyContactFirstName').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('emergencyContactLastName').addEventListener('blur', function () {
    if (this.value.trim()) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});

document.getElementById('emergencyContactPhone').addEventListener('blur', function () {
    if (this.value.length === 0) {
        this.classList.remove('is-valid', 'is-invalid');
    } else if (VALIDATION_PATTERNS.phoneFormatted.test(this.value)) {
        this.classList.add('is-valid');
        this.classList.remove('is-invalid');
    } else {
        this.classList.remove('is-valid', 'is-invalid');
    }
});


// Waiver modal & form submission
// Helper to get current language translations
function getLang() {
    var lang = sessionStorage.getItem("lang") || "en";
    return translations[lang];
}

document.getElementById('btnWaiverSubmit').addEventListener('click', function () {
    const btn = this;
    const originalContent = btn.innerHTML;
    const t = getLang();

    // Disable button and show spinner
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...`;

    const waiverCheckbox = document.getElementById('waiverAgree');
    const waiverError = document.getElementById('waiverError');

    if (!waiverCheckbox.checked) {
        waiverError.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = originalContent;
        return;
    }

    waiverError.style.display = 'none';

    // Check if returning user via URL param
    const urlParams = new URLSearchParams(window.location.search);
    const clientIDFromUrl = urlParams.get('clientID');

    // Collect form data — logged-in users only update services, new users send full registration
    let formData;

    if (clientIDFromUrl) {
        // Existing user: only send what's needed for service selection
        formData = {
            clientID: clientIDFromUrl,
            noAddress: true,
            noEmergencyContact: true,
            EventID: "4cbde538985861b9",
            services: Array.from(
                document.querySelectorAll('input[name="clientServices"]:checked')
            ).map(s => s.value),
        };
    } else {
        // New user: send full registration payload
        formData = {
            clientID: null,
            email: document.getElementById('clientRegisterEmail').value,
            password: document.getElementById('clientRegisterPass').value,
            firstName: document.getElementById('clientFirstName').value,
            middleInitial: document.getElementById('clientMiddleInitial').value,
            lastName: document.getElementById('clientLastName').value,
            dob: (() => {
                const maskedDate = dobMask?.typedValue;
                if (maskedDate instanceof Date && !isNaN(maskedDate)) {
                    const y = maskedDate.getFullYear();
                    const m = String(maskedDate.getMonth() + 1).padStart(2, '0');
                    const d = String(maskedDate.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
                return document.getElementById('clientDOB').value;
            })(),
            phone: document.getElementById('clientPhone').value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
            sex: document.querySelector('input[name="clientSex"]:checked')?.value || '',
            noAddress: document.getElementById('noAddress').checked,
            address1: document.getElementById('clientAddress1').value,
            address2: document.getElementById('clientAddress2').value,
            city: document.getElementById('clientCity').value,
            state: document.getElementById('selectState').value,
            zipCode: document.getElementById('clientZipCode').value,
            noEmergencyContact: document.getElementById('noEmergencyContact').checked,
            emergencyFirstName: document.getElementById('emergencyContactFirstName').value,
            emergencyLastName: document.getElementById('emergencyContactLastName').value,
            emergencyPhone: document.getElementById('emergencyContactPhone').value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
            EventID: "4cbde538985861b9",
            services: Array.from(
                document.querySelectorAll('input[name="clientServices"]:checked')
            ).map(s => s.value),
        };
    }

    // Send to API
    fetch('../api/Register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
        .then(response => response.json())
        .then(data => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('registrationCompleteModal'));
            modal.hide();

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: t.registrationSuccessTitle,
                    text: t.registrationSuccessText,
                    timer: 1500,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false
                }).then(() => {
                    // Hide the registration card and progress bar
                    document.getElementById('divStepOne').closest('.card').style.display = 'none';
                    document.getElementById('wholeProgressBar').style.display = 'none';
                    const devBar = document.querySelector('.dev-bar');
                    if (devBar) devBar.closest('.text-center').style.display = 'none';

                    // Show QR code card
                    const qrContainer = document.getElementById('divQRCode');
                    qrContainer.classList.remove('d-none');
                    qrContainer.classList.add('d-flex');

                    // Set name — FIRST NAME in bold uppercase, last name normal
                    const firstName = (data.firstName || '').toUpperCase();
                    const lastName = data.lastName || '';
                    document.getElementById('qrCardTitle').innerHTML = `<strong>${firstName}</strong> ${lastName}`;

                    // Generate QR Code from clientID
                    new QRious({
                        element: document.getElementById('qr'),
                        value: data.clientID,
                        size: 200,
                    });

                    // Show service icons (use visibility like dashboard)
                    const serviceIcons = {
                        medical: 'qrCardMedicalIcon',
                        dental: 'qrCardDentalIcon',
                        optical: 'qrCardOpticalIcon',
                        haircut: 'qrCardHaircutIcon'
                    };
                    const selectedServices = data.services || [];

                    Object.values(serviceIcons).forEach(id => {
                        const icon = document.getElementById(id);
                        if (icon) {
                            icon.style.display = 'inline-flex';
                            icon.style.visibility = 'hidden';
                        }
                    });

                    selectedServices.forEach(key => {
                        const id = serviceIcons[key];
                        if (id) {
                            const icon = document.getElementById(id);
                            if (icon) icon.style.visibility = 'visible';
                        }
                    });
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: t.registrationFailedTitle,
                    text: data.message || t.registrationFailedText,
                    confirmButtonColor: '#174593'
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);

            const modal = bootstrap.Modal.getInstance(document.getElementById('registrationCompleteModal'));
            modal.hide();

            Swal.fire({
                icon: 'error',
                title: t.registrationConnectionErrorTitle,
                text: t.registrationConnectionErrorText,
                confirmButtonColor: '#174593'
            });
        })
        .finally(() => {
            // Re-enable button and restore content
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
});


// DEBUG - Skip to any step (remove in production)
function showStepOnly(stepNumber) {
    const allSteps = [
        document.getElementById('divStepOne'),
        document.getElementById('divStepTwo'),
        document.getElementById('divStepThree'),
        document.getElementById('divStepFour'),
        document.getElementById('divStepFive')
    ];

    allSteps.forEach((step, index) => {
        if (step) {
            if (index + 1 === stepNumber) {
                step.classList.remove('step-hidden');
                step.classList.add('step-visible');
                step.style.opacity = '1';
            } else {
                step.classList.remove('step-visible');
                step.classList.add('step-hidden');
                step.style.opacity = '0';
            }
        }
    });

    updateProgressBar(stepNumber);
}

document.getElementById('skipStep1').addEventListener('click', () => showStepOnly(1));
document.getElementById('skipStep2').addEventListener('click', () => showStepOnly(2));
document.getElementById('skipStep3').addEventListener('click', () => showStepOnly(3));
document.getElementById('skipStep4').addEventListener('click', () => showStepOnly(4));
document.getElementById('skipStep5').addEventListener('click', () => showStepOnly(5));