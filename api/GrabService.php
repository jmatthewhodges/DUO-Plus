<?php
/**
 * ============================================================
 *  File:        ServiceSelection.php
 *  Purpose:     API endpoint for querying all clients checked in to a certain service.
 * 
 *  Last Modified By:  Miguel
 *  Last Modified On:  Mar 2 @ 7:00 PM
 *  Changes Made:      Added quieries for in progress and completed users
 * ============================================================
*/
//TO-DO :  FIX THE DB QUERY

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
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter(s)']);
    exit;
}

// Normalize to array
$queues = is_array($queue) ? $queue : [$queue];

$types = str_repeat('s', count($queues));

//query that gets the TOTAL number of  IN PROGRESS users in the queue
$inProgressSQL = "
    SELECT DISTINCT *
    FROM tblVisitServices
    WHERE ServiceID IN ($placeholders)
    AND ServiceStatus = 2
";

// Checks for if the connection to mysql is a success
$inProgressStmt = $mysqli->prepare($inProgressSQL);
if (!$inProgressStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}

$inProgressStmt->bind_param($types, ...$queues);

if (!$inProgressStmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $inProgressStmt->error]);
    $inProgressStmt->close();
    exit;
}

// Gets result, fetches all rows, closes statement
$inProgressResult = $inProgressStmt->get_result();
$inProgressRows = $inProgressResult ? $inProgressResult->fetch_all(MYSQLI_ASSOC) : [];
$inProgressStmt->close();

//query that gets the TOTAL number of COMPLETED users in the queue
$completedSQL = "
    SELECT DISTINCT *
    FROM tblVisitServices
    WHERE ServiceID IN ($placeholders)
    AND ServiceStatus = 3
";

// Checks for if the connection to mysql is a success
$completedStmt = $mysqli->prepare($completedSQL);
if (!$completedStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}

$completedStmt->bind_param($types, ...$queues);

if (!$completedStmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $completedStmt->error]);
    $completedStmt->close();
    exit;
}

// Gets result, fetches all rows, closes statement
$completedResult = $completedStmt->get_result();
$completedRows = $completedResult ? $completedResult->fetch_all(MYSQLI_ASSOC) : [];
$completedStmt->close();

// main client count 
$clientSQL = "
    SELECT 
        c.ClientID,
        c.FirstName,
        c.MiddleInitial,
        c.LastName,
        c.DOB
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    JOIN tblEventServices i ON i.ServiceID = s.ServiceID
    JOIN tblVisitServices t ON t.ServiceID = s.ServiceID
    WHERE s.ServiceID IN ($placeholders)
    AND t.ServiceStatus = 1
";

// Checks for if the connection to mysql is a success
$clientStmt = $mysqli->prepare($clientSQL);
if (!$clientStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $mysqli->error]);
    exit;
}

$clientStmt->bind_param($types, ...$queues);

if (!$clientStmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $clientStmt->error]);
    $clientStmt->close();
    exit;
}

// Gets result, fetches all rows, closes statement

$clientResult = $clientStmt->get_result();
$clientRows = $clientResult ? $clientResult->fetch_all(MYSQLI_ASSOC) : [];
$clientStmt->close();


http_response_code(200);
$response = [
    'success' => true,
    'completedCount' => count($completedRows),
    'inProgressCount' => count($inProgressRows),
    'Totalcount' => count($clientRows),
    'data' => $clientRows
];

echo json_encode($response);
error_log(json_encode($response));