// Takes you to the register page with pre filled data
const btnClientLoginEl = document.getElementById('btnClientLogin');
if (btnClientLoginEl) {
    btnClientLoginEl.addEventListener('click', function () {
        const popup = document.getElementById('prefillPopup');
        if (!popup) {
            console.debug('Prefill popup element not found');
            return;
        }
        const modal = new bootstrap.Modal(popup);
        modal.show();
    });
} else {
    console.debug('Prefill: btnClientLogin not found on this page');
} 

// Helper: apply prefill data (from fetched JSON or window globals)
function applyPrefillData(data) {
    console.debug('applyPrefillData called');
    if (data) {
        window.Email = data.Email || '';
        window.Password = data.Password || '';
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
    }

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

    // Page 1 (include password for testing)
    setIf('clientRegisterEmail', window.Email || '');
    setIf('clientRegisterPass', window.Password || '');

    // Page 2
    setIf('clientFirstName', window.FirstName || '');
    setIf('clientMiddleInitial', window.MiddleName || '');
    setIf('clientLastName', window.LastName || '');
    setIf('clientDOB', window.DOB || '');
    setIf('clientPhone', window.Phone || '');

    // Address Page
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
    setIf('emergencyContactFirstName', window.emergencyContactFirstName || '');
    setIf('emergencyContactLastName', window.emergencyContactLastName || '');
    setIf('emergencyContactPhone', window.emergencyContactPhone || '');

    // Summarize what got applied (password intentionally excluded)
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

// On page load: try to fetch JSON if an email param is present (redirect sets ?prefill=1&email=...)
document.addEventListener('DOMContentLoaded', function () {
    try {
        const params = new URLSearchParams(window.location.search);
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

// When user confirms Continue, navigate to the prefill endpoint which will set sessionStorage and redirect
var prefillBtn = document.getElementById('btnPrefillContinue');
if (prefillBtn) {
    prefillBtn.addEventListener('click', function (e) {
        e.preventDefault();
        const emailField = document.getElementById('txtClientEmail');
        const email = emailField ? emailField.value.trim() : '';
        if (!email) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Missing Email', text: 'Please enter an email before continuing.', confirmButtonColor: '#174593' });
            }
            return;
        }
        window.location.href = `../api/prefill.php?email=${encodeURIComponent(email)}`;
    });
}