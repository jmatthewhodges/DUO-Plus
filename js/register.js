/**
 * ============================================================
 *  File:        register.js
 *  Description: Multi-step registration form logic. Handles
 *               validation, input masks, step navigation,
 *               waiver agreement, and API submission for
 *               both new and returning users.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 18 @ 2:58 PM
 *  Changes Made:      Added multi-line comment header and cleaned up code
 * ============================================================
*/

// Config
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

// DOB 18+
const dobInput = document.getElementById('clientDOB');
const today = new Date();
const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
dobInput.max = minAgeDate.toISOString().split('T')[0];


// Progress bar
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
    const userData = JSON.parse(sessionStorage.getItem('userData'));

    // Only prefill if user is logged in
    if (userData) {
        // Step 1 - Login Info
        const emailInput = document.getElementById('clientRegisterEmail');
        const passInput = document.getElementById('clientRegisterPass');

        console.log(userData);

        emailInput.value = userData.Email || '';
        emailInput.disabled = true;

        passInput.value = userData.Password || '';
        passInput.disabled = true;

        // Disable back button on step 2 for logged in users
        document.getElementById('btnRegisterBack2').disabled = true;

        // Step 2 - Personal Info
        document.getElementById('clientFirstName').value = userData.FirstName || '';
        document.getElementById('clientMiddleInitial').value = userData.MiddleInitial || '';
        document.getElementById('clientLastName').value = userData.LastName || '';
        document.getElementById('clientDOB').value = userData.DOB || '';

        // Format phone if exists
        if (userData.Phone) {
            const digits = userData.Phone.replace(/\D/g, '');
            document.getElementById('clientPhone').value = formatPhoneNumber(digits);
        }

        // Set sex radio button
        if (userData.Sex) {
            const sexRadio = document.querySelector(`input[name="clientSex"][value="${userData.Sex}"]`);
            if (sexRadio) sexRadio.checked = true;
        }

        // Step 3 - Address Info
        if (userData.Street1) {
            document.getElementById('noAddress').checked = false;
            document.getElementById('clientAddress1').value = userData.Street1 || '';
            document.getElementById('clientAddress2').value = userData.Street2 || '';
            document.getElementById('clientCity').value = userData.City || '';
            document.getElementById('selectState').value = userData.State || '';
            document.getElementById('clientZipCode').value = userData.ZIP || '';
        } else {
            document.getElementById('noAddress').checked = true;
            document.getElementById('noAddress').dispatchEvent(new Event('change'));
        }

        // Step 4 - Emergency Contact
        if (userData.EmergencyName) {
            document.getElementById('noEmergencyContact').checked = false;
            // Split emergency name into first and last
            const nameParts = userData.EmergencyName.split(' ');
            document.getElementById('emergencyContactFirstName').value = nameParts[0] || '';
            document.getElementById('emergencyContactLastName').value = nameParts.slice(1).join(' ') || '';

            if (userData.EmergencyPhone) {
                const emergencyDigits = userData.EmergencyPhone.replace(/\D/g, '');
                document.getElementById('emergencyContactPhone').value = formatPhoneNumber(emergencyDigits);
            }
        } else {
            document.getElementById('noEmergencyContact').checked = true;
            document.getElementById('noEmergencyContact').dispatchEvent(new Event('change'));
        }

        goToStepTwo();
    }

});

//  Step 1 - Login Info
function goToStepTwo() {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    document.getElementById('sexError').style.display = 'none';
    transitionToStep(stepOne, stepTwo, 2);
}

function stepOneSubmit() {
    // Skip validation if user is already logged in
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (userData) {
        goToStepTwo();
        return;
    }

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

    // DOB 18+ validation
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
    // Phone is required and must be full and formatted
    if (!VALIDATION_PATTERNS.phoneFormatted.test(phone.value)) {
        setFieldValidation(phone, false);
        isValid = false;
    } else {
        setFieldValidation(phone, true);
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

// Step 5 - Service Selection
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

// Input masks
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

    const userData = JSON.parse(sessionStorage.getItem('userData'));

    // Collect all form data
    const formData = {
        // If we have ClientID, send it
        clientId: userData?.ClientID || null,

        // Language preference
        language: sessionStorage.getItem('lang') || 'en',

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

            // Clear userData after successful registration/update
            sessionStorage.removeItem('userData');

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