/* ==========================================================================
   STEP TRANSITIONS
   ========================================================================== */

// Step 1 -> step 2 transition
function goToStepTwo()
{
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    
    // Fade out step one first
    stepOne.style.opacity = '0';
    
    setTimeout(() => {
        // Hide step one completely
        stepOne.classList.remove('step-visible');
        stepOne.classList.add('step-hidden');
        
        // Show step two
        stepTwo.classList.remove('step-hidden');
        stepTwo.classList.add('step-visible');
        stepTwo.style.opacity = '1';
        updateProgressBar(2);
    }, 500);
}

// Step 2 -> Step 3 transition
function goToStepThree() {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    
    stepTwo.style.opacity = '0';
    
    setTimeout(() => {
        stepTwo.classList.remove('step-visible');
        stepTwo.classList.add('step-hidden');
        
        stepThree.classList.remove('step-hidden');
        stepThree.classList.add('step-visible');
        stepTwo.style.opacity = '1';
        updateProgressBar(3);
    }, 500);
}

// Step 3 -> Step 4 transition
function goToStepFour() {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    
    stepThree.style.opacity = '0';
    
    setTimeout(() => {
        stepThree.classList.remove('step-visible');
        stepThree.classList.add('step-hidden');
        
        stepFour.classList.remove('step-hidden');
        stepFour.classList.add('step-visible');
        stepFour.style.opacity = '1';
        updateProgressBar(4);
    }, 500);
}

// Step 4 -> Step 5 transition
function goToStepFive() {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    
    stepFour.style.opacity = '0';
    
    setTimeout(() => {
        stepFour.classList.remove('step-visible');
        stepFour.classList.add('step-hidden');
        
        stepFive.classList.remove('step-hidden');
        stepFive.classList.add('step-visible');
        stepFive.style.opacity = '1';
        updateProgressBar(5);
    }, 500);
}

/* ==========================================================================
   PROGRESS BAR
   ========================================================================== */

function updateProgressBar(step) {
    const progressBar = document.getElementById('progressBarTop');
    const percentage = step * 20;

    if (step == 5) {
        progressBar.style.width = 99 + '%';
        progressBar.textContent = 99 + '%';
        progressBar.setAttribute('aria-valuenow', 99);
        return;
    }
    
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
    progressBar.setAttribute('aria-valuenow', percentage);
}

/* ==========================================================================
   STEP 1: LOGIN INFORMATION
   ========================================================================== */

// Step 1 validation
function stepOneSubmit() 
{
    const strEmailInput = document.getElementById("clientRegisterEmail")
    const strPassInput = document.getElementById("clientRegisterPass")
    let isValid = false

    const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/

    // Email validation (john@example.com)
    if (!emailRegex.test(strEmailInput.value))
    {
        strEmailInput.classList.add('is-invalid');
        strEmailInput.classList.remove('is-valid');
        isValid = false
    } 
    else 
    {
        strEmailInput.classList.add('is-valid');
        strEmailInput.classList.remove('is-invalid');
        isValid = true
    }

    // Password validation (Password123)
    if (!passwordRegex.test(strPassInput.value))
    {
        strPassInput.classList.add('is-invalid');
        strPassInput.classList.remove('is-valid');
        isValid = false
    }
    else
    {
        strPassInput.classList.remove('is-invalid');
        strPassInput.classList.add('is-valid');
        isValid = true
    }

    if (isValid) {
        goToStepTwo();
    }
}

// Step 1 submit form on enter
document.getElementById('clientRegisterFormStep1').addEventListener('keydown', function(e)
{
    if (e.key === 'Enter') 
    {
        e.preventDefault();
        document.getElementById('btnRegisterNext1').click();
    }
})

// Step 1 "Next" button
document.getElementById('btnRegisterNext1').addEventListener('click', stepOneSubmit);

// Toggle password visibility
document.getElementById('toggleClientRegisterPass').addEventListener('change', function() 
{
    const passwordInput = document.getElementById('clientLoginPass');
    passwordInput.type = this.checked ? 'text' : 'password';
})


