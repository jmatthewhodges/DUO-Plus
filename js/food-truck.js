/**
 * ============================================================
 *  File:        food-truck.js
 *  Description: Food truck counter functionality.
 *
 *  Last Modified By:  Lauren
 *  Last Modified On:  Feb 24 @ 9:02 PM
 *  Changes Made:      Created file
 * ============================================================
*/
 

(function () {

    // References for counter displays
    var clientsServed = document.getElementById('clientsServed');
    var volunteersServed = document.getElementById('volunteersServed');

    // References for control buttons
    var clientsPlus = document.getElementById('clientsPlus');
    var clientsMinus = document.getElementById('clientsMinus');

    var volunteersPlus = document.getElementById('volunteersPlus');
    var volunteersMinus = document.getElementById('volunteersMinus');

    // References for status text
    var statusText = document.getElementById('foodTruckStatus');

    // Sends us eventid, every save should go to the same eventid    
    var currentEventID = null;


    // Show status message under the buttons
    function setStatus(message, isError) {
        if (!statusText) return;

        statusText.textContent = message;

        // If something failed, make it red
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
        setStatus('Loading latest food truck stats.');

        fetch('../api/food-truck-stats.php', { method: 'GET' })

            .then(function (response) {
                return response.json();
            })

            .then(function (result) {

                if (!result.success) {
                    throw new Error(result.message || 'Could not load stats.');
                }

                // Save event ID in case backend just created it
                currentEventID = result.eventID || currentEventID;

                // Update what the user sees
                setCounterValue(clientsServed, result.stats.clientsServed);
                setCounterValue(volunteersServed, result.stats.volunteersServed);

                setStatus('Updated from database.');
            })

            .catch(function (error) {
                setStatus('Load failed: ' + error.message, true);
            });
    }


    // Add or subtract counter in the database after each +/- click
    function saveCounter(counterName, value) {
        return fetch('../api/food-truck-stats.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                EventID: currentEventID,
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

                // If something went wrong, reload real values
                loadStats();
            });
    }



   // Handles click events for + and - buttons per counter
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

    // Set up both counters
    setupCounter(clientsServed, clientsPlus, clientsMinus, 'clientsServed');
    setupCounter(volunteersServed, volunteersPlus, volunteersMinus, 'volunteersServed');

    // Initial database load + every minute refresh
    loadStats();
    setInterval(loadStats, 40000);

})();