<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 24 @ 3:31 PM
 *  Changes Made:      added steps 2 and 3
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

/*
---------------------------------
         PART 1
The Operation Query
----------------------------------
*/

$QueueScoreSelect = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName, 
    c.LastName, 
    c.DOB, 
    v.FirstCheckedIn, 
    v.EnteredWaitingRoom, 
    s.ServiceID,
    e.EventDate - NOW() as TotalEventTime,
	v.EnteredWaitingRoom - v.FirstCheckedIn as CurrentTimeSpent,
    (v.EnteredWaitingRoom - v.FirstCheckedIn) + (0.5 * (e.EventDate - NOW())) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    order by QueueScore ASC"
);
$QueueScoreSelect->execute();
$QueueQuery = $QueueScoreSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$QueueScoreSelect->close();
echo json_encode([
    "QueueScore"      => $QueueQuery
]);

/*
---------------------------------
         PART 3
Check for if service is full
----------------------------------
