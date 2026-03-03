<?php
/**
 * ============================================================
 *  File:        ServiceSelection.php
 *  Purpose:     API endpoint for verifying PIN code for access restriction
 * 
 *  Last Modified By:  Miguel
 *  Last Modified On:  Mar 2 @ 12:45 PM
 *  Changes Made:      Created
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
$queue = $_GET['ServiceID'] ?? null;

/*
endpoints 
all clients checked in or in progress for medical
number of people in waitlist
number in progress
completed
avg wait time
past avg service time

webpage for all info http://localhost:8000/pages/service-scan.html
*/

// Validate queue parameter exists
if (!$queue) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter']);
    exit;
}

//query that gets the TOTAL number of users in the queue
$TotalCountStmt = $mysqli->prepare(
    "SELECT count(c.ClientID)
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    JOIN tblVisitServices t on t.ServiceID = s.ServiceID
    WHERE s.ServiceID = ?"
);

//query that gets the TOTAL number of  IN PROGRESS users in the queue
$inProgressCountStmt = $mysqli->prepare(
    "SELECT count(c.ClientID)
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    JOIN tblVisitServices t on t.ServiceID = s.ServiceID
    WHERE s.ServiceID = ?
    -- 2 = in progress in the DB
    AND t.ServiceStatus = 2"
);

//query that gets the TOTAL number of COMPLETED users in the queue
$completedCountStmt = $mysqli->prepare(
    "SELECT count(c.ClientID)
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    JOIN tblVisitServices t on t.ServiceID = s.ServiceID
    WHERE s.ServiceID = ?
    -- 3 = complete in the DB
    AND t.ServiceStatus = 3"
);

// Query to get all client data related to the  service scan
$clientDataStmt = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName,
    c.MiddleInitial,
    c.LastName,
    c.DOB
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    WHERE s.ServiceID = ?"
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





http_response_code(200);
$msg = json_encode([ 
   'TotalCount' => $TotalCount,
    'completedCount' => $completedCount,
    'inProgressCount' => $inProgressCount,
    'success' => true,
    'count' => count($rows),
    'data' => $rows

]);
echo $msg;
error_log($msg);