/* ==========================================================================
   STEP 2: PERSONAL INFORMATION
   ========================================================================== */

// Step 2 validation
function stepTwoSubmit() {
    const firstName = document.getElementById('clientFirstName');
    const lastName = document.getElementById('clientLastName');
    const dob = document.getElementById('clientDOB');
    const phone = document.getElementById('clientPhone');
    const sexRadios = document.querySelectorAll('input[name="clientSex"]');
    const sexError = document.getElementById('sexError');

    let isValid = true;

    // First name validation (required)
    if (!firstName.value.trim()) {
        firstName.classList.add('is-invalid');
        firstName.classList.remove('is-valid');
        isValid = false;
    } else {
        firstName.classList.remove('is-invalid');
        firstName.classList.add('is-valid');
    }

    // Last name validation (required)
    if (!lastName.value.trim()) {
        lastName.classList.add('is-invalid');
        lastName.classList.remove('is-valid');
        isValid = false;
    } else {
        lastName.classList.remove('is-invalid');
        lastName.classList.add('is-valid');
    }

    // DOB validation (required)
    if (!dob.value) {
        dob.classList.add('is-invalid');
        dob.classList.remove('is-valid');
        isValid = false;
    } else {
        dob.classList.remove('is-invalid');
        dob.classList.add('is-valid');
    }

    // Sex selection validation (required)
    const sexSelected = Array.from(sexRadios).some(radio => radio.checked);
    if (!sexSelected) {
        sexError.style.display = 'block';
        isValid = false;
    } else {
        sexError.style.display = 'none';
    }

    // Phone validation (required, basic format check)
    const phoneRegex = /^[\d\s\-\(\)]{10,}$/; // At least 10 digits
    if (phone.value.length > 0) {
        if (!phoneRegex.test(phone.value.replace(/\s/g, ''))) {
            phone.classList.add('is-invalid');
            phone.classList.remove('is-valid');
            isValid = false;
        } else {
            phone.classList.remove('is-invalid');
            phone.classList.add('is-valid');
        }
    }

    if (isValid) {
        goToStepThree();
    }
}

// Step 2 submit form on enter
document.getElementById('clientRegisterFormStep2').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnRegisterNext2').click();
    }
});

// Step 2 "Next" button
document.getElementById('btnRegisterNext2').addEventListener('click', stepTwoSubmit);

// Step 2 "Back" button
document.getElementById('btnRegisterBack2').addEventListener('click', function() {
    const stepOne = document.getElementById('divStepOne');
    const stepTwo = document.getElementById('divStepTwo');
    
    stepTwo.style.opacity = '0';
    
    setTimeout(() => {
        stepTwo.classList.remove('step-visible');
        stepTwo.classList.add('step-hidden');
        
        stepOne.classList.remove('step-hidden');
        stepOne.classList.add('step-visible');
        stepOne.style.opacity = '1';
        updateProgressBar(1);
    }, 500);
});

/* ==========================================================================
   STEP 3: ADDRESS INFORMATION
   ========================================================================== */

// Toggle address fields when "no address" checkbox is checked
const noAddressCheckbox = document.getElementById('noAddress');
const addressFields = [
    document.getElementById('clientAddress1'),
    document.getElementById('clientAddress2'),
    document.getElementById('clientCity'),
    document.getElementById('selectState'),
    document.getElementById('clientZipCode')
];

noAddressCheckbox.addEventListener('change', function() {
    addressFields.forEach(field => {
        const container = field.closest('.mb-3');
        if (this.checked) {
            container.style.display = 'none';
            field.removeAttribute('required');
        } else {
            container.style.display = 'block';
            // Restore required except for Address 2
            if (field.id !== 'clientAddress2') {
                field.setAttribute('required', '');
            }
        }
    });
});

