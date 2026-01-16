/**
 * ============================================================================
 * DUO+ REGISTRATION FORM
 * ============================================================================
 * 
 * Multi-step registration form with validation, signature capture, and API submission.
 * 
 * STEPS:
 *   1. Email & Password
 *   2. Personal Information
 *   3. Address Information
 *   4. Emergency Contact
 *   5. Service Selection & Waiver Signature
 * 
 * DEPENDENCIES:
 *   - Bootstrap 5 (modals, form styling)
 *   - SweetAlert2 (error/success alerts)
 *   - AirDatepicker (date of birth picker)
 *   - QRCode.js (QR code generation)
 * 
 * @author DUO+ Development Team
 * @version 2.0.0
 */

'use strict';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

/**
 * Brand color used throughout the app
 * @constant {string}
 */
const BRAND_COLOR = '#174593';

/**
 * Service icons mapping for display in success modal
 * @constant {Object}
 */
const SERVICE_ICONS = {
    medical: { icon: '➕', label: 'Medical' },
    dental: { icon: '🦷', label: 'Dental' },
    optical: { icon: '👁️', label: 'Optical' },
    haircut: { icon: '✂️', label: 'Haircut' }
};

/**
 * Common passwords that are not allowed
 * @constant {string[]}
 */
const COMMON_PASSWORDS = [
    'password', 'password1', 'password123', '12345678', 'qwerty', 'abc123',
    'letmein', 'welcome', 'monkey', '1234567890', 'password1234'
];


// ============================================================================
// GLOBAL STATE
// ============================================================================

/** @type {Set<string>} Currently selected services */
let selectedServices = new Set();

/** @type {HTMLCanvasElement|null} Signature canvas element */
let signatureCanvas = null;

/** @type {CanvasRenderingContext2D|null} Signature canvas 2D context */
let signatureCtx = null;

/** @type {boolean} Is user currently drawing on signature pad */
let isDrawing = false;

/** @type {boolean} Has user drawn a signature */
let hasSignature = false;


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Display error message using SweetAlert2 or fallback to native alert
 * Also clears password field for security
 * 
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Clear password field on error for security
    const passwordInput = document.getElementById('txtRegClientPassword');
    if (passwordInput) {
        passwordInput.value = '';
        passwordInput.type = 'password';
    }

    // Reset password toggle
    const passwordToggle = document.getElementById('toggleClientPassword');
    if (passwordToggle) {
        passwordToggle.checked = false;
    }

    // Show error using SweetAlert2 if available
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Registration Failed',
            text: message,
            icon: 'error',
            confirmButtonText: 'Try Again',
            confirmButtonColor: BRAND_COLOR
        });
    } else {
        alert(message);
    }
}

/**
 * Hash password using SHA-256
 * 
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format phone number as (XXX) XXX-XXXX
 * 
 * @param {string} value - Raw phone input value
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(value) {
    const digits = value.replace(/\D/g, '').substring(0, 10);
    let formatted = '';

    if (digits.length > 0) {
        formatted = '(' + digits.substring(0, 3);
        if (digits.length >= 3) formatted += ') ' + digits.substring(3, 6);
        if (digits.length >= 6) formatted += '-' + digits.substring(6, 10);
    }

    return formatted;
}


// ============================================================================
// STEP NAVIGATION
// ============================================================================

/**
 * Show specific registration step and update progress indicator
 * 
 * @param {number} stepNumber - Step number to show (1-5)
 */
