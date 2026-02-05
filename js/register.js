// ============================================================================
// CONFIG
// ============================================================================

const TRANSITION_DURATION = 500; // ms for step fade animation

// Validation regex patterns
const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    password: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/,  // 8+ chars, upper, lower, number
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


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// DOB 18+
const dobInput = document.getElementById('clientDOB');
const today = new Date();
const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
dobInput.max = minAgeDate.toISOString().split('T')[0];


// ============================================================================
// PROGRESS BAR
// ============================================================================

function updateProgressBar(step) {
    const progressBar = document.getElementById('progressBarTop');
    let percentage = 1;
    switch (step) {
        case 1: percentage = 0; break;
        case 2: percentage = 25; break;
        case 3: percentage = 50; break;
        case 4: percentage = 75; break;
        case 5: percentage = 99; break;
        default: percentage = 0;
    }
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);
}

// ============================================================================
// STEP 0: LANGUAGE SELECT
// ============================================================================

function goToStepOne() {
    const stepZero = document.getElementById('divStepZero');
    const stepOne = document.getElementById('divStepOne');
    transitionToStep(stepZero, stepOne, 1);
}

//step 0 event listeners
document.getElementById('btnRegisterBack0').addEventListener('click', function () {
    window.location.href = '../index.html';
});

document.addEventListener('DOMContentLoaded', function () {
    const languageSelector = document.getElementById('language-selector');

    const translations = {
        //english translation
        en: {
            //login info
            titleStepOne: 'Login Information',

            clientRegisterEmail: 'Email',
            emailError: 'Please enter a valid email address.',

            clientRegisterPass: 'Password',
            passwordError: 'Password must include at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.',

            toggleClientRegisterPass: 'Show password',

            btnRegisterNext1: 'Next',
            btnRegisterBack1: 'Go back',

            //personal info
            titleStepTwo: 'Personal Information',

            clientFirstName: 'First Name',
            firstNameError: 'Please enter your first name.',

            clientMiddleInitial: 'Middle Initial',

            clientLastName: 'Last Name',
            lastNameError: 'Please enter your last name.',

            sexLabel: 'Sex',
            btnSexMale: 'Male',
            btnSexFemale: 'Female',
            btnSexIntersex: 'Intersex',
            sexError: 'Please select your sex.',

            clientDOB: 'Date of Birth',
            dobError: 'Please enter your date of birth.',

            clientPhone: 'Phone',
            phoneError: 'Phone is invalid format.',
            btnRegisterNext2: 'Next',
            btnRegisterBack2: 'Go back',

            //address info
            titleStepThree: 'Address Information',

            noAddress: 'No current address',
            clientAddress1: 'Street Address 1',
            clientAddress2: 'Street Address 2',
            address1Error: 'Please enter an address.',

            clientCity: 'City',
            cityError: 'Please enter a city.',

            selectState: 'State',
            stateError: 'Please select a state.',

            clientZipCode: 'Zip Code',
            zipCode: 'Please enter a 5-digit zip code.',

            btnRegisterNext3: 'Next',
            btnRegisterBack3: 'Go back',


            //emergency contact
            titleStepFour: 'Emergency Contact',

            noEmergencyContact: 'no Emergency Contact',

            emergencyContactFirstName: 'Contact First Name',
            contactFirstName: 'Please enter a first name for your contact.',

            emergencyContactLastName: 'Contact Last Name',
            contactLastName: 'Please enter a last name for your contact.',

            emergencyContactPhone: 'Contact Phone',
            contactPhone: 'Please enter a phone for your contact.',
            
            btnRegisterNext4: 'Next',
            btnRegisterBack4: 'Go back',


            //service select
            titleStepFive: 'Service Selection',

            btnServiceMedical: 'Medical',
            btnServiceDental: 'Dental',
            btnServiceOptical: 'Optical',
            btnServiceHaircut: 'Haircut4',

            serviceError: 'Please select at least one service.',

            btnRegisterNext5: 'Next',
            btnRegisterNext5: 'Go back',


            //wavier confrim
            waiverLabel: 'Waiver Agreement Required',
            collapseExample: 'DUO is not entitled to anything that happens to you. You accept full responsiblity at this event.',
            waiverAgree: 'I have read and agree.',
            waiverError: 'You must agree to the waiver to continue.',
            btnWaiverSubmit: 'Submit',
        },

        //spanish translation
        es: {
            //login info
            divStepOne: 'Login Information',

            clientRegisterEmail: 'Email',
            emailError: 'Please enter a valid email address.',

            clientRegisterPass: 'Password',
            passwordError: 'Password must include at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.',

            toggleClientRegisterPass: 'Show password',

            btnRegisterNext1: 'Next',
            btnRegisterBack1: 'Go back',

            //personal info
            divStepTwo: 'Personal Information',

            clientFirstName: 'First Name',
            firstNameError: 'Please enter your first name.',

            clientMiddleInitial: 'Middle Initial',

            clientLastName: 'Last Name',
            lastNameError: 'Please enter your last name.',

            sexLabel: 'Sex',
            btnSexMale: 'Male',
            btnSexFemale: 'Female',
            btnSexIntersex: 'Intersex',
            sexError: 'Please select your sex.',

            clientDOB: 'Date of Birth',
            dobError: 'Please enter your date of birth.',

            clientPhone: 'Phone',
            phoneError: 'Phone is invalid format.',
            btnRegisterNext2: 'Next',
            btnRegisterBack2: 'Go back',

            //address info
            divStepThree: 'Address Information',

            noAddress: 'No current address',
            clientAddress1: 'Street Address 1',
            clientAddress2: 'Street Address 2',
            address1Error: 'Please enter an address.',

            clientCity: 'City',
            cityError: 'Please enter a city.',

            selectState: 'State',
            stateError: 'Please select a state.',

            clientZipCode: 'Zip Code',
            zipCode: 'Please enter a 5-digit zip code.',

            btnRegisterNext3: 'Next',
            btnRegisterBack3: 'Go back',


            //emergency contact
            divStepFour: 'Emergency Contact',

            noEmergencyContact: 'no Emergency Contact',

            emergencyContactFirstName: 'Contact First Name',
            contactFirstName: 'Please enter a first name for your contact.',

            emergencyContactLastName: 'Contact Last Name',
            contactLastName: 'Please enter a last name for your contact.',

            emergencyContactPhone: 'Contact Phone',
            contactPhone: 'Please enter a phone for your contact.',
            
            btnRegisterNext4: 'Next',
            btnRegisterBack4: 'Go back',


            //service select
            divStepFive: 'Service Selection',

            btnServiceMedical: 'Medical',
            btnServiceDental: 'Dental',
            btnServiceOptical: 'Optical',
            btnServiceHaircut: 'Haircut',

            serviceError: 'Please select at least one service.',

            btnRegisterNext5: 'Next',
            btnRegisterNext5: 'Go back',


            //wavier confrim
            waiverLabel: 'Waiver Agreement Required',
            collapseExample: 'DUO is not entitled to anything that happens to you. You accept full responsiblity at this event.',
            waiverAgree: 'I have read and agree.',
            waiverError: 'You must agree to the waiver to continue.',
            btnWaiverSubmit: 'Submit',
        }

    };
    //language listener
    languageSelector.addEventListener('change', function () {
        const selectedLanguage = languageSelector.value;
        const translation = translations[selectedLanguage];
        
        //login info
        //TO-DO: busywork lol, jsut rename these apropriately
        document.getElementById('divStepOne').textContent = translation.divStepOne;

        document.getElementById('clientRegisterEmail').textContent = translation.clientRegisterEmail;
        document.getElementById('emailError').textContent = translation.emailError;

        document.getElementById('clientRegisterPass').textContent = translation.clientRegisterPass;
        document.getElementById('passwordError').textContent = translation.passwordError;

        document.getElementById('toggleClientRegisterPass').textContent = translation.toggleClientRegisterPass;

        document.getElementById('btnRegisterNext1').textContent = translation.btnRegisterNext1;
        document.getElementById('btnRegisterBack1').textContent = translation.btnRegisterBack1;

        //personal info
        document.getElementById('divStepTwo').textContent = translation.divStepTwo;

        document.getElementById('clientFirstName').textContent = translation.clientFirstName;
        document.getElementById('firstNameError').textContent = translation.firstNameError;

        document.getElementById('clientMiddleInitial').textContent = translation.clientMiddleInitial;

        document.getElementById('clientLastName').textContent = translation.clientLastName;
        document.getElementById('lastNameError').textContent = translation.lastNameError;

        document.getElementById('sexLabel').textContent = translation.sexLabel;
        document.getElementById('btnSexMale').textContent = translation.btnSexMale;
        document.getElementById('btnSexFemale').textContent = translation.btnSexFemale;
        document.getElementById('btnSexIntersex').textContent = translation.btnSexIntersex;
        document.getElementById('sexError').textContent = translation.sexError;

        document.getElementById('clientDOB').textContent = translation.clientDOB;
        document.getElementById('dobError').textContent = translation.dobError;

        document.getElementById('clientPhone').textContent = translation.clientPhone;
        document.getElementById('phoneError').textContent = translation.phoneError;
        document.getElementById('btnRegisterNext2').textContent = translation.btnRegisterNext2;
        document.getElementById('btnRegisterBack2').textContent = translation.btnRegisterBack2;

        //address info
        document.getElementById('divStepThree').textContent = translation.divStepThree;

        document.getElementById('noAddress').textContent = translation.noAddress;
        document.getElementById('clientAddress1').textContent = translation.clientAddress1;
        document.getElementById('clientAddress1').textContent = translation.clientAddress2;
        document.getElementById('address1Error').textContent = translation.address1Error;

        document.getElementById('clientCity').textContent = translation.clientCity;
        document.getElementById('cityError').textContent = translation.cityError;

        document.getElementById('selectState').textContent = translation.selectState;
        document.getElementById('stateError').textContent = translation.stateError;

        document.getElementById('clientZipCode').textContent = translation.clientZipCode;
        document.getElementById('zipCode').textContent = translation.zipCode;

        document.getElementById('btnRegisterNext3').textContent = translation.btnRegisterNext3;
        document.getElementById('btnRegisterBack3').textContent = translation.btnRegisterBack3;

        //emergency
        document.getElementById('divStepFour').textContent = translation.divStepFour;

        document.getElementById('noEmergencyContact').textContent = translation.noEmergencyContact;

        document.getElementById('emergencyContactFirstName').textContent = translation.emergencyContactFirstName;
        document.getElementById('contactFirstName').textContent = translation.contactFirstName;

        document.getElementById('emergencyContactLastName').textContent = translation.emergencyContactLastName;
        document.getElementById('contactLastName').textContent = translation.contactLastName;

        document.getElementById('emergencyContactPhone').textContent = translation.emergencyContactPhone;
        document.getElementById('contactPhone').textContent = translation.contactPhone;

        document.getElementById('btnRegisterNext4').textContent = translation.btnRegisterNext4;
        document.getElementById('btnRegisterBack4').textContent = translation.btnRegisterBack4;

        //service
        document.getElementById('divStepFive').textContent = translation.divStepFive;

        document.getElementById('btnServiceMedical').textContent = translation.btnServiceMedical;
        document.getElementById('btnServiceDental').textContent = translation.btnServiceDental;
        document.getElementById('btnServiceOptical').textContent = translation.btnServiceOptical;
        document.getElementById('btnServiceHaircut').textContent = translation.btnServiceHaircut;

        document.getElementById('serviceError').textContent = translation.serviceError;

        document.getElementById('btnRegisterNext5').textContent = translation.btnRegisterNext5;
        document.getElementById('btnRegisterNext5').textContent = translation.btnRegisterNext5;

        //wavier
        document.getElementById('waiverLabel').textContent = translation.waiverLabel;
        document.getElementById('collapseExample').textContent = translation.collapseExample;
        document.getElementById('waiverAgree').textContent = translation.waiverAgree;
        document.getElementById('waiverError').textContent = translation.waiverError;
        document.getElementById('btnWaiverSubmit').textContent = translation.btnWaiverSubmit;
    });
});



