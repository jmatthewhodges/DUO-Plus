// Takes you to the register page with pre filled data
const btnClientLoginEl = document.getElementById('btnClientLogin');
if (btnClientLoginEl) {
    btnClientLoginEl.addEventListener('click', function (e) {
        e.preventDefault(); // Stop form submission
        const popup = document.getElementById('prefillPopup');
        const modal = new bootstrap.Modal(popup);
        modal.show();
    });
} else {
    console.debug('Prefill: btnClientLogin not found on this page');
} 

// apply prefill data from fetched JSON
function applyPrefillData(data) {
    console.debug('applyPrefillData called');
    if (data) {
        window.Email = data.Email || '';
        // window.Password = data.Password || ''; // Commented out for security - users should enter password fresh
        window.FirstName = data.FirstName || '';
        window.MiddleName = data.MiddleName || '';
        window.LastName = data.LastName || '';
        window.Sex = data.Sex || '';
        window.DOB = data.DOB || '';
        window.Phone = data.Phone || '';
        window.Street1 = data.Street1 || '';
        window.Street2 = data.Street2 || '';
        window.City = data.City || '';
        window.Country = data.Country || '';
        window.State = data.State || '';
        window.ZIP = data.ZIP || '';
        window.emergencyContactFirstName = data.emergencyContactFirstName || '';
        window.emergencyContactLastName = data.emergencyContactLastName || '';
        window.emergencyContactPhone = data.emergencyContactPhone || '';
        // selects checkboxes for missing data on address and emergency contact sections
        window.noAddress = data.noAddress || false;
        window.noEmergencyContact = data.noEmergencyContact || false;
    }

    // error handling 
    const setIf = (id, value) => {
        const el = document.getElementById(id);
        if (!el) {
            console.debug('Prefill: element not found', id);
            return;
        }

        // Record previous value for debugging
        const prev = ('value' in el) ? el.value : el.innerHTML;
        const isPasswordField = id === 'clientRegisterPass';
        const logValue = isPasswordField ? (value ? '***masked***' : '') : value;
        const logPrev = isPasswordField ? (prev ? '***masked***' : '') : prev;
        if ('value' in el) {
            el.value = value;
            console.debug('Prefill set', id, '->', logValue, 'prev:', logPrev);
        } else {
            el.innerHTML = value;
            console.debug('Prefill set (innerHTML)', id, '->', logValue, 'prev:', logPrev);
        }
    };

    // Page 1 
    setIf('clientRegisterEmail', window.Email || '');
    // setIf('clientRegisterPass', window.Password || ''); // Commented out for security

    // Page 2
    setIf('clientFirstName', window.FirstName || '');
    setIf('clientMiddleInitial', window.MiddleName || '');
    setIf('clientLastName', window.LastName || '');
    setIf('clientDOB', window.DOB || '');
    setIf('clientPhone', window.Phone || '');

    // Address Page
    // If noAddress is true, we check the box or prefill them if data is available
    if (window.noAddress) {
        const noAddressCheckbox = document.getElementById('noAddress');
        if (noAddressCheckbox) {
            noAddressCheckbox.checked = true;
            console.debug('Prefill: auto-checked noAddress checkbox');
            // Disable address fields
            const addressFields = ['clientAddress1', 'clientAddress2', 'clientCity', 'clientZipCode', 'selectState'];
            addressFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.disabled = true;
                    console.debug('Prefill: disabled field', id);
                }
            });
        }
    // If we have address data, prefill it; if noAddress is true, we skip this to avoid conflicts and rely on the checkbox state instead
    } else {
        setIf('clientAddress1', window.Street1 || '');
        setIf('clientAddress2', window.Street2 || '');
        setIf('clientCity', window.City || '');
        setIf('clientZipCode', window.ZIP || '');
        if (window.State) {
            const sel = document.getElementById('selectState');
            if (sel) {
                const prev = sel.value;
                sel.value = window.State;
                console.debug('Prefill set selectState ->', window.State, 'prev:', prev);
            } else {
                console.debug('Prefill: selectState element missing');
            }
        }
    }

    // Sex radios
    if (window.Sex) {
        const map = { 'male': 'btnSexMale', 'female': 'btnSexFemale', 'intersex': 'btnSexIntersex' };
        const id = map[(window.Sex || '').toLowerCase()];
        if (id) {
            const r = document.getElementById(id);
            if (r) {
                r.checked = true;
                console.debug('Prefill set sex radio ->', id);
            } else {
                console.debug('Prefill: sex radio element not found', id);
            }
        } else {
            console.debug('Prefill: unknown Sex value', window.Sex);
        }
    }

    // Emergency Contact
    if (window.noEmergencyContact) {
        const noEmergencyCheckbox = document.getElementById('noEmergencyContact');
        if (noEmergencyCheckbox) {
            noEmergencyCheckbox.checked = true;
            console.debug('Prefill: auto-checked noEmergencyContact checkbox');
            // Disable emergency contact fields
            const emergencyFields = ['emergencyContactFirstName', 'emergencyContactLastName', 'emergencyContactPhone'];
            emergencyFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.disabled = true;
                    console.debug('Prefill: disabled field', id);
                }
            });
        }
    } else {
        setIf('emergencyContactFirstName', window.emergencyContactFirstName || '');
        setIf('emergencyContactLastName', window.emergencyContactLastName || '');
        setIf('emergencyContactPhone', window.emergencyContactPhone || '');
    }

    // Summarize what got applied in console (password excluded for security)
    console.debug('Prefill final values', {
        Email: window.Email,
        FirstName: window.FirstName,
        MiddleName: window.MiddleName,
        LastName: window.LastName,
        Sex: window.Sex,
        DOB: window.DOB,
        Phone: window.Phone,
        Street1: window.Street1,
        Street2: window.Street2,
        City: window.City,
        State: window.State,
        ZIP: window.ZIP,
        emergencyContactFirstName: window.emergencyContactFirstName,
        emergencyContactLastName: window.emergencyContactLastName,
        emergencyContactPhone: window.emergencyContactPhone
    });
}

