<?php
/**
 * ============================================================
 *  File:        GrabQueue.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scenarios such as registration dashboard.
 *
 *  Last Modified By:  Cameron
 *  Last Modified On:  Feb 26 @ 11:00 PM
 *  Changes Made:      added pin-required.php to ensure this endpoint is protected by PIN verification
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

// PIN verification required
require_once __DIR__ . '/pin-required.php';

// Get header type, set POST request type for JSON data (Array merges GET with jsonData)
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $jsonData = json_decode(file_get_contents('php://input'), true) ?? [];
    $_GET = array_merge($_GET, $jsonData);
}

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Get the queue parameter from GET request
$queue = $_GET['RegistrationStatus'] ?? null;

// Validate queue parameter exists
if (!$queue) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter']);
    exit;
}

// Query to get all client data related to the dashboard (client names, DOBs, language flags, and pre-selected services.)
$clientDataStmt = $mysqli->prepare(
    "SELECT 
        c.ClientID, 
        c.FirstName, 
        c.MiddleInitial, 
        c.LastName, 
        c.DOB, 
        GROUP_CONCAT(s.ServiceID) AS ServiceSelections
    FROM tblClients c
    LEFT JOIN tblVisits v ON c.ClientID = v.ClientID
    LEFT JOIN tblVisitServiceSelections s ON c.ClientID = s.ClientID AND v.EventID = s.EventID
    WHERE v.RegistrationStatus = ?
    GROUP BY c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB"
);

// Checks for if the connection to mysql is a success
if (!$clientDataStmt) {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'error' => $mysqli->error]);
    echo $msg;
    error_log($msg);
    exit;
}

// Executes prepared query akin to the mysql connection
$clientDataStmt->bind_param('s', $queue);
if (!$clientDataStmt->execute()) {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'error' => $clientDataStmt->error]);
    echo $msg;
    error_log($msg);
    $clientDataStmt->close();
    exit;
}

// Gets result, fetches all rows, closes statement
$result = $clientDataStmt->get_result();
$rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$clientDataStmt->close();

// Convert ServiceSelections to array
foreach ($rows as &$row) {
    $row['services'] = $row['ServiceSelections'] ? explode(',', $row['ServiceSelections']) : [];
    unset($row['ServiceSelections']);
}
unset($row); 

// Fetch processed patients count from stats table
$clientsProcessed = 0;
$EventID = "4cbde538985861b9"; // Hardcoded eventID
$statsResult = $mysqli->query("SELECT StatValue FROM tblAnalytics WHERE StatID = 'clientsProcessed' AND EventID = '$EventID' LIMIT 1");
if ($statsResult && $statsRow = $statsResult->fetch_assoc()) {
    $clientsProcessed = (int)$statsRow['StatValue'];
}

http_response_code(200);
$msg = json_encode([
    'success' => true,
    'count' => count($rows),
    'data' => $rows,
    'clientsProcessed' => $clientsProcessed
]);
echo $msg;
error_log($msg);