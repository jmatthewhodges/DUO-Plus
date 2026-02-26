<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 25 @ 6:55 PM
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
    c.LastName,
    c.DOB,
    v.FirstCheckedIn,
    v.EnteredWaitingRoom, 
    s.ServiceID,
    -- Algorithm: Current Time minus Time Registered = Total Event Time (T)
    TIMEDIFF(NOW(),v.FirstCheckedIn) AS TotalEventTime,
    -- Current Time minus Time in Wait Room = Current Time Spent in Wait Room (W)
	TIMEDIFF(NOW(), v.EnteredWaitingRoom) AS CurrentTimeSpent,
    -- W + (x * T) = Priority Score (shown as integer instead of a date)
	TIMESTAMPDIFF(SECOND, NOW(),v.FirstCheckedIn) + (0.5 * TIMESTAMPDIFF(SECOND, NOW(), v.EnteredWaitingRoom)) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    -- Conditional statement: Service at Maximum Work Capacity
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    WHERE i.IsClosed = 0
    -- Gets the most RECENT entry only
    order by QueueScore ASC
    LIMIT 2"
);
$NowServingSelect->execute();
$NowServing = $NowServingSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$NowServingSelect->close();

//display endpoint
echo json_encode([
    "NowServing"          => $NowServing,
]);

/*
---------------------------------
The "Wait List" Query
----------------------------------
*/

$WaitListSelect = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName,
    c.LastName,
    c.DOB,
    v.FirstCheckedIn,
    v.EnteredWaitingRoom, 
    s.ServiceID,
    -- Algorithm: Current Time minus Time Registered = Total Event Time (T)
    TIMEDIFF(NOW(),v.FirstCheckedIn) AS TotalEventTime,
    -- Current Time minus Time in Wait Room = Current Time Spent in Wait Room (W)
	TIMEDIFF(NOW(), v.EnteredWaitingRoom) AS CurrentTimeSpent,
    -- W + (x * T) = Priority Score (shown as integer instead of a date)
	TIMESTAMPDIFF(SECOND, NOW(),v.FirstCheckedIn) + (0.5 * TIMESTAMPDIFF(SECOND, NOW(), v.EnteredWaitingRoom)) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    -- Conditional statement: Service at Maximum Work Capacity
    JOIN tblEventServices i on i.ServiceID = s.ServiceID
    WHERE i.IsClosed = 0
    -- Skips the first two entires (as they are "Now Serving"), 
    -- limit 1000 as a placeholder (can be changed later if somehow is exceeded in practice)
    order by QueueScore ASC
    LIMIT 1000 OFFSET 2"
);
$WaitListSelect->execute();
$WaitList = $WaitListSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$WaitListSelect->close();

//display endpoint
echo json_encode([
    "WaitList"          => $WaitList,
]);