// On page load: try to fetch JSON if an email param is present (redirect sets ?prefill=1&data=...)
document.addEventListener('DOMContentLoaded', function () {
    try {
        const params = new URLSearchParams(window.location.search);
        
        // Check URL params for prefill data passed from prefill.php
        const prefillData = params.get('data');
        if (prefillData) {
            try {
                const data = JSON.parse(prefillData);
                console.debug('Prefill data from URL:', data);
                applyPrefillData(data);
            } catch (e) {
                console.error('Failed to parse prefill data:', e);
            }
            return;
        }

        // Check sessionStorage first for prefill data (set by the Continue button)
        const storedData = sessionStorage.getItem('prefillData');
        if (storedData) {
            const data = JSON.parse(storedData);
            console.debug('Prefill data from sessionStorage:', data);
            applyPrefillData(data);
            sessionStorage.removeItem('prefillData'); // Clear it after use
            return;
        }

        // Otherwise check URL params
        const email = params.get('email');
        console.debug('Prefill params', { prefill: params.get('prefill'), email });
        
        // If we have an email (or explicit prefill flag), try fetching JSON; otherwise apply any existing globals
        if ((params.get('prefill') === '1' || email) && email) {
            const url = `../api/prefill.php?email=${encodeURIComponent(email)}&format=json`;
            fetch(url, { headers: { 'Accept': 'application/json' } })
                .then(async res => {
                    if (!res.ok) {
                        const txt = await res.text().catch(() => '<no body>');
                        console.error('Prefill HTTP error', res.status, txt);
                        throw new Error('HTTP ' + res.status);
                    }
                    try {
                        return await res.json();
                    } catch (e) {
                        const txt = await res.text().catch(() => '<no body>');
                        console.error('Prefill JSON parse error', e, txt);
                        throw e;
                    }
                })
                .then(data => {
                    const masked = Object.assign({}, data || {});
                    if (masked && masked.Password) masked.Password = '***masked***';
                    console.debug('Prefill data received', masked);
                    applyPrefillData(data);
                })
                .catch(err => { console.error('Prefill fetch error', err); applyPrefillData(); });
        } else {
            applyPrefillData();
        }
    } catch (e) { console.error('Prefill error', e); }
});

// When user confirms Continue, navigate to the prefill endpoint
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPrefillButton);
} else {
    setupPrefillButton();
}

function setupPrefillButton() {
    var prefillBtn = document.getElementById('btnPrefillContinue');
    var prefillModal = document.getElementById('prefillPopup');
    
    if (prefillBtn) {
        prefillBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const emailField = document.getElementById('txtClientEmail');
            const email = emailField ? emailField.value.trim() : '';
            if (!email) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'warning', title: 'Missing Email', text: 'Please enter an email before continuing.', confirmButtonColor: '#174593' });
                } else {
                    alert('Please enter an email before continuing.');
                }
                return;
            }
            // Navigate to prefill endpoint which will redirect with data or error
            window.location.href = `../api/prefill.php?email=${encodeURIComponent(email)}`;
        });
        
        // Add Enter key listener to modal
        if (prefillModal) {
            prefillModal.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    prefillBtn.click();
                }
            });
        }
    }
}