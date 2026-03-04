/**
 * ============================================================
 *  File:        lang.js
 *  Purpose:     Language translation system. Stores English
 *               and Spanish translations and applies them
 *               based on the user's language selection.
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 6:44 PM
 *  Changes Made:      Code cleanup
 * ============================================================
*/

var translations = {
  en: {
    // Login
    subtitle: "Connecting patients with free<br>care through DUO",
    lblClientEmail: "Email",
    lblClientPassword: "Password",
    lblShowPassword: "Show password",
    btnClientLogin: "Login",
    orText: "Or",
    btn2Register: "Register",

    // Registration
    progressTitle: "Progress through registration",

    // Step 1 - Login Info
    titleStepOne: 'Login Information',
    clientRegisterEmailLabel: 'Email <span class="text-danger" aria-hidden="true">*</span>',
    emailError: 'Please enter a valid email address.',
    clientRegisterPassLabel: 'Password <span class="text-danger" aria-hidden="true">*</span>',
    passwordError: 'Password must include at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.',
    toggleClientRegisterPassLabel: 'Show password',
    btnRegisterNext1: 'Next',
    btnRegisterBack1: 'Back to Login',

    // Step 2 - Personal Info
    titleStepTwo: 'Personal Information',
    clientFirstNameLabel: 'First Name <span class="text-danger" aria-hidden="true">*</span>',
    firstNameError: 'Please enter your first name.',
    clientMiddleInitialLabel: 'Middle Initial <span class="text-muted fw-normal small">(optional)</span>',
    clientLastNameLabel: 'Last Name <span class="text-danger" aria-hidden="true">*</span>',
    lastNameError: 'Please enter your last name.',
    sexLabel: 'Sex <span class="text-danger" aria-hidden="true">*</span>',
    btnSexMaleLabel: 'Male',
    btnSexFemaleLabel: 'Female',
    btnSexIntersexLabel: 'Intersex',
    sexError: 'Please select your sex.',
    clientDOBLabel: 'Date of Birth <span class="text-danger" aria-hidden="true">*</span>',
    dobError: 'Please enter your date of birth.',
    clientPhoneLabel: 'Phone <span class="text-muted fw-normal small">(optional)</span>',
    phoneError: 'Phone number format is invalid.',
    btnRegisterNext2: 'Next',
    btnRegisterBack2: 'Go back',

    // Step 3 - Address Info
    titleStepThree: 'Address Information',
    noAddressLabel: 'No current address',
    clientAddress1Label: 'Street Address 1 <span class="text-danger" aria-hidden="true">*</span>',
    clientAddress2Label: 'Street Address 2 <span class="text-muted fw-normal small">(optional)</span>',
    address1Error: 'Please enter an address.',
    clientCityLabel: 'City <span class="text-danger" aria-hidden="true">*</span>',
    cityError: 'Please enter a city.',
    selectStateLabel: 'State <span class="text-danger" aria-hidden="true">*</span>',
    stateError: 'Please select a state.',
    clientZipCodeLabel: 'Zip Code <span class="text-danger" aria-hidden="true">*</span>',
    zipCode: 'Please enter a 5-digit zip code.',
    btnRegisterNext3: 'Next',
    btnRegisterBack3: 'Go back',

    // Step 4 - Emergency Contact
    titleStepFour: 'Emergency Contact',
    noEmergencyContactLabel: 'No Emergency Contact',
    emergencyContactFirstNameLabel: 'Contact First Name <span class="text-danger" aria-hidden="true">*</span>',
    contactFirstName: 'Please enter a first name for your contact.',
    emergencyContactLastNameLabel: 'Contact Last Name <span class="text-danger" aria-hidden="true">*</span>',
    contactLastName: 'Please enter a last name for your contact.',
    emergencyContactPhoneLabel: 'Contact Phone <span class="text-danger" aria-hidden="true">*</span>',
    contactPhone: 'Please enter a phone number for your contact.',
    btnRegisterNext4: 'Next',
    btnRegisterBack4: 'Go back',

    // Step 5 - Service Select
    titleStepFive: 'Service Selection',
    btnServiceMedicalLabel: '🏥 Medical',
    btnServiceDentalLabel: '🦷 Dental',
    btnServiceOpticalLabel: '👁️ Optical',
    btnServiceHaircutLabel: '✂️ Haircut',
    serviceError: 'Please select at least one service.',
    btnRegisterNext5: 'Next',
    btnRegisterBack5: 'Go back',

    // Waiver
    waiverLabel: 'Waiver Agreement Required',
    collapseExample: 'DUO is not entitled to anything that happens to you. You accept full responsibility at this event.',
    waiverAgreeLabel: 'I have read and agree.',
    waiverError: 'You must agree to the waiver to continue.',
    btnWaiverSubmit: 'Submit',

    // Notifications
    registrationSuccessTitle: "Registration Complete!",
    registrationSuccessText: "You have been officially registered.",
    registrationFailedTitle: "Registration Failed",
    registrationFailedText: "An error occurred. Please try again.",
    registrationConnectionErrorTitle: "Connection Error",
    registrationConnectionErrorText: "Unable to connect to the server. Please try again later."
  },
  es: {
    // Login
    subtitle: "Conectando pacientes con atención<br>gratuita a través de DUO",
    lblClientEmail: "Correo electrónico",
    lblClientPassword: "Contraseña",
    lblShowPassword: "Mostrar contraseña",
    btnClientLogin: "Iniciar sesión",
    orText: "O",
    btn2Register: "Registrarse",

    // Registration
    progressTitle: "Progreso a través del registro",

    // Step 1 - Login Info
    titleStepOne: 'Información de Acceso',
    clientRegisterEmailLabel: 'Correo electrónico <span class="text-danger" aria-hidden="true">*</span>',
    emailError: 'Por favor, ingrese una dirección de correo electrónico válida.',
    clientRegisterPassLabel: 'Contraseña <span class="text-danger" aria-hidden="true">*</span>',
    passwordError: 'La contraseña debe incluir mínimo 8 caracteres, 1 letra mayúscula, 1 letra minúscula y 1 número.',
    toggleClientRegisterPassLabel: 'Ver contraseña',
    btnRegisterNext1: 'Siguiente',
    btnRegisterBack1: 'Volver al inicio de sesión',

    // Step 2 - Personal Info
    titleStepTwo: 'Información personal',
    clientFirstNameLabel: 'Primer nombre <span class="text-danger" aria-hidden="true">*</span>',
    firstNameError: 'Por favor, ingrese su primer nombre.',
    clientMiddleInitialLabel: 'Inicial del segundo nombre <span class="text-muted fw-normal small">(opcional)</span>',
    clientLastNameLabel: 'Apellido <span class="text-danger" aria-hidden="true">*</span>',
    lastNameError: 'Por favor, ingrese su apellido.',
    sexLabel: 'Sexo <span class="text-danger" aria-hidden="true">*</span>',
    btnSexMaleLabel: 'Masculino',
    btnSexFemaleLabel: 'Femenino',
    btnSexIntersexLabel: 'Intersexual',
    sexError: 'Por favor, seleccione su sexo.',
    clientDOBLabel: 'Fecha de nacimiento <span class="text-danger" aria-hidden="true">*</span>',
    dobError: 'Por favor, ingrese su fecha de nacimiento.',
    clientPhoneLabel: 'Teléfono <span class="text-muted fw-normal small">(opcional)</span>',
    phoneError: 'El formato del teléfono no es válido.',
    btnRegisterNext2: 'Siguiente',
    btnRegisterBack2: 'Regresar',

    // Step 3 - Address Info
    titleStepThree: 'Información de residencia',
    noAddressLabel: 'Sin dirección actual',
    clientAddress1Label: 'Dirección de residencia 1 <span class="text-danger" aria-hidden="true">*</span>',
    clientAddress2Label: 'Dirección de residencia 2 <span class="text-muted fw-normal small">(opcional)</span>',
    address1Error: 'Por favor, ingrese una dirección.',
    clientCityLabel: 'Ciudad <span class="text-danger" aria-hidden="true">*</span>',
    cityError: 'Por favor, ingrese una ciudad.',
    selectStateLabel: 'Estado <span class="text-danger" aria-hidden="true">*</span>',
    stateError: 'Por favor, seleccione un estado.',
    clientZipCodeLabel: 'Código postal <span class="text-danger" aria-hidden="true">*</span>',
    zipCode: 'Por favor, ingrese un código postal de 5 dígitos.',
    btnRegisterNext3: 'Siguiente',
    btnRegisterBack3: 'Regresar',

    // Step 4 - Emergency Contact
    titleStepFour: 'Contacto de emergencia',
    noEmergencyContactLabel: 'Sin contacto de emergencia',
    emergencyContactFirstNameLabel: 'Primer nombre del contacto de emergencia <span class="text-danger" aria-hidden="true">*</span>',
    contactFirstName: 'Por favor, ingrese el primer nombre de su contacto.',
    emergencyContactLastNameLabel: 'Apellido del contacto de emergencia <span class="text-danger" aria-hidden="true">*</span>',
    contactLastName: 'Por favor, ingrese el apellido de su contacto.',
    emergencyContactPhoneLabel: 'Teléfono del contacto de emergencia <span class="text-danger" aria-hidden="true">*</span>',
    contactPhone: 'Por favor, ingrese el teléfono de su contacto.',
    btnRegisterNext4: 'Siguiente',
    btnRegisterBack4: 'Regresar',

    // Step 5 - Service Select
    titleStepFive: 'Selección de servicio',
    btnServiceMedicalLabel: '🏥 Médico',
    btnServiceDentalLabel: '🦷 Dental',
    btnServiceOpticalLabel: '👁️ Óptico',
    btnServiceHaircutLabel: '✂️ Corte de pelo',
    serviceError: 'Por favor, seleccione por lo menos un servicio.',
    btnRegisterNext5: 'Siguiente',
    btnRegisterBack5: 'Regresar',

    // Waiver
    waiverLabel: 'Acuerdo de renuncia de responsabilidad requerido',
    collapseExample: 'DUO no es acreedor a nada que le suceda a usted. Usted acepta completa responsabilidad en este evento.',
    waiverAgreeLabel: 'He leído y estoy de acuerdo.',
    waiverError: 'Usted debe estar de acuerdo con el acuerdo de renuncia de responsabilidad para continuar.',
    btnWaiverSubmit: 'Enviar',

    // Notifications
    registrationSuccessTitle: "¡Registro completo!",
    registrationSuccessText: "Su cuenta ha sido creada exitosamente.",
    registrationFailedTitle: "Registro fallido",
    registrationFailedText: "Se ha producido un error. Inténtelo de nuevo.",
    registrationConnectionErrorTitle: "Error de conexión",
    registrationConnectionErrorText: "No se puede conectar al servidor. Inténtelo más tarde."
  }
};

var select = document.getElementById("selLanguageSwitch");

// Restore saved language on page load
var savedLang = sessionStorage.getItem("lang");
if (savedLang) {
  select.value = savedLang;
  var strings = translations[savedLang];
  for (var key in strings) {
    var el = document.getElementById(key);
    if (el) {
      el.innerHTML = strings[key];
    }
  }
}

// Apply language on change
select.addEventListener("change", function () {
  var lang = this.value;
  sessionStorage.setItem("lang", lang);
  var strings = translations[lang];

  for (var key in strings) {
    var el = document.getElementById(key);
    if (el) {
      el.innerHTML = strings[key];
    }
  }
});