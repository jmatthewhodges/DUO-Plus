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
    }, 800);
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
    }, 800);
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
    }, 800);
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


/* ==========================================================================
   TESTING / DEBUG
   ========================================================================== */

// Step navigation buttons for testing
document.getElementById('skipStep1').addEventListener('click', goToStepTwo);