function showStep(stepNumber) {
    // Get step elements
    const steps = {
        1: document.getElementById('step1'),
        2: document.getElementById('step2'),
        3: document.getElementById('step3'),
        4: document.getElementById('step4'),
        5: document.getElementById('step5')
    };

    // Get progress indicator elements
    const circles = {
        1: document.getElementById('stepCircle1'),
        2: document.getElementById('stepCircle2'),
        3: document.getElementById('stepCircle3'),
        4: document.getElementById('stepCircle4'),
        5: document.getElementById('stepCircle5')
    };

    const lines = {
        1: document.getElementById('stepLine1'),
        2: document.getElementById('stepLine2'),
        3: document.getElementById('stepLine3'),
        4: document.getElementById('stepLine4')
    };

    // Get footer elements
    const footerSection = document.getElementById('footerSection');
    const lifeLogo = document.getElementById('lifeLogo');

    // Hide all steps
    Object.values(steps).forEach(step => {
        if (step) step.style.display = 'none';
    });

    // Reset all progress indicators
    Object.values(circles).forEach(circle => {
        if (circle) circle.classList.remove('active', 'completed');
    });
    Object.values(lines).forEach(line => {
        if (line) line.classList.remove('completed');
    });

    // Show current step
    if (steps[stepNumber]) {
        steps[stepNumber].style.display = 'block';
    }

    // Update progress indicators
    for (let i = 1; i <= 5; i++) {
        if (i < stepNumber) {
            // Previous steps are completed
            if (circles[i]) circles[i].classList.add('completed');
            if (lines[i]) lines[i].classList.add('completed');
        } else if (i === stepNumber) {
            // Current step is active
            if (circles[i]) circles[i].classList.add('active');
        }
    }

    // Show footer only on step 1
    const showFooter = stepNumber === 1;
    if (footerSection) footerSection.style.display = showFooter ? 'block' : 'none';
    if (lifeLogo) lifeLogo.style.display = showFooter ? 'block' : 'none';

    // Scroll to top of card
    const card = document.querySelector('.card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Navigate back to previous step
 */
function goBackToStep1() { showStep(1); }
function goBackToStep2() { showStep(2); }
function goBackToStep3() { showStep(3); }
function goBackToStep4() { showStep(4); }


// ============================================================================
// STEP 1: EMAIL & PASSWORD VALIDATION
// ============================================================================

/**
 * Validate email address
 * 
 * @param {string} email - Email address to validate
 * @returns {string|null} Error message or null if valid
 */
function validateEmail(email) {
    if (!email) return 'Email address is required.';
    if (email.length < 3) return 'Email address is too short.';
    if (email.length > 254) return 'Email address is too long (maximum 254 characters).';

    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]*[a-zA-Z0-9]@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) {
        // Provide specific error messages
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

    // Check local part length
    const localPart = email.split('@')[0];
    if (localPart.length > 64) return 'The part before @ is too long (maximum 64 characters).';

    return null;
}

/**
 * Validate password strength
 * 
 * @param {string} password - Password to validate
 * @returns {string|null} Error message or null if valid
 */
function validatePassword(password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (password.length > 128) return 'Password is too long (maximum 128 characters).';

    // Character requirements
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter (a-z).';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter (A-Z).';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number (0-9).';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return 'Password must include at least one special character (!@#$%^&*...).';
    }

    // Common password check
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
        return 'This password is too common. Please choose a more unique password.';
    }

    // Repeated characters check
    if (/([a-zA-Z0-9])\1{3,}/.test(password)) {
        return 'Password cannot contain more than 3 consecutive identical characters.';
    }

    // Sequential characters check
    const sequenceRegex = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/i;
    if (sequenceRegex.test(password)) {
        return 'Password cannot contain sequential characters (e.g., 1234, abcd).';
    }

    return null;
}

/**
 * Validate Step 1 form (email and password)
 * 
 * @param {HTMLInputElement} emailInput - Email input element
 * @param {HTMLInputElement} passwordInput - Password input element
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

/**
 * Save Step 1 data and proceed to Step 2
 * 
 * @param {string} email - User's email
 * @param {string} password - User's password (will be hashed)
 */
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


// ============================================================================
// STEP 2: PERSONAL INFORMATION VALIDATION
// ============================================================================

/**
 * Validate Step 2 form (personal information)
 * 
 * @returns {boolean} True if validation passes
 */
