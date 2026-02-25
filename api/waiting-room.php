<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 24 @ 10:12 PM
 *  Changes Made:      redone code to add requested queries for
 *                     getting a operation & seeing which services
 *                     are full
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

//make sure to return all variables as Minutes (not integers)
//compartmentalize things 
$QueueScoreSelect = $mysqli->prepare(
    "SELECT 
    c.ClientID, 
    c.FirstName, 
    c.LastName, 
    c.DOB, 
    v.FirstCheckedIn, 
    v.EnteredWaitingRoom, 
    TIMEDIFF(NOW(),v.FirstCheckedIn) AS TotalEventTime,
	TIMEDIFF(NOW(), v.EnteredWaitingRoom) AS CurrentTimeSpent,
	TIMESTAMPDIFF(SECOND, NOW(),v.FirstCheckedIn) + (0.5 * TIMESTAMPDIFF(SECOND, NOW(), v.EnteredWaitingRoom)) AS QueueScore
    FROM tblVisits v
    JOIN tblClients c ON v.ClientID = c.ClientID
    JOIN tblEvents e ON e.EventID = v.EventID
    JOIN tblVisitServiceSelections s ON s.ClientID = c.ClientID
    order by QueueScore ASC"
);
$QueueScoreSelect->execute();
$QueueQuery = $QueueScoreSelect->get_result()->fetch_all(MYSQLI_ASSOC);
$QueueScoreSelect->close();
//display query on json
echo json_encode([
    "QueueScore"      => $QueueQuery
]);

/*
---------------------------------
         PART 2
Check for if services are
----------------------------------
*/

// Fetch all 4 services
$serviceSelect = $mysqli->prepare("
    SELECT *
    FROM tblEventServices
    WHERE ServiceID IN ('Medical', 'Optical', 'Haircut', 'Dental')
");
$serviceSelect->execute();
$result = $serviceSelect->get_result();
$serviceSelect->close();

$services = [];

while ($service = $result->fetch_assoc()) {

    $serviceID = $service['ServiceID'];
    $isFull = $service['CurrentAssigned'] >= $service['MaxCapacity'];

    // check for if service is full 
    if ($isFull && $service['IsClosed'] == 1) {
        $update = $mysqli->prepare("
            UPDATE tblEventServices i
            SET IsClosed = 1
            WHERE ServiceID = ?
        ");
        $update->bind_param("i", $serviceID);
        $update->execute();
        $update->close();
    }

    // Add to output array
    $services[$service['ServiceID']] = [
        "ServiceID"       => $serviceID,
        "MaxCapacity"     => $service['MaxCapacity'],
        "CurrentAssigned" => $service['CurrentAssigned'],
        "IsFull"          => $isFull,
        "CanAssign"       => !$isFull
    ];
}

// Return JSON for all services
echo json_encode([
    "Services" => $services
]);