// Step 3 validation
document.getElementById('btnRegisterNext3').addEventListener('click', function() {
    const form = document.getElementById('clientRegisterFormStep3');
    const noAddress = document.getElementById('noAddress').checked;
    
    // If no address is checked, skip validation and proceed
    if (noAddress) {
        goToStepFour();
        return;
    }

    let isValid = true;

    // Validate Address 1
    const address1 = document.getElementById('clientAddress1');
    if (!address1.value.trim()) {
        address1.classList.add('is-invalid');
        isValid = false;
    } else {
        address1.classList.remove('is-invalid');
    }

    // Validate City
    const city = document.getElementById('clientCity');
    if (!city.value.trim()) {
        city.classList.add('is-invalid');
        isValid = false;
    } else {
        city.classList.remove('is-invalid');
    }

    // Validate State
    const state = document.getElementById('selectState');
    if (!state.value) {
        state.classList.add('is-invalid');
        isValid = false;
    } else {
        state.classList.remove('is-invalid');
    }

    // Validate Zip Code (must be exactly 5 digits)
    const zipCode = document.getElementById('clientZipCode');
    if (!zipCode.value.match(/^[0-9]{5}$/)) {
        zipCode.classList.add('is-invalid');
        isValid = false;
    } else {
        zipCode.classList.remove('is-invalid');
    }

    if (isValid) {
        goToStepFour();
    }
});

// Step 3 back button
document.getElementById('btnRegisterBack3').addEventListener('click', function() {
    const stepTwo = document.getElementById('divStepTwo');
    const stepThree = document.getElementById('divStepThree');
    
    stepThree.style.opacity = '0';
    
    setTimeout(() => {
        stepThree.classList.remove('step-visible');
        stepThree.classList.add('step-hidden');
        
        stepTwo.classList.remove('step-hidden');
        stepTwo.classList.add('step-visible');
        stepTwo.style.opacity = '1';
        updateProgressBar(2);
    }, 500);
});

/* ==========================================================================
   STEP 4: EMERGENCY CONTACT
   ========================================================================== */

// Toggle emergency contact fields when "no emergency contact" checkbox is checked
const noEmergencyContactCheckbox = document.getElementById('noEmergencyContact');
const emergencyContactFields = [
    document.getElementById('emergencyContactFirstName'),
    document.getElementById('emergencyContactLastName'),
    document.getElementById('emergencyContactPhone')
];

noEmergencyContactCheckbox.addEventListener('change', function() {
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
document.getElementById('btnRegisterNext4').addEventListener('click', function() {
    const noEmergencyContact = document.getElementById('noEmergencyContact').checked;
    
    // If no emergency contact is checked, skip validation and proceed
    if (noEmergencyContact) {
        goToStepFive();
        return;
    }

    let isValid = true;

    // Validate First Name
    const firstName = document.getElementById('emergencyContactFirstName');
    if (!firstName.value.trim()) {
        firstName.classList.add('is-invalid');
        isValid = false;
    } else {
        firstName.classList.remove('is-invalid');
    }

    // Validate Last Name
    const lastName = document.getElementById('emergencyContactLastName');
    if (!lastName.value.trim()) {
        lastName.classList.add('is-invalid');
        isValid = false;
    } else {
        lastName.classList.remove('is-invalid');
    }

    // Validate Phone (must be formatted as (123) 456-7890)
    const phone = document.getElementById('emergencyContactPhone');
    if (!phone.value.match(/^\(\d{3}\) \d{3}-\d{4}$/)) {
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

// Step 4 back button
document.getElementById('btnRegisterBack4').addEventListener('click', function() {
    const stepThree = document.getElementById('divStepThree');
    const stepFour = document.getElementById('divStepFour');
    
    stepFour.style.opacity = '0';
    
    setTimeout(() => {
        stepFour.classList.remove('step-visible');
        stepFour.classList.add('step-hidden');
        
        stepThree.classList.remove('step-hidden');
        stepThree.classList.add('step-visible');
        stepThree.style.opacity = '1';
        updateProgressBar(3);
    }, 500);
});

/* ==========================================================================
   STEP 5: SERVICE SELECTION
   ========================================================================== */

// Step 5 validation
document.getElementById('btnRegisterNext5').addEventListener('click', function() {
    const services = document.querySelectorAll('input[name="clientServices"]:checked');
    const serviceError = document.getElementById('serviceError');
    
    if (services.length === 0) {
        serviceError.style.display = 'block';
        return;
    }
    
    serviceError.style.display = 'none';
    
    const selectedServices = Array.from(services).map(s => s.value);
    console.log('Selected services:', selectedServices);
    console.log('Registration complete!');
});

// Step 5 back button
document.getElementById('btnRegisterBack5').addEventListener('click', function() {
    const stepFour = document.getElementById('divStepFour');
    const stepFive = document.getElementById('divStepFive');
    
    stepFive.style.opacity = '0';
    
    setTimeout(() => {
        stepFive.classList.remove('step-visible');
        stepFive.classList.add('step-hidden');
        
        stepFour.classList.remove('step-hidden');
        stepFour.classList.add('step-visible');
        stepFour.style.opacity = '1';
        updateProgressBar(4);
    }, 500);
});

/* ==========================================================================
   INPUT MASKS
   ========================================================================== */

// First name input mask (letters, hyphens, apostrophes only)
document.getElementById('clientFirstName').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z'-]/g, '');
});

// Middle initial input mask (single letter only)
document.getElementById('clientMiddleInitial').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').substring(0, 1).toUpperCase();
});

// Last name input mask (letters, hyphens, apostrophes only)
document.getElementById('clientLastName').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z'-]/g, '');
});

