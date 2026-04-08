/**
 * ============================================================
 *  File:        chiropractor.js
 *  Description: Chiropractor counter functionality.
 *
 *  Last Modified By:  GitHub Copilot
 *  Last Modified On:  April 8, 2026
 *  Changes Made:      Created file from food truck flow for chiropractor tracking.
 * ============================================================
 */

(function () {

    // References for counter displays
    var clientsServed = document.getElementById('chiropractorClientsServed');
    var volunteersServed = document.getElementById('chiropractorVolunteersServed');

    // References for control buttons
    var clientsPlus = document.getElementById('chiropractorClientsPlus');
    var clientsMinus = document.getElementById('chiropractorClientsMinus');

    var volunteersPlus = document.getElementById('chiropractorVolunteersPlus');
    var volunteersMinus = document.getElementById('chiropractorVolunteersMinus');

    // References for status text
    var statusText = document.getElementById('chiropractorStatus');

    // Event ID returned by backend (active event)
    var currentEventID = null;

    // Show status message under the buttons
    function setStatus(message, isError) {
        if (!statusText) return;

        statusText.textContent = message;

        if (isError) {
            statusText.classList.add('text-danger');
            statusText.classList.remove('text-muted');
        } else {
            statusText.classList.remove('text-danger');
            statusText.classList.add('text-muted');
        }
    }

    // Read number from counter
    function getCounterValue(element) {
        return Number.parseInt(element.textContent, 10) || 0;
    }

    // Write number to counter
    function setCounterValue(element, value) {
        element.textContent = String(Math.max(0, Number.parseInt(value, 10) || 0));
    }

    // Pull values from backend when reloading
    function loadStats() {
        setStatus('Loading latest chiropractor stats.');

        fetch('../api/chiropractor-stats.php', { method: 'GET' })
            .then(function (response) {
                return response.json();
            })
            .then(function (result) {
                if (!result.success) {
                    throw new Error(result.message || 'Could not load stats.');
                }

                currentEventID = result.eventID || currentEventID;

                setCounterValue(clientsServed, result.stats.chiropractorClientsServed);
                setCounterValue(volunteersServed, result.stats.chiropractorVolunteersServed);

                setStatus('Updated from database.');
            })
            .catch(function (error) {
                setStatus('Load failed: ' + error.message, true);
            });
    }

    // Add or subtract counter in the database after each +/- click
    function saveCounter(counterName, value) {
        return fetch('../api/chiropractor-stats.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                counterName: counterName,
                value: value
            })
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (result) {
                if (!result.success) {
                    throw new Error(result.message || 'Save failed.');
                }

                currentEventID = result.eventID || currentEventID;
                setStatus('Saved.');
            })
            .catch(function (error) {
                setStatus('Save failed: ' + error.message, true);
                loadStats();
            });
    }

    // Handle clicks for plus/minus buttons
    function setupCounter(element, plusBtn, minusBtn, key) {
        if (!element || !plusBtn || !minusBtn) return;

        plusBtn.addEventListener('click', function () {
            var next = getCounterValue(element) + 1;
            setCounterValue(element, next);
            saveCounter(key, next);
        });

        minusBtn.addEventListener('click', function () {
            var next = getCounterValue(element) - 1;
            setCounterValue(element, next);
            saveCounter(key, next);
        });
    }

    setupCounter(clientsServed, clientsPlus, clientsMinus, 'chiropractorClientsServed');
    setupCounter(volunteersServed, volunteersPlus, volunteersMinus, 'chiropractorVolunteersServed');

    function initChiropractor() {
        loadStats();
        setInterval(loadStats, 40000);
    }

    document.addEventListener('pinVerified', initChiropractor);

    document.addEventListener('DOMContentLoaded', function () {
        if (document.body.classList.contains('pin-verified')) {
            initChiropractor();
        }
    });

})();
