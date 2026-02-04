// Takes you to the register page with pre filled data
document.getElementById('btnClientLogin').addEventListener('click', function() 
{
    const modal = new bootstrap.Modal(document.getElementById('prefillPopup'));
    modal.show();
});

// Helper: apply prefill data (from fetched JSON or window globals)
function applyPrefillData(data) {
    if (data) {
        window.Email = data.Email || '';
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
        if (!el) return;
        if ('value' in el) el.value = value;
        else el.innerHTML = value;
    };

    // Page 1 (password intentionally excluded)
    setIf('clientRegisterEmail', window.Email || '');

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
        if (sel) sel.value = window.State;
    }

    // Sex radios
    if (window.Sex) {
        const map = { 'male': 'btnSexMale', 'female': 'btnSexFemale', 'intersex': 'btnSexIntersex' };
        const id = map[(window.Sex || '').toLowerCase()];
        if (id) { const r = document.getElementById(id); if (r) r.checked = true; }
    }

    // Emergency Contact
    setIf('emergencyContactFirstName', window.emergencyContactFirstName || '');
    setIf('emergencyContactLastName', window.emergencyContactLastName || '');
    setIf('emergencyContactPhone', window.emergencyContactPhone || '');
}

// On page load: if ?prefill=1&email=... present, fetch JSON and apply immediately; otherwise just apply any globals
document.addEventListener('DOMContentLoaded', function () {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('prefill') === '1' && params.get('email')) {
            const email = params.get('email');
            fetch(`../api/prefill.php?email=${encodeURIComponent(email)}&format=json`, { headers: { 'Accept': 'application/json' } })
                .then(res => {
                    if (!res.ok) throw new Error('Network response was not ok');
                    return res.json();
                })
                .then(data => applyPrefillData(data))
                .catch(err => { console.error('Prefill fetch error', err); applyPrefillData(); });
        } else {
            // Apply existing globals (if any)
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