// ============================================================================
// STEP 1: LOGIN INFO
// ============================================================================

function goToStepTwo() {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    document.getElementById('sexError').style.display = 'none';
    transitionToStep(stepOne, stepTwo, 2);
}

function stepOneSubmit() {
    const emailInput = document.getElementById('clientRegisterEmail');
    const passInput = document.getElementById('clientRegisterPass');
    let isValid = true;

    if (!VALIDATION_PATTERNS.email.test(emailInput.value)) {
        setFieldValidation(emailInput, false);
        isValid = false;
    } else {
        setFieldValidation(emailInput, true);
    }

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

// Step 1 event listeners
document.getElementById('clientRegisterFormStep1').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext1').click();
    }
});

document.getElementById('btnRegisterNext1').addEventListener('click', stepOneSubmit);

document.getElementById('btnRegisterBack1').addEventListener('click', function () {
    const stepOne = document.getElementById('divStepOne');
    const stepZero = document.getElementById('divStepZero');
    transitionToStep(stepOne, stepZero, 0);
});

document.getElementById('toggleClientRegisterPass').addEventListener('change', function () {
    const passwordInput = document.getElementById('clientRegisterPass');
    passwordInput.type = this.checked ? 'text' : 'password';
});


// ============================================================================
// STEP 2: PERSONAL INFO
// ============================================================================

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
    const sexError = document.getElementById('sexError');

    let isValid = true;

    if (!firstName.value.trim()) {
        setFieldValidation(firstName, false);
        isValid = false;
    } else {
        setFieldValidation(firstName, true);
    }

    if (!lastName.value.trim()) {
        setFieldValidation(lastName, false);
        isValid = false;
    } else {
        setFieldValidation(lastName, true);
    }

    // --- DOB 18+ validation ---
    if (!dob.value) {
        setFieldValidation(dob, false);
        isValid = false;
    } else {
        // Check if DOB is at least 18 years ago
        const enteredDate = new Date(dob.value);
        const today = new Date();
        const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        if (enteredDate > minAgeDate) {
            setFieldValidation(dob, false);
            isValid = false;
            // Optionally show a message:
            dob.setCustomValidity('You must be at least 18 years old.');
            dob.reportValidity();
        } else {
            setFieldValidation(dob, true);
            dob.setCustomValidity('');
        }
    }

    const sexSelected = Array.from(sexRadios).some(radio => radio.checked);
    if (!sexSelected) {
        sexError.style.display = 'block';
        isValid = false;
    } else {
        sexError.style.display = 'none'; // Always hide if valid
    }

    // Phone is optional but validate format if provided
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