function validateStep2Form() {
    let isValid = true;

    const firstNameInput = document.getElementById('txtFirstName');
    const lastNameInput = document.getElementById('txtLastName');
    const middleInitialInput = document.getElementById('txtMiddleInitial');
    const dobInput = document.getElementById('txtDOB');
    const phoneInput = document.getElementById('txtPhoneNumber');

    // First Name (required)
    if (!firstNameInput.value.trim()) {
        firstNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        firstNameInput.classList.remove('is-invalid');
        firstNameInput.classList.add('is-valid');
    }

    // Last Name (required)
    if (!lastNameInput.value.trim()) {
        lastNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        lastNameInput.classList.remove('is-invalid');
        lastNameInput.classList.add('is-valid');
    }

    // Middle Initial (optional - always valid)
    middleInitialInput.classList.remove('is-invalid');
    middleInitialInput.classList.add('is-valid');

    // Sex (required - radio button group)
    const selectedSex = document.querySelector('input[name="selectSex"]:checked');
    const sexButtonGroup = document.querySelector('.btn-group');
    if (!selectedSex) {
        sexButtonGroup.classList.add('is-invalid');
        isValid = false;
    } else {
        sexButtonGroup.classList.remove('is-invalid');
    }

    // Date of Birth (required)
    if (!dobInput.value) {
        dobInput.classList.add('is-invalid');
        isValid = false;
    } else {
        dobInput.classList.remove('is-invalid');
        dobInput.classList.add('is-valid');
    }

    // Phone Number (optional - validate format if provided)
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
 * Validate Step 3 form (address information)
 * 
 * @returns {boolean} True if validation passes
 */
function validateStep3Form() {
    // Skip validation if user checked "I don't have a permanent address"
    const chkNoAddress = document.getElementById('chkNoAddress');
    if (chkNoAddress && chkNoAddress.checked) {
        return true;
    }

    let isValid = true;

    const streetAddressInput = document.getElementById('txtStreetAddress');
    const streetAddress2Input = document.getElementById('txtStreetAddress2');
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

    // Street Address 2 (optional - always valid)
    streetAddress2Input.classList.remove('is-invalid');
    streetAddress2Input.classList.add('is-valid');

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
// STEP 4: EMERGENCY CONTACT VALIDATION
// ============================================================================

/**
 * Validate Step 4 form (emergency contact)
 * 
 * @returns {boolean} True if validation passes
 */
function validateStep4Form() {
    // Skip validation if user checked "I don't have an emergency contact"
    const chkNoEmergencyContact = document.getElementById('chkNoEmergencyContact');
    if (chkNoEmergencyContact && chkNoEmergencyContact.checked) {
        return true;
    }

    let isValid = true;

    const firstNameInput = document.getElementById('txtEmergencyFirstName');
    const lastNameInput = document.getElementById('txtEmergencyLastName');
    const phoneInput = document.getElementById('txtEmergencyPhone');

    // First Name (required)
    if (!firstNameInput.value.trim()) {
        firstNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        firstNameInput.classList.remove('is-invalid');
        firstNameInput.classList.add('is-valid');
    }

    // Last Name (required)
    if (!lastNameInput.value.trim()) {
        lastNameInput.classList.add('is-invalid');
        isValid = false;
    } else {
        lastNameInput.classList.remove('is-invalid');
        lastNameInput.classList.add('is-valid');
    }

    // Phone Number (required, 10 digits)
    const phoneValue = phoneInput.value.trim();
    const digitsOnly = phoneValue.replace(/\D/g, '');
    if (!phoneValue || digitsOnly.length !== 10) {
        phoneInput.classList.add('is-invalid');
        isValid = false;
    } else {
        phoneInput.classList.remove('is-invalid');
        phoneInput.classList.add('is-valid');
    }

    return isValid;
}


// ============================================================================
// STEP 5: SERVICE SELECTION VALIDATION
// ============================================================================

/**
 * Validate Step 5 form (service selection)
 * 
 * @returns {boolean} True if validation passes
 */
function validateStep5Form() {
    let isValid = true;

    // At least one service must be selected
    if (selectedServices.size === 0) {
        document.getElementById('serviceError').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('serviceError').style.display = 'none';
    }

    // If dental is selected, dental type must be chosen
    if (selectedServices.has('dental')) {
        const dentalType = document.querySelector('input[name="dentalType"]:checked');
        if (!dentalType) {
            document.getElementById('dentalOptions').style.border = '2px solid #dc3545';
            isValid = false;
        } else {
            document.getElementById('dentalOptions').style.border = '1px solid #dee2e6';
        }
    }

    return isValid;
}


// ============================================================================
// SIGNATURE PAD
// ============================================================================

/**
 * Initialize signature canvas with mouse and touch support
 */
function initSignatureCanvas() {
    signatureCanvas = document.getElementById('signatureCanvas');
    if (!signatureCanvas) return;

    signatureCtx = signatureCanvas.getContext('2d');

    // Set canvas size to match display size
    const wrapper = signatureCanvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    signatureCanvas.width = rect.width - 4; // Account for border
    signatureCanvas.height = 120;

    // Set drawing style
    signatureCtx.strokeStyle = '#000';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    // Mouse events
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    signatureCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    signatureCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    signatureCanvas.addEventListener('touchend', stopDrawing);
}

/**
 * Get mouse position relative to canvas
 * 
 * @param {MouseEvent} e - Mouse event
 * @returns {{x: number, y: number}} Position coordinates
 */
function getMousePos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

/**
 * Start drawing on signature pad
 * 
 * @param {MouseEvent} e - Mouse event
 */
function startDrawing(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(pos.x, pos.y);
}

/**
 * Draw on signature pad
 * 
 * @param {MouseEvent} e - Mouse event
 */
function draw(e) {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    signatureCtx.lineTo(pos.x, pos.y);
    signatureCtx.stroke();

    hasSignature = true;
    document.querySelector('.signature-pad-wrapper').classList.add('has-signature');
    document.querySelector('.signature-pad-wrapper').classList.remove('invalid');
    document.getElementById('signatureError').style.display = 'none';
}

/**
 * Stop drawing on signature pad
 */
function stopDrawing() {
    isDrawing = false;
}

/**
 * Handle touch start event for mobile signature
 * 
 * @param {TouchEvent} e - Touch event
 */
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    startDrawing(mouseEvent);
}

/**
 * Handle touch move event for mobile signature
 * 
 * @param {TouchEvent} e - Touch event
 */
function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    draw(mouseEvent);
}

