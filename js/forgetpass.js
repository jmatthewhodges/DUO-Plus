/**
 * ============================================================
 *  File:        forgetpass.js
 *  Purpose:     Handles forget password form validation and reset functionality
 *
 *  Last Modified By:  Lauren
 *  Last Modified On:  March 5 @ 3:47 PM
 *  Changes Made:      Updated pop-up responses and removed 
 *                     the success response based on Burchfield
 *                     feedback. Also made it more flexible.
 * ============================================================
*/

// Global state

let dobMask = null;
let verifiedIdentity = null;

// Config

const VALIDATION_PATTERNS = {
    email: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i,
    password: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\S{8,}$/
};

const API_URL = '../api/forgetpass.php';


// ============================================================
//   UTILITIES
// ============================================================

// Translation 
function getText(key, fallback) {
    const lang = sessionStorage.getItem('lang') || 'en';
    return window.translations?.[lang]?.[key] || fallback;
}


// Sweet Alerts
function showAlert(options) {
    return Swal.fire({
        confirmButtonColor: '#174593',
        allowEscapeKey: true,
        allowOutsideClick: true,
        ...options
    });
}


// Toggle valid/isnotvalid
function setFieldValidation(field, isValid) {
    field.classList.toggle('is-valid', isValid);
    field.classList.toggle('is-invalid', !isValid);
}


// Clear validation marker
function clearFieldValidation(field) {
    field.classList.remove('is-valid', 'is-invalid');
}


// API call helper
async function postJson(body) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    let data = null;

    try {
        data = await response.json();
    } catch (e) {
        data = null;
    }

    if (!response.ok) {
        const err = new Error(data?.message || 'Request failed.');
        err.response = response;
        err.data = data;
        throw err;
    }

    return data || {};
}


// Loading
function setButtonLoading(btn, isLoading, textKey, fallback) {
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
        ? `<span class="spinner-border spinner-border-sm"></span> ${getText(textKey, fallback)}`
        : getText(textKey, fallback);
}


// ============================================================
//   DATE OF BIRTH MASK
// ============================================================ 

// Create or recreate DOB mask based on language
// EN = MM/DD/YYYY, ES = DD/MM/YYYY
function createDobMask(lang) {
    const dobInput = document.getElementById('txtForgetDOB');
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

    dobInput.placeholder = isSpanish ? 'DD/MM/AAAA' : 'MM/DD/YYYY';

    if (currentValue) {
        try { dobMask.value = currentValue; } catch (e) { dobMask.value = ''; }
    }
}


// Convert masked DOB to ISO
function getDobIso() {
    const parsed = dobMask?.typedValue;
    if (!(parsed instanceof Date) || isNaN(parsed)) return '';
    return parsed.toISOString().split('T')[0];
}


// Live marker updates

function updateIdentityFieldMarkers() {
    const emailInput = document.getElementById('txtForgetEmail');
    const dobInput = document.getElementById('txtForgetDOB');

    const emailValue = emailInput.value.trim();
    const dobHasValue = dobInput.value.trim().length > 0;

    if (!emailValue) {
        clearFieldValidation(emailInput);
    } else {
        setFieldValidation(emailInput, VALIDATION_PATTERNS.email.test(emailValue));
    }

    if (!dobHasValue) {
        clearFieldValidation(dobInput);
    } else {
        setFieldValidation(dobInput, !!getDobIso());
    }
}


// Live password markers
function updatePasswordFieldMarkers() {
    const passInput = document.getElementById('txtForgetPassword');
    const confirmInput = document.getElementById('txtForgetPasswordConfirm');

    const password = passInput.value;
    const confirm = confirmInput.value;

    if (!password) {
        clearFieldValidation(passInput);
    } else {
        setFieldValidation(passInput, VALIDATION_PATTERNS.password.test(password));
    }

    if (!confirm) {
        clearFieldValidation(confirmInput);
    } else {
        const matches = password === confirm && VALIDATION_PATTERNS.password.test(password);
        setFieldValidation(confirmInput, matches);
    }
}


// ============================================================
//   GLOBAL STATE MANAGEMENT
// ============================================================ 

function resetVerificationState() {
    verifiedIdentity = null;
    elements.verifySection.classList.remove('d-none');
    elements.resetSection.classList.add('d-none');
}

// ============================================================
//   Step 1: Verification
// ============================================================ 