// Step 2 event listeners
document.getElementById('clientRegisterFormStep2').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext2').click();
    }
});

document.getElementById('btnRegisterNext2').addEventListener('click', stepTwoSubmit);

document.getElementById('btnRegisterBack2').addEventListener('click', function () {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    transitionToStep(stepTwo, stepOne, 1);
});


// ============================================================================
// STEP 3: ADDRESS INFO
// ============================================================================

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

    let isValid = true;

    const address1 = document.getElementById('clientAddress1');
    if (!address1.value.trim()) {
        address1.classList.add('is-invalid');
        isValid = false;
    } else {
        address1.classList.remove('is-invalid');
    }

    const city = document.getElementById('clientCity');
    if (!city.value.trim()) {
        city.classList.add('is-invalid');
        isValid = false;
    } else {
        city.classList.remove('is-invalid');
    }

    const state = document.getElementById('selectState');
    if (!state.value) {
        state.classList.add('is-invalid');
        isValid = false;
    } else {
        state.classList.remove('is-invalid');
    }

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


// ============================================================================
// STEP 4: EMERGENCY CONTACT
// ============================================================================

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

    let isValid = true;

    const firstName = document.getElementById('emergencyContactFirstName');
    if (!firstName.value.trim()) {
        firstName.classList.add('is-invalid');
        isValid = false;
    } else {
        firstName.classList.remove('is-invalid');
    }

    const lastName = document.getElementById('emergencyContactLastName');
    if (!lastName.value.trim()) {
        lastName.classList.add('is-invalid');
        isValid = false;
    } else {
        lastName.classList.remove('is-invalid');
    }

    const phone = document.getElementById('emergencyContactPhone');
    if (!phone.value.match(VALIDATION_PATTERNS.phoneFormatted)) {
        phone.classList.add('is-invalid');
        isValid = false;
    } else {
        phone.classList.remove('is-invalid');
    }

    if (isValid) {
        goToStepFive();
    }
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


