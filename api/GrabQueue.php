<?php
/**
 * ============================================================
 *  File:        GrabQueue.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 20 @ 8:10 AM
 *  Changes Made:      edited SQL query to fit current DB
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

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
$queue = $_GET['ServiceStatus'] ?? null;


// Validate queue parameter exists
if (!$queue) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter']);
    exit;
}

// Query to get all client data related to the dashboard (client names, DOBs, language flags, and pre-selected services.)
$clientDataStmt = $mysqli->prepare(
    // noted tables to get on railway for revamp: tblClientAuth, tblClients, 
    // tblServices, tblVisitServices, tblVisits
    "SELECT 
        c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, 
        v.RegistrationStatus, s.ServiceStatus, s.QueuePriority, i.ServiceName
    FROM tblClients c
    LEFT JOIN tblVisits v ON c.ClientID = v.ClientID
    LEFT JOIN tblVisitServices s ON v.VisitID = s.VisitID
	LEFT JOIN tblServices i ON s.ServiceID = i.ServiceID
WHERE s.ServiceStatus = ?
");

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

// Fetch processed patients count from stats table
$clientsProcessed = 0;
$statsResult = $mysqli->query("SELECT clientsProcessed FROM tblAnalytics LIMIT 1");
if ($statsResult && $row = $statsResult->fetch_assoc()) {
    $clientsProcessed = (int)$row['clientsProcessed'];
}

// Counting the number of rows to then pull a responsse for each individual person
if (count($rows) > 0) {
    http_response_code(200);
    $msg = json_encode(['success' => true, 'count' => count($rows), 'data' => $rows, 'clientsProcessed' => $clientsProcessed]);
} else {
    http_response_code(201);
    $msg = json_encode(['success' => false, 'count' => 0, 'error' => 'No users applicable.']);
}

echo $msg;
error_log($msg);