async function handleVerifyAccount() {

    const email = elements.emailInput.value.trim();
    const dob = getDobIso();
    const errors = [];

    if (!VALIDATION_PATTERNS.email.test(email)) {
        errors.push(getText('emailError', 'Please enter a valid email address.'));
        setFieldValidation(elements.emailInput, false);
    }

    if (!dob) {
        errors.push(getText('dobError', 'Please enter your date of birth.'));
        setFieldValidation(elements.dobInput, false);
    }

    if (errors.length) {
        showAlert({
            icon: 'error',
            title: getText('loginCheckInfoTitle', 'Check your info'),
            html: errors.map(e => `• ${e}`).join('<br>')
        });
        return;
    }

    try {
        setButtonLoading(elements.verifyBtn, true, 'verifyingText', 'Verifying...');

        const data = await postJson({
            action: 'verify',
            email,
            dob
        });

        if (!data.success) {
            throw new Error(getText('emailDobIncorrectText', 'Email and Date of Birth combination are incorrect'));
        }

        verifiedIdentity = { email, dob };

        elements.verifySection.classList.add('d-none');
        elements.resetSection.classList.remove('d-none');

        setFieldValidation(elements.emailInput, true);
        setFieldValidation(elements.dobInput, true);

    } catch (error) {
        verifiedIdentity = null;

        showAlert({
            icon: 'error',
            title: getText('emailDobIncorrectTitle', 'Incorrect Information'),
            text: getText('emailDobIncorrectText', 'Email and Date of Birth combination are incorrect')
        });
    } finally {
        setButtonLoading(elements.verifyBtn, false, 'btnVerifyAccount', 'Verify Account');
    }
}


// ============================================================
//   Step 2: Resetting Password
// ============================================================ 

async function handleResetPassword() {

    if (!verifiedIdentity) {
        showAlert({
            icon: 'error',
            title: getText('verifyFirstTitle', 'Verify First'),
            text: getText('verifyFirstText', 'Please verify first.')
        });
        return;
    }

    const password = elements.passInput.value;
    const confirm = elements.confirmInput.value;
    const errors = [];

    if (!VALIDATION_PATTERNS.password.test(password)) {
        errors.push(getText('passwordError', 'Invalid password format.'));
        setFieldValidation(elements.passInput, false);
    } else {
        setFieldValidation(elements.passInput, true);
    }

    if (!confirm || confirm !== password) {
        errors.push(getText('confirmPasswordError', 'Passwords do not match.'));
        setFieldValidation(elements.confirmInput, false);
    } else {
        setFieldValidation(elements.confirmInput, true);
    }

    if (errors.length) {
        showAlert({
            icon: 'error',
            title: getText('loginCheckInfoTitle', 'Check your info'),
            html: errors.map(e => `• ${e}`).join('<br>')
        });
        return;
    }

    try {
        setButtonLoading(elements.resetBtn, true, 'resettingText', 'Resetting...');

        const data = await postJson({
            action: 'reset',
            email: verifiedIdentity.email,
            dob: verifiedIdentity.dob,
            password
        });

        if (!data.success) {
            throw new Error(data.message || 'Reset failed.');
        }

        window.location.href = '../index.html';

    } catch (error) {
        showAlert({
            icon: 'error',
            title: getText('passwordResetFailedTitle', 'Reset Failed'),
            text: error.message
        });
    } finally {
        setButtonLoading(elements.resetBtn, false, 'btnResetPassword', 'Reset Password');
    }
}

// ============================================================
//   INITIALIZATION
// ============================================================ 

let elements = {};

document.addEventListener('DOMContentLoaded', () => {

    const savedLang = sessionStorage.getItem('lang') || 'en';
    createDobMask(savedLang);

    elements = {
        emailInput: document.getElementById('txtForgetEmail'),
        dobInput: document.getElementById('txtForgetDOB'),
        passInput: document.getElementById('txtForgetPassword'),
        confirmInput: document.getElementById('txtForgetPasswordConfirm'),
        verifyBtn: document.getElementById('btnVerifyAccount'),
        resetBtn: document.getElementById('btnResetPassword'),
        verifySection: document.getElementById('verifySection'),
        resetSection: document.getElementById('resetSection')
    };

    // Identity markers
    elements.emailInput.addEventListener('blur', updateIdentityFieldMarkers);
    elements.dobInput.addEventListener('blur', updateIdentityFieldMarkers);

    elements.emailInput.addEventListener('input', function () {
        resetVerificationState();
        updateIdentityFieldMarkers();
    });

    elements.dobInput.addEventListener('input', function () {
        resetVerificationState();
        updateIdentityFieldMarkers();
    });

    // Password markers
    elements.passInput.addEventListener('blur', updatePasswordFieldMarkers);
    elements.confirmInput.addEventListener('blur', updatePasswordFieldMarkers);

    elements.passInput.addEventListener('input', updatePasswordFieldMarkers);
    elements.confirmInput.addEventListener('input', updatePasswordFieldMarkers);

    // Submit on Enter — verify section
    [elements.emailInput, elements.dobInput].forEach(input => {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleVerifyAccount();
            }
        });
    });

    // Submit on Enter — reset section
    [elements.passInput, elements.confirmInput].forEach(input => {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleResetPassword();
            }
        });
    });

        // Verify button
    elements.verifyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleVerifyAccount();
    });

    // Reset button
    elements.resetBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleResetPassword();
    });

});