// ============================================================================
// STEP 5: SERVICE SELECTION
// ============================================================================

document.getElementById('btnRegisterNext5').addEventListener('click', function () {
    const services = document.querySelectorAll('input[name="clientServices"]:checked');
    const serviceError = document.getElementById('serviceError');

    if (services.length === 0) {
        serviceError.style.display = 'block';
        return;
    }

    serviceError.style.display = 'none';

    // Show waiver modal
    const modal = new bootstrap.Modal(document.getElementById('registrationCompleteModal'));
    modal.show();
});

document.getElementById('btnRegisterBack5').addEventListener('click', function () {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    transitionToStep(stepFive, stepFour, 4);
});


// ============================================================================
// INPUT MASKS
// ============================================================================

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

// Emergency contact names
document.getElementById('emergencyContactFirstName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});

document.getElementById('emergencyContactLastName').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(INPUT_FILTERS.name, '');
});


// ============================================================================
// WAIVER MODAL & FORM SUBMISSION
// ============================================================================

document.getElementById('btnWaiverSubmit').addEventListener('click', function () {
    const waiverCheckbox = document.getElementById('waiverAgree');
    const waiverError = document.getElementById('waiverError');

    if (!waiverCheckbox.checked) {
        waiverError.style.display = 'block';
        return;
    }

    waiverError.style.display = 'none';

    // Collect all form data
    const formData = {
        // Step 1
        email: document.getElementById('clientRegisterEmail').value,
        password: document.getElementById('clientRegisterPass').value,

        // Step 2
        firstName: document.getElementById('clientFirstName').value,
        middleInitial: document.getElementById('clientMiddleInitial').value,
        lastName: document.getElementById('clientLastName').value,
        dob: document.getElementById('clientDOB').value,
        phone: document.getElementById('clientPhone').value,
        sex: document.querySelector('input[name="clientSex"]:checked')?.value || '',

        // Step 3
        noAddress: document.getElementById('noAddress').checked,
        address1: document.getElementById('clientAddress1').value,
        address2: document.getElementById('clientAddress2').value,
        city: document.getElementById('clientCity').value,
        state: document.getElementById('selectState').value,
        zipCode: document.getElementById('clientZipCode').value,

        // Step 4
        noEmergencyContact: document.getElementById('noEmergencyContact').checked,
        emergencyFirstName: document.getElementById('emergencyContactFirstName').value,
        emergencyLastName: document.getElementById('emergencyContactLastName').value,
        emergencyPhone: document.getElementById('emergencyContactPhone').value,

        // Step 5
        services: Array.from(
            document.querySelectorAll('input[name="clientServices"]:checked')
        ).map(s => s.value),
    };

    // Send to API
    fetch('../api/register.php', {
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
                    title: 'Registration Complete!',
                    text: 'Your account has been created successfully.',
                    confirmButtonColor: '#174593'
                }).then(() => {
                    window.location.href = '../index.html';
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Registration Failed',
                    text: data.message || 'An error occurred. Please try again.',
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
                title: 'Connection Error',
                text: 'Unable to connect to the server. Please try again later.',
                confirmButtonColor: '#174593'
            });
        });
});


