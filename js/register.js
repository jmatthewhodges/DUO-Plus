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

document.addEventListener('DOMContentLoaded', function () {

    const translations = {
        /* 
        this is basically what each language looks like under a template. follows a simple idea of  
        property: 'text for language',
        it allows for basically a copy and paste sort of idea, all current translations should look similar code wise.
        also makes editing the translation text easier
        en = english, es = spanish
        */

        // english translation
        en: {
            // Step 1 - login Info
            titleStepOne: 'Login Information',
            clientRegisterEmailLabel: 'Email',
            emailError: 'Please enter a valid email address.',
            clientRegisterPassLabel: 'Password',
            passwordError: 'Password must include at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.',
            toggleClientRegisterPassLabel: 'Show password',
            btnRegisterNext1: 'Next',
            btnRegisterBack1: 'Go back',

            // Step 2 - Personal Info
            titleStepTwo: 'Personal Information',
            clientFirstNameLabel: 'First Name',
            firstNameError: 'Please enter your first name.',
            clientMiddleInitialLabel: 'Middle Initial',
            clientLastNameLabel: 'Last Name',
            lastNameError: 'Please enter your last name.',
            sexLabel: 'Sex',
            btnSexMaleLabel: 'Male',
            btnSexFemaleLabel: 'Female',
            btnSexIntersexLabel: 'Intersex',
            sexError: 'Please select your sex.',
            clientDOBLabel: 'Date of Birth',
            dobError: 'Please enter your date of birth.',
            clientPhoneLabel: 'Phone',
            phoneError: 'Phone is invalid format.',
            btnRegisterNext2Label: 'Next',
            btnRegisterBack2Label: 'Go back',

            // Step 3 - Address Info
            titleStepThree: 'Address Information',
            noAddressLabel: 'No current address',
            clientAddress1Label: 'Street Address 1',
            clientAddress2Label: 'Street Address 2',
            address1Error: 'Please enter an address.',
            clientCityLabel: 'City',
            cityError: 'Please enter a city.',
            selectStateLabel: 'State',
            stateError: 'Please select a state.',
            clientZipCodeLabel: 'Zip Code',
            zipCode: 'Please enter a 5-digit zip code.',
            btnRegisterNext3: 'Next',
            btnRegisterBack3: 'Go back',

            // Step 4 - Emergency Contact
            titleStepFour: 'Emergency Contact',
            noEmergencyContactLabel: 'no Emergency Contact',
            emergencyContactFirstNameLabel: 'Contact First Name',
            contactFirstName: 'Please enter a first name for your contact.',
            emergencyContactLastNameLabel: 'Contact Last Name',
            contactLastName: 'Please enter a last name for your contact.',
            emergencyContactPhone: 'Contact Phone',
            contactPhone: 'Please enter a phone for your contact.',
            btnRegisterNext4: 'Next',
            btnRegisterBack4: 'Go back',

            // Step 5 - Service Select
            titleStepFive: 'Service Selection',
            btnServiceMedicalLabel: '🏥 Medical',
            btnServiceDentalLabel: '👁️ Dental',
            btnServiceOpticalLabel: '🦷 Optical',
            btnServiceHaircutLabel: '✂️ Haircut',
            serviceError: 'Please select at least one service.',
            btnRegisterNext5: 'Next',
            btnRegisterNext5: 'Go back',

            // Finale - Wavier Confirm
            waiverLabel: 'Waiver Agreement Required',
            collapseExample: 'DUO is not entitled to anything that happens to you. You accept full responsiblity at this event.',
            waiverAgreeLabel: 'I have read and agree.',
            waiverError: 'You must agree to the waiver to continue.',
            btnWaiverSubmit: 'Submit',
        },

        // Spanish Translation
        es: {
            // Step 1 - Login Info
            divStepOne: 'Información de Acceso',
            clientRegisterEmailLabel: 'Email / correo electronico',
            emailError: 'Por favor, entre una dirección de correo electrónico válida.',
            clientRegisterPassLabel: 'Contraseña',
            passwordError: 'Contraseña debe incluir mínimo 8 caracteres, 1 letra mayúscula, 1 letra minúscula y 1 número.',
            toggleClientRegisterPassLabel: 'Ver Contraseña',
            btnRegisterNext1: 'Siguiente',
            btnRegisterBack1: 'Regresar',

            // Step 2 - Personal Info
            divStepTwo: 'Información personal',
            clientFirstNameLabel: 'Primer nombre',
            firstNameError: 'Por favor entre su primer nombre.',
            clientMiddleInitialLabel: 'Inicial del segundo nombre',
            clientLastNameLabel: 'Apellido',
            lastNameError: 'Por favor entre su apellido.',
            sexLabel: 'Sexo',
            btnSexMaleLabel: 'Masculino',
            btnSexFemaleLabel: 'Femenino',
            btnSexIntersexLabel: 'Intersexual',
            sexError: 'Por favor seleccione su sexo.',
            clientDOBLabel: 'Fecha de nacimiento',
            dobError: 'Por favor entre su fecha de nacimiento.',
            clientPhoneLabel: 'Telefono',
            phoneError: 'Teléfono no es válido.',
            btnRegisterNext2: 'Siguiente',
            btnRegisterBack2: 'Regresar',

            // Step 3 - Address Info
            divStepThree: 'Información de residencia',
            noAddressLabel: 'no dirección al momento',
            clientAddress1Label: 'Dirección de residencia 1',
            clientAddress2Label: 'Dirección de residencia 2',
            address1Error: 'Por favor entre una dirección.',
            clientCityLabel: 'Ciudad',
            cityError: 'Por favor entre una ciudad.',
            selectStateLabel: 'Estado',
            stateError: 'Por favor seleccione un estado.',
            clientZipCodeLabel: 'Codigo postal',
            zipCode: 'Por favor entre un código postal de 5 dígitos.',
            btnRegisterNext3: 'Siguiente',
            btnRegisterBack3: 'Regresar',

            // Step 4 - Emergency Contact
            divStepFour: 'Contacto de emergencia',
            noEmergencyContactLabel: 'No contacto de emergencia',
            emergencyContactFirstNameLabel: 'Primer nombre de contacto de emergencia',
            contactFirstName: 'Por favor entre el primer nombre de su contacto',
            emergencyContactLastNameLabel: 'Apellido de su contacto de emergencia',
            contactLastName: 'Por favor, entre el apellido de su contacto',
            emergencyContactPhoneLabel: 'Teléfono de su contacto de emergencia',
            contactPhone: 'Por favor entre un teléfono de su contacto',
            btnRegisterNext4: 'Siguiente',
            btnRegisterBack4: 'Regresar',

            // Step 5 - Service Select
            divStepFive: 'Selección de servicio ',
            btnServiceMedicalLabel: '🏥 Medico',
            btnServiceDentalLabel: '🦷 Dental',
            btnServiceOpticalLabel: '👁️ Optico',
            btnServiceHaircutLabel: '✂️ Corte de pelo',
            serviceError: 'Por favor seleccione por lo menos 1 servicio',
            btnRegisterNext5: 'Siguiente',
            btnRegisterBack5: 'Regresar',

            // Finale - Wavier Confirm
            waiverLabel: 'Acuerdo de renuncia de responsabilidad requerido',
            collapseExample: 'DUO no es acreedor a nada que le suceda a usted. Usted acepta completa responsabilidad en este evento',
            waiverAgreeLabel: 'Yo he leído y estoy de acuerdo',
            waiverError: 'Usted debe estar de acuerdo con el acuerdo de renuncia de responsabilidad para continuar',
            btnWaiverSubmit: 'Entregar',
        }
    };
    
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
    window.location.href = '../index.html';
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

    // Phone is optional but must be full and formatted if provided
    if (phone.value.length > 0) {
        // Require exactly (999) 999-9999 format
        if (!VALIDATION_PATTERNS.phoneFormatted.test(phone.value)) {
            setFieldValidation(phone, false);
            isValid = false;
        } else {
            setFieldValidation(phone, true);
        }
    } else {
        setFieldValidation(phone, true); // Optional, so valid if empty
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
        setFieldValidation(address1, false);
        isValid = false;
    } else {
        setFieldValidation(address1, true);
    }

    const city = document.getElementById('clientCity');
    if (!city.value.trim()) {
        setFieldValidation(city, false);
        isValid = false;
    } else {
        setFieldValidation(city, true);
    }

    const state = document.getElementById('selectState');
    if (!state.value) {
        setFieldValidation(state, false);
        isValid = false;
    } else {
        setFieldValidation(state, true);
    }

    const zipCode = document.getElementById('clientZipCode');
    if (!zipCode.value.match(VALIDATION_PATTERNS.zipCode)) {
        setFieldValidation(zipCode, false);
        isValid = false;
    } else {
        setFieldValidation(zipCode, true);
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
        setFieldValidation(firstName, false);
        isValid = false;
    } else {
        setFieldValidation(firstName, true);
    }

    const lastName = document.getElementById('emergencyContactLastName');
    if (!lastName.value.trim()) {
        setFieldValidation(lastName, false);
        isValid = false;
    } else {
        setFieldValidation(lastName, true);
    }

    const phone = document.getElementById('emergencyContactPhone');
    // Phone is optional but must be full and formatted if provided
    if (phone.value.length > 0) {
        // Require exactly (999) 999-9999 format
        if (!VALIDATION_PATTERNS.phoneFormatted.test(phone.value)) {
            setFieldValidation(phone, false);
            isValid = false;
        } else {
            setFieldValidation(phone, true);
        }
    } else {
        setFieldValidation(phone, true); // Optional, so valid if empty
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
        // Remove phone input mask before sending
        phone: document.getElementById('clientPhone').value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
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
        // Remove phone input mask before sending
        emergencyPhone: document.getElementById('emergencyContactPhone').value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),

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
                    title: t.registrationSuccessTitle,
                    text: t.registrationSuccessText,
                    confirmButtonColor: '#174593',
                }).then(() => {
                    window.location.href = '../index.html';
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