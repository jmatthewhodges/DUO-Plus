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

    function updateCounter(valueId, plusId, minusId) {
        var valueCounter = document.getElementById(valueId);
        var plusCounter = document.getElementById(plusId);
        var minusCounter = document.getElementById(minusId);

        if (!valueCounter || !plusCounter || !minusCounter) {
            return;
        }

        // Read current display value
        function getValue() {
            return Number.parseInt(valueCounter.textContent, 10) || 0;
        }

        // Update value, make sure it doesnt go below 0
        function updateValue(nextValue) {
            valueCounter.textContent = String(Math.max(0, nextValue));
        }

        // Plus control on right sides
        plusCounter.addEventListener('click', function () {
            updateValue(getValue() + 1);
        });

        // Minus control on left sides
        minusCounter.addEventListener('click', function () {
            updateValue(getValue() - 1);
        });
    }

    // Call functions for both counters
    updateCounter('clientsServed', 'clientsPlus', 'clientsMinus');
    updateCounter('volunteersServed', 'volunteersPlus', 'volunteersMinus');
})();