// ============================================================================
// DEBUG - Skip to any step (remove in production)
// ============================================================================

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
            if (index === stepNumber - 1) {
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

const tempClientID = "9df12a-3lha05-f44zp1"
const tempServices = ["medical", "dental", "optical", "haircut"]

document.getElementById('skipStep1').addEventListener('click', () => showStepOnly(1));
document.getElementById('skipStep2').addEventListener('click', () => showStepOnly(2));
document.getElementById('skipStep3').addEventListener('click', () => showStepOnly(3));
document.getElementById('skipStep4').addEventListener('click', () => showStepOnly(4));
document.getElementById('skipStep5').addEventListener('click', () => showQR(tempClientID, "Bobby", "Jones", tempServices));


// QR Code Logic
function hideLoginStuff() {
    // Hide login step container
    const loginStep1 = document.getElementById('divStepOne');
    if (loginStep1) loginStep1.style.display = 'none';

    const loginStep2 = document.getElementById('divStepTwo');
    if (loginStep2) loginStep2.style.display = 'none';

    const loginStep3 = document.getElementById('divStepThree');
    if (loginStep3) loginStep3.style.display = 'none';

    const loginStep4 = document.getElementById('divStepFour');
    if (loginStep4) loginStep4.style.display = 'none';

    const loginStep5 = document.getElementById('divStepFive');
    if (loginStep5) loginStep5.style.display = 'none';

    // Hide skip step button if present
    const skipStep1 = document.getElementById('skipStep1');
    if (skipStep1) skipStep1.style.display = 'none';

    // Hide skip step button if present
    const skipStep2 = document.getElementById('skipStep2');
    if (skipStep2) skipStep2.style.display = 'none';

    // Hide skip step button if present
    const skipStep3 = document.getElementById('skipStep3');
    if (skipStep3) skipStep3.style.display = 'none';

    // Hide skip step button if present
    const skipStep4 = document.getElementById('skipStep4');
    if (skipStep4) skipStep4.style.display = 'none';

    // Hide other stuff
    const substitle = document.getElementById('divStepOneSubtitle');
    if (substitle) substitle.style.display = 'none';

    const wholeProgressBar = document.getElementById('wholeProgressBar');
    if (wholeProgressBar) wholeProgressBar.style.display = 'none';
}

function showQR(clientID, firstName, lastName, services, language) {
    hideLoginStuff()

    var qr = new QRious({
        element: document.getElementById('qr'),
        value: clientID,
        size: 200,
    })

    if (Array.isArray(services)) {
        if (services.includes("medical")) {
            document.getElementById('qrCardMedicalIcon').style.display = "block"
        }
        if (services.includes("dental")) {
            document.getElementById('qrCardDentalIcon').style.display = "block"
        }
        if (services.includes("optical")) {
            document.getElementById('qrCardOpticalIcon').style.display = "block"
        }
        if (services.includes("haircut")) {
            document.getElementById('qrCardHaircutIcon').style.display = "block"
        }
    }

    // Set the QR card title to the user's name
    const qrTitle = document.getElementById('qrCardTitle');
    if (qrTitle) {
        qrTitle.textContent = `${firstName} ${lastName}`;
    }

    const qrCode = document.getElementById('divQRCode');
    qrCode.style.display = 'flex';
    document.getElementById('divQRCode').classList.remove('d-none');
}