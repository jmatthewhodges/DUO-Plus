<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 25 @ 7:35 PM
 *  Changes Made:      edited SQL query so that it has:
 *                     An Algorithm
 *                     A Conditonal Statement
 *                     Limits to 1 entry and sorts by ascending
 *                     this also means anything related to a
 *                     seprate query to do the Cond. Stmt is gone 
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// Disable ONLY_FULL_GROUP_BY for this session
$mysqli->query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))");


// https://www.notion.so/Queue-Algorithm-Logic-312f042b2de18052a8d6e7eff2c4b3bf?source=copy_link
//notion link for skyler's request

/*
---------------------------------
The "Now Serving" Query
----------------------------------
*/

$NowServingSelect = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName,
    c.MiddleInitial,
    c.LastName,
    c.DOB,
    GROUP_CONCAT(s.ServiceID) AS ServiceSelections,
    -- W + (x * T) = Priority Score (shown as integer instead of a date)
	TIMESTAMPDIFF(MINUTE, v.FirstCheckedIn,NOW()) + (0.5 * TIMESTAMPDIFF(MINUTE, v.EnteredWaitingRoom,NOW())) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    -- Conditional statement: Service at Maximum Work Capacity
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    WHERE i.IsClosed = 0
    -- Gets the most RECENT entry only
    group by c.ClientID
    order by QueueScore desc
    LIMIT 1"
);
$NowServingSelect->execute();
$NowServing = $NowServingSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$NowServingSelect->close();

// Checks for if the connection to mysql is a success
if (!$NowServingSelect) {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'error' => $mysqli->error]);
    echo $msg;
    error_log($msg);
    exit;
}

/*
---------------------------------
The "Coming Up" Query
----------------------------------
*/

/*
---------------------------------
The "Wait List" Query
----------------------------------
*/

$WaitListSelect = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName,
    c.MiddleInitial,
    c.LastName,
    c.DOB,
    GROUP_CONCAT(s.ServiceID) AS ServiceSelections,
    -- W + (x * T) = Priority Score (shown as integer instead of a date)
	TIMESTAMPDIFF(MINUTE, v.FirstCheckedIn,NOW()) + (0.5 * TIMESTAMPDIFF(MINUTE, v.EnteredWaitingRoom,NOW())) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    -- Conditional statement: Service at Maximum Work Capacity (not included here to contain ALL users)
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    -- limit 1000 as a placeholder (can be changed later if somehow is exceeded in practice)
    group by c.ClientID
    order by QueueScore desc
    LIMIT 1000 OFFSET 1"
);
$WaitListSelect->execute();
$WaitList = $WaitListSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$WaitListSelect->close();

// Checks for if the connection to mysql is a success
if (!$WaitListSelect) {
    http_response_code(500);
    $msg = json_encode(['success' => false, 'error' => $mysqli->error]);
    echo $msg;
    error_log($msg);
    exit;
}


//display endpoint
http_response_code(200);
$msg = json_encode([
    'success' => true,
    "NowServing" => $NowServing,
    "WaitList" => $WaitList
]);
echo $msg;
error_log($msg);
