<?php
/**
 * ============================================================
 *  File:        waiting-room.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scnarios such as registration dashboard.
 *
 *  Last Modified By:  Miguel
 *  Last Modified On:  Feb 23 @ 9:38 PM
 *  Changes Made:      Created
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];


/*This task is for determining the order of the clients in the waiting room queue list table (priority level)
and sending it back to the JS to actually put them in the table. (AKA, the algorithm) 

We need three variables to consider when it come to queueing: 
    the total time they have been to the event 
        (which is determined by the first time they were finalized at checked in(aka registration dashboard)),
    how long they have been in the wait room for 
        (needs to update every time a service is finished, for example, if I get out of medical,
        my wait room time should be the exact time I got out), 
    and if the service is currently not full of clients receiving treatment 
        (aka if only 4 people can be worked on in dental, it shouldn't be selecting a person for dental
         to be treated right now because there are no empty seats).

Another thing, split the files for the endpoints.
Change this file to registration-dashboard.php and then make a new one specifically for the waiting room code called waiting-room.php.
I know that we currently track the datetime for when a client is checked into the waiting room, 
but let me know if a DB addition is needed for initial time checked in to compare for the algorithm.*/

//total time @ event


//how long they have been @ wait room



//check if queue is full
if (!isset($_GET['ServiceID'])) {
    echo json_encode(["error" => "Missing ServiceID"]);
    exit;
}

$serviceID = $_GET['ServiceID'];

// query to check which type of service is selected
$serviceSelect = $mysqli->prepare("
    SELECT MaxCapacity, CurrentAssigned, IsClosed
    FROM tblEventServices
    WHERE ServiceID = ?"
);
$serviceSelect->bind_param("s", $serviceID);
$serviceSelect->execute();
$service = $serviceSelect->get_result()->fetch_assoc();
$serviceSelect->close();

if (!$service) {
    echo json_encode(["error" => "Service not found"]);
    exit;
}

// check to see if service is full
$isFull = $service['CurrentAssigned'] >= $service['MaxCapacity'];

if ($isFull && $service['IsClosed'] == 0) {
    $fullCheck = $mysqli->prepare("
        UPDATE tblEventServices
        SET IsClosed = 1
        WHERE ServiceID = ?"
    );
    $fullCheck->bind_param("s", $serviceID);
    $fullCheck->execute();
    $fullCheck->close();

    $service['IsClosed'] = 1;
}

echo json_encode([
    "ServiceID"        => $serviceID,
    "MaxCapacity"      => $service['MaxCapacity'],
    "CurrentAssigned"  => $service['CurrentAssigned'],
    "IsClosed"         => $service['IsClosed'],
    "IsFull"           => $isFull
]);