/**
 * Clear signature from canvas
 */
function clearSignature() {
    if (signatureCtx && signatureCanvas) {
        signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        hasSignature = false;
        document.querySelector('.signature-pad-wrapper').classList.remove('has-signature');
    }
}


// ============================================================================
// SUCCESS MODAL & QR CODE
// ============================================================================

/**
 * Show success modal with QR code after registration
 * 
 * @param {string} clientId - The client's unique ID from the database
 * @param {Object} registrationData - The registration data containing services and name
 */
function showSuccessModal(clientId, registrationData) {
    const qrContainer = document.getElementById('qrCodeDisplay');
    qrContainer.innerHTML = '';

    // Generate QR code with client ID
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
            text: clientId,
            width: 180,
            height: 180,
            colorDark: BRAND_COLOR,
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        console.error('QRCode library not loaded');
        qrContainer.innerHTML = '<p class="text-muted">QR Code: ' + clientId + '</p>';
    }

    // Display client name
    const clientName = `${registrationData.first_name} ${registrationData.last_name}`;
    document.getElementById('clientNameDisplay').textContent = clientName;

    // Display selected services with icons
    const serviceIconsContainer = document.getElementById('serviceIconsDisplay');
    serviceIconsContainer.innerHTML = '';

    registrationData.services.forEach(service => {
        if (SERVICE_ICONS[service]) {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'service-icon-item text-center';
            iconDiv.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 4px;">${SERVICE_ICONS[service].icon}</div>
                <small class="text-muted" style="font-size: 0.75rem;">${SERVICE_ICONS[service].label}</small>
            `;
            serviceIconsContainer.appendChild(iconDiv);
        }
    });

    // Show the modal
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    successModal.show();

    // Setup Save QR button
    document.getElementById('btnSaveQR').onclick = () => {
        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `DUO-QRCode-${registrationData.first_name}-${registrationData.last_name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    };

    // Setup Done button
    document.getElementById('btnDone').onclick = () => {
        successModal.hide();
        window.location.href = '../index.html';
    };
}


// ============================================================================
// FORM SUBMISSION
// ============================================================================

/**
 * Collect all registration data from form fields
 * 
 * @returns {Object} Complete registration data object
 */
function collectRegistrationData() {
    // Get stored data from Step 1
    const storedData = JSON.parse(sessionStorage.getItem('registrationData') || '{}');

    // Get dental type if dental service is selected
    let dentalType = null;
    if (selectedServices.has('dental')) {
        const dentalRadio = document.querySelector('input[name="dentalType"]:checked');
        dentalType = dentalRadio ? dentalRadio.value : null;
    }

    // Get signature as base64 image
    const signatureData = signatureCanvas ? signatureCanvas.toDataURL('image/png') : null;

    return {
        // Step 1: Login Info
        email: storedData.email || '',
        password_hash: storedData.password_hash || '',

        // Step 2: Personal Info
        first_name: document.getElementById('txtFirstName')?.value.trim() || '',
        middle_initial: document.getElementById('txtMiddleInitial')?.value.trim() || '',
        last_name: document.getElementById('txtLastName')?.value.trim() || '',
        sex: document.querySelector('input[name="selectSex"]:checked')?.value || '',
        dob: document.getElementById('txtDOB')?.value.trim() || '',
        phone: document.getElementById('txtPhoneNumber')?.value.trim() || '',

        // Step 3: Address Info
        no_address: document.getElementById('chkNoAddress')?.checked || false,
        street_address: document.getElementById('txtStreetAddress')?.value.trim() || '',
        street_address2: document.getElementById('txtStreetAddress2')?.value.trim() || '',
        city: document.getElementById('txtCity')?.value.trim() || '',
        state: document.getElementById('txtState')?.dataset.value || '',
        zip: document.getElementById('txtZip')?.value.trim() || '',

        // Step 4: Emergency Contact
        no_emergency_contact: document.getElementById('chkNoEmergencyContact')?.checked || false,
        emergency_first_name: document.getElementById('txtEmergencyFirstName')?.value.trim() || '',
        emergency_last_name: document.getElementById('txtEmergencyLastName')?.value.trim() || '',
        emergency_phone: document.getElementById('txtEmergencyPhone')?.value.trim() || '',

        // Step 5: Services
        services: Array.from(selectedServices),
        dental_type: dentalType,

        // Waiver Signature
        signature: signatureData
    };
}

/**
 * Submit registration to API
 * 
 * @param {HTMLButtonElement} submitButton - The submit button element
 */
async function submitRegistration(submitButton) {
    const originalContent = submitButton.innerHTML;

    // Show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Processing...
    `;

    try {
        const registrationData = collectRegistrationData();

        // Send to API
        const response = await fetch('../api/register.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Registration failed');
        }

        // Close waiver modal
        const waiverModal = bootstrap.Modal.getInstance(document.getElementById('waiverModal'));
        if (waiverModal) waiverModal.hide();

        // Reset button
        submitButton.disabled = false;
        submitButton.innerHTML = originalContent;

        // Clear session data
        sessionStorage.removeItem('registrationData');

        // Show success modal with QR code
        showSuccessModal(result.client_id, registrationData);

    } catch (error) {
        console.error('Registration error:', error);

        // Reset button
        submitButton.disabled = false;
        submitButton.innerHTML = originalContent;

        // Show error
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Registration Failed',
                text: error.message || 'An error occurred during registration. Please try again.',
                icon: 'error',
                confirmButtonText: 'Try Again',
                confirmButtonColor: BRAND_COLOR
            });
        } else {
            alert('Registration failed: ' + (error.message || 'Please try again.'));
        }
    }
}


// ============================================================================
// DOM INITIALIZATION & EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {

    // -------------------------------------------------------------------------
    // Get Button Elements
    // -------------------------------------------------------------------------

    const step1NextBtn = document.getElementById('btnStep1Next');
    const step2BackBtn = document.getElementById('btnStep2Back');
    const step2NextBtn = document.getElementById('btnStep2Next');
    const step3BackBtn = document.getElementById('btnStep3Back');
    const step3SubmitBtn = document.getElementById('btnStep3Submit');
    const step4BackBtn = document.getElementById('btnStep4Back');
    const step4NextBtn = document.getElementById('btnStep4Next');
    const step5BackBtn = document.getElementById('btnStep5Back');
    const step5SubmitBtn = document.getElementById('btnStep5Submit');

    const emailInput = document.getElementById('txtRegClientEmail');
    const passwordInput = document.getElementById('txtRegClientPassword');
    const passwordToggle = document.getElementById('toggleClientPassword');

    // -------------------------------------------------------------------------
    // State Selection Modal
    // -------------------------------------------------------------------------

    const stateInput = document.getElementById('txtState');
    const btnChooseState = document.getElementById('btnChooseState');
    const stateModal = new bootstrap.Modal(document.getElementById('stateModal'), {});
    const stateButtons = document.querySelectorAll('.state-btn');

    if (btnChooseState) {
        btnChooseState.addEventListener('click', () => stateModal.show());
    }

    stateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const stateCode = btn.getAttribute('data-state');
            const stateName = btn.textContent;

            if (stateInput) {
                stateInput.value = stateName;
                stateInput.dataset.value = stateCode;
                stateInput.classList.remove('is-invalid');
                stateInput.classList.add('is-valid');
            }

            stateButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            stateModal.hide();
        });
    });

    // Highlight current selection when modal opens
    const stateModalEl = document.getElementById('stateModal');
    stateModalEl?.addEventListener('show.bs.modal', () => {
        stateButtons.forEach(btn => {
            if (stateInput.dataset.value === btn.getAttribute('data-state')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    });

    // -------------------------------------------------------------------------
    // Step 1: Email & Password
    // -------------------------------------------------------------------------

    if (step1NextBtn && emailInput && passwordInput) {
        step1NextBtn.addEventListener('click', () => {
            if (!validateRegisterForm(emailInput, passwordInput)) return;
            proceedToNextStep(emailInput.value.trim(), passwordInput.value.trim());
        });

        // Enter key support
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

    // -------------------------------------------------------------------------
    // Date Picker (Air Datepicker)
    // -------------------------------------------------------------------------

    const dobInput = document.getElementById('txtDOB');
    if (dobInput && typeof AirDatepicker !== 'undefined') {
        const mobileMediaQuery = window.matchMedia('(max-width: 767px)');

        const englishLocale = {
            days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            daysMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
            months: ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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

        opts.locale = AirDatepicker.locales?.en || englishLocale;

        const dobPicker = new AirDatepicker(dobInput, opts);
        window.dobPicker = dobPicker;

        // Update mobile mode on resize
        mobileMediaQuery.addEventListener('change', (e) => {
            if (dobPicker) dobPicker.update({ isMobile: e.matches });
        });
    }

    // -------------------------------------------------------------------------
    // Input Field Formatting & Validation
    // -------------------------------------------------------------------------

    // Phone number formatting
    const phoneInput = document.getElementById('txtPhoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = formatPhoneNumber(e.target.value);
        });
    }

    // Name fields (letters, spaces, hyphens, apostrophes only)
    const firstNameInput = document.getElementById('txtFirstName');
    const middleInitialInput = document.getElementById('txtMiddleInitial');
    const lastNameInput = document.getElementById('txtLastName');

    if (firstNameInput) {
        firstNameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z\s'-]/g, '');
        });
    }

    if (middleInitialInput) {
        middleInitialInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
        });
    }

    if (lastNameInput) {
        lastNameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z\s'-]/g, '');
        });
    }

    // City field (letters and spaces only)
    const cityInput = document.getElementById('txtCity');
    if (cityInput) {
        cityInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
        });
    }

    // ZIP code field (numbers only, max 5 digits)
    const zipInput = document.getElementById('txtZip');
    if (zipInput) {
        zipInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 5);
        });
    }

    // -------------------------------------------------------------------------
    // Step 2: Personal Information
    // -------------------------------------------------------------------------

    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', goBackToStep1);
    }

    if (step2NextBtn) {
        step2NextBtn.addEventListener('click', () => {
            if (!validateStep2Form()) return;
            showStep(3);
        });

        // Enter key support
        ['txtFirstName', 'txtMiddleInitial', 'txtLastName', 'txtPhoneNumber'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') step2NextBtn.click();
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Step 3: Address Information
    // -------------------------------------------------------------------------

    if (step3BackBtn) {
        step3BackBtn.addEventListener('click', goBackToStep2);
    }

    // Toggle address fields visibility
    const chkNoAddress = document.getElementById('chkNoAddress');
    const addressFields = document.getElementById('addressFields');
    if (chkNoAddress && addressFields) {
        chkNoAddress.addEventListener('change', () => {
            addressFields.style.display = chkNoAddress.checked ? 'none' : 'block';

            // Toggle required attribute on address inputs
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

        // Enter key support
        ['txtStreetAddress', 'txtStreetAddress2', 'txtCity', 'txtState', 'txtZip'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') step3SubmitBtn.click();
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Step 4: Emergency Contact
    // -------------------------------------------------------------------------

    if (step4BackBtn) {
        step4BackBtn.addEventListener('click', goBackToStep3);
    }

    // Toggle emergency contact fields visibility
    const chkNoEmergencyContact = document.getElementById('chkNoEmergencyContact');
    const emergencyContactFields = document.getElementById('emergencyContactFields');
    if (chkNoEmergencyContact && emergencyContactFields) {
        chkNoEmergencyContact.addEventListener('change', () => {
            emergencyContactFields.style.display = chkNoEmergencyContact.checked ? 'none' : 'block';

            // Toggle required attribute
            const emergencyInputs = emergencyContactFields.querySelectorAll('input[required]');
            emergencyInputs.forEach(input => {
                if (chkNoEmergencyContact.checked) {
                    input.removeAttribute('required');
                } else {
                    input.setAttribute('required', '');
                }
            });
        });
    }

    // Emergency contact phone formatting
    const emergencyPhoneInput = document.getElementById('txtEmergencyPhone');
    if (emergencyPhoneInput) {
        emergencyPhoneInput.addEventListener('input', (e) => {
            e.target.value = formatPhoneNumber(e.target.value);
        });
    }

    // Emergency contact name fields
    const emergencyFirstName = document.getElementById('txtEmergencyFirstName');
    const emergencyLastName = document.getElementById('txtEmergencyLastName');

    if (emergencyFirstName) {
        emergencyFirstName.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z\s'-]/g, '');
        });
    }

    if (emergencyLastName) {
        emergencyLastName.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^A-Za-z\s'-]/g, '');
        });
    }

    if (step4NextBtn) {
        step4NextBtn.addEventListener('click', () => {
            if (!validateStep4Form()) return;
            showStep(5);
        });

        // Enter key support
        ['txtEmergencyFirstName', 'txtEmergencyLastName', 'txtEmergencyPhone'].forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') step4NextBtn.click();
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Step 5: Service Selection & Signature
    // -------------------------------------------------------------------------

    if (step5BackBtn) {
        step5BackBtn.addEventListener('click', goBackToStep4);
    }

    // Service button toggle
    const serviceButtons = document.querySelectorAll('.service-btn');
    serviceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const service = btn.dataset.service;

            if (btn.classList.contains('selected')) {
                // Deselect service
                btn.classList.remove('selected');
                selectedServices.delete(service);

                // Hide dental options if dental is deselected
                if (service === 'dental') {
                    document.getElementById('dentalOptions').style.display = 'none';
                    document.querySelectorAll('input[name="dentalType"]').forEach(r => r.checked = false);
                }
            } else {
                // Select service
                btn.classList.add('selected');
                selectedServices.add(service);

                // Show dental options if dental is selected
                if (service === 'dental') {
                    document.getElementById('dentalOptions').style.display = 'flex';
                }
            }

            // Hide error if at least one service selected
            if (selectedServices.size > 0) {
                document.getElementById('serviceError').style.display = 'none';
            }
        });
    });

    // Dental type selection
    const dentalRadios = document.querySelectorAll('input[name="dentalType"]');
    dentalRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            setTimeout(() => {
                document.getElementById('dentalOptions').style.display = 'none';

                // Update dental button label
                const dentalBtn = document.querySelector('.service-btn[data-service="dental"] .service-name');
                if (dentalBtn && radio.checked) {
                    dentalBtn.textContent = `Dental (${radio.value === 'hygiene' ? 'Hygiene' : 'Extraction'})`;
                }
            }, 200);
        });
    });

    // Clear signature button
    const btnClearSignature = document.getElementById('btnClearSignature');
    if (btnClearSignature) {
        btnClearSignature.addEventListener('click', clearSignature);
    }

    // Initialize signature canvas when waiver modal is shown
    const waiverModalEl = document.getElementById('waiverModal');
    if (waiverModalEl) {
        waiverModalEl.addEventListener('shown.bs.modal', initSignatureCanvas);
    }

    // Finish button - opens waiver modal
    if (step5SubmitBtn) {
        step5SubmitBtn.addEventListener('click', () => {
            if (!validateStep5Form()) return;
            const waiverModal = new bootstrap.Modal(document.getElementById('waiverModal'));
            waiverModal.show();
        });
    }

    // Complete Registration button (in waiver modal)
    const btnCompleteRegistration = document.getElementById('btnCompleteRegistration');
    if (btnCompleteRegistration) {
        btnCompleteRegistration.addEventListener('click', async () => {
            // Validate signature
            if (!hasSignature) {
                const wrapper = document.querySelector('.signature-pad-wrapper');
                if (wrapper) wrapper.classList.add('invalid');
                document.getElementById('signatureError').style.display = 'block';
                return;
            }

            await submitRegistration(btnCompleteRegistration);
        });
    }

    // -------------------------------------------------------------------------
    // Sex Selection Change Listener
    // -------------------------------------------------------------------------

    const sexSelectEl = document.getElementById('selectSex');
    sexSelectEl?.addEventListener('change', () => {
        sexSelectEl.classList.remove('is-invalid');
        sexSelectEl.classList.add('is-valid');
    });
});