// Phone input mask (formats as (123) 456-7890)
document.getElementById('clientPhone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    
    if (value.length > 10) {
        value = value.substring(0, 10); // Limit to 10 digits
    }
    
    if (value.length > 0) {
        if (value.length <= 3) {
            value = '(' + value;
        } else if (value.length <= 6) {
            value = '(' + value.substring(0, 3) + ') ' + value.substring(3);
        } else {
            value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
        }
    }
    
    e.target.value = value;
});

// Restrict zip code input to numbers only
document.getElementById('clientZipCode').addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
});

// Restrict city to letters, spaces, hyphens, and apostrophes only (e.g., O'Fallon, Winston-Salem)
document.getElementById('clientCity').addEventListener('input', function() {
    this.value = this.value.replace(/[^a-zA-Z\s\-']/g, '');
});

// Restrict street address to letters, numbers, spaces, and common address characters (#, ., -)
document.getElementById('clientAddress1').addEventListener('input', function() {
    this.value = this.value.replace(/[^a-zA-Z0-9\s\.\-#]/g, '');
});

document.getElementById('clientAddress2').addEventListener('input', function() {
    this.value = this.value.replace(/[^a-zA-Z0-9\s\.\-#]/g, '');
});

// Emergency contact first name input mask (letters, hyphens, apostrophes only)
document.getElementById('emergencyContactFirstName').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z'-]/g, '');
});

// Emergency contact last name input mask (letters, hyphens, apostrophes only)
document.getElementById('emergencyContactLastName').addEventListener('input', function(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z'-]/g, '');
});

// Emergency contact phone input mask (formats as (123) 456-7890)
document.getElementById('emergencyContactPhone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 10) {
        value = value.substring(0, 10);
    }
    
    if (value.length > 0) {
        if (value.length <= 3) {
            value = '(' + value;
        } else if (value.length <= 6) {
            value = '(' + value.substring(0, 3) + ') ' + value.substring(3);
        } else {
            value = '(' + value.substring(0, 3) + ') ' + value.substring(3, 6) + '-' + value.substring(6);
        }
    }
    
    e.target.value = value;
});

/* ==========================================================================
   TESTING / DEBUG
   ========================================================================== */

// Direct step navigation for testing (skips validation and transitions)
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

document.getElementById('skipStep1').addEventListener('click', () => showStepOnly(1));
document.getElementById('skipStep2').addEventListener('click', () => showStepOnly(2));
document.getElementById('skipStep3').addEventListener('click', () => showStepOnly(3));
document.getElementById('skipStep4').addEventListener('click', () => showStepOnly(4));
document.getElementById('skipStep5').addEventListener('click', () => showStepOnly(5));