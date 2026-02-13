/******************************************************
 * DASHBOARD AUTO-REFRESH SCRIPT
 * --------------------------------
 * This script:
 * 1. Calls the PHP endpoint every 30 seconds
 * 2. Gets updated client registration data
 * 3. Compares it with the current table
 * 4. Adds new rows if needed
 * 5. Removes rows that no longer exist
 ******************************************************/

// How often to refresh (30 seconds = 30000 milliseconds)
const POLL_INTERVAL = 30000;


/******************************************************
 * STEP 1: FETCH DATA FROM SERVER
 * --------------------------------
 * This function calls registration-dashboard.php
 * and expects JSON data back.
 ******************************************************/
function fetchDashboardData() {

    fetch('../api/mock-registration-dashboard.php')   // Call PHP endpoint
        .then(response => response.json()) // Convert response to JSON
        .then(data => {
            console.log("Fetched data at:", new Date().toLocaleTimeString(), data);
            updateTable(data);             // Send data to updateTable()
        })
        .catch(error => {
            console.error("Error fetching dashboard data:", error);
        });
}


/******************************************************
 * STEP 2: UPDATE TABLE (SMART VERSION)
 * --------------------------------------
 * This function compares:
 * - Existing rows currently in the table
 * - New rows returned from the database
 *
 * It ONLY:
 * - Adds new clients
 * - Removes deleted clients
 * - Leaves unchanged rows alone
 ******************************************************/
function updateTable(clients) {

    const tableBody = document.getElementById("registrationTableBody");

    if (!tableBody) return; // Safety check


    // --------------------------------------------------
    // STEP 2A: Collect ALL existing row IDs currently
    // inside the table.
    // --------------------------------------------------

    const existingRows = tableBody.querySelectorAll("tr");

    let existingIds = [];

    existingRows.forEach(row => {
        const id = row.getAttribute("data-client-id");
        if (id) {
            existingIds.push(id);
        }
    });


    // --------------------------------------------------
    // STEP 2B: Collect ALL new IDs from database
    // --------------------------------------------------

    const newIds = clients.map(client => client.id);


    // --------------------------------------------------
    // STEP 2C: ADD any clients that do NOT exist yet
    // --------------------------------------------------

    clients.forEach(client => {

        // If this client ID is NOT already in table
        if (!existingIds.includes(client.id)) {

            const row = document.createElement("tr");
            row.classList.add("align-middle");

            // Store client ID in the row (VERY IMPORTANT)
            row.setAttribute("data-client-id", client.id);

            // Build row content
            row.innerHTML = `
                <td>${client.name}</td>
                <td>${client.dob}</td>
                <td>
                    ${client.medical ? "Medical " : ""}
                    ${client.dental ? "Dental " : ""}
                    ${client.optical ? "Optical " : ""}
                    ${client.hair ? "Haircut " : ""}
                </td>
            `;

            // Add row to bottom of table
            tableBody.appendChild(row);
        }
    });


    // --------------------------------------------------
    // STEP 2D: REMOVE rows that no longer exist
    // (Example: client deleted from database)
    // --------------------------------------------------

    existingRows.forEach(row => {

        const rowId = row.getAttribute("data-client-id");

        if (rowId && !newIds.includes(rowId)) {
            row.remove();
        }
    });
}


/******************************************************
 * STEP 3: START POLLING
 * --------------------------------
 * When page loads:
 * 1. Immediately fetch data
 * 2. Then fetch every 30 seconds
 ******************************************************/
document.addEventListener("DOMContentLoaded", function() {

    fetchDashboardData();                 // Run immediately on page load

    setInterval(fetchDashboardData, POLL_INTERVAL); 
    // Run every 30 seconds automatically
});
