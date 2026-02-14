<?php



// Database connection from other file

require_once __DIR__ . '/db.php';



// Get header type, set POST request type for JSON data

if ($_SERVER['CONTENT_TYPE'] === 'application/json') {

    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];

}



// Get set mysql connection

$mysqli = $GLOBALS['mysqli'];



// Temporarily define the client's status to the waiting room queue

$checkInStatus = 'waiting_room';



// Check if clientId was passed

$clientID = $_POST['clientID'] ?? null;



// If no ID was sent, send a 400 error

if (empty($clientID)) {

    http_response_code(400);

    echo json_encode(['success' => false, 'error' => 'clientID is required']);

    exit;

}



$services = $_POST['services'] ?? [];



// Check if needsInterpreter flag exists in the database, if so, turn flag into 1 (true) or 0 (false)

// If it's missing (from pre-existing registrations) set it to null so we don't incorrectly overwrite existing data

$needsInterpreter = array_key_exists('needsInterpreter', $_POST)

    ? ($_POST['needsInterpreter'] ? 1 : 0)

    : null;



// -------------------------------------------------------------------------

// DATA PREPARATION

// -------------------------------------------------------------------------



$hasMedical = in_array('medical', $services) ? 1 : 0;

$hasOptical = in_array('optical', $services) ? 1 : 0;

$hasDental  = in_array('dental', $services) ? 1 : 0;

$hasHair    = in_array('haircut', $services) ? 1 : 0;



// -------------------------------------------------------------------------

// DATABASE UPDATE

// -------------------------------------------------------------------------



// Prepare client info

// NOTE: UNCOMMENT THE Queue PART BELOW WHEN WE ADD IT TO THE DATABASE.

// Don't forget to add it back in when we update the DB

$queryString = "UPDATE tblClientRegistrations

        SET DateTime = NOW(),

            Medical = ?,

            Optical = ?,

            Dental = ?,

            Hair = ?";

           // Queue = ?";

           

// NOTE: UNCOMMENT THE LINE BELOW WHEN 'Queue' IS ADDED TO DATABASE

// $queryString .= ", Queue = ?";



// NOTE: UNCOMMENT THE LINES BELOW WHEN 'NeedsInterpreter' IS ADDED TO DATABASE

/*

if ($needsInterpreter !== null) {

    $queryString .= ", NeedsInterpreter = ?";

}

*/



// Limits it to 1 in case of duplicate IDs due to conversion of old database

$queryString .= " WHERE ClientID = ? LIMIT 1";



$checkInUpdate = $mysqli->prepare($queryString);



// Check if preparation was successful

if (!$checkInUpdate) {

    http_response_code(500);

    echo json_encode(['success' => false, 'message' => 'Query preparation failed: ' . $mysqli->error]);

    exit;

}



// NOTE: UNCOMMENT THE TEXT BLOCK BELOW AND DELETE THE TEMP BINDING WHEN DB IS READY

/*

// Bind parameters. 'i' = integer, 's' = string

if ($needsInterpreter !== null) {

    // 5 integers (Services & Interpeter) + 2 Strings (Queue & ID)

    $checkInUpdate->bind_param("iiiisis",

        $hasMedical, $hasOptical, $hasDental, $hasHair, $checkInStatus, $needsInterpreter, $clientID

    );

} else {

    // 4 integers (Services) + 2 Strings (Queue & ClientID)

    $checkInUpdate->bind_param("iiiiss",

        $hasMedical, $hasOptical, $hasDental, $hasHair, $checkInStatus, $clientID

    );

}

*/



// BINDING WITHOUT QUEUE OR INTERPRETER FOR NOW, UNTIL WE ADD TO THE DATABASE  

// We only bind the 4 services + ClientID. We skip Queue/Interpreter for now.

$checkInUpdate->bind_param("iiiis",

    $hasMedical, $hasOptical, $hasDental, $hasHair, $clientID

);



if ($checkInUpdate->execute()) {



    // Check if a row was found

    if ($checkInUpdate->affected_rows > 0) {

        http_response_code(200);

        $msg = json_encode([

            'success' => true,

            'message' => 'Client successfully checked in.',

            // NOTE: We still send the queue back so the frontend works, even though we haven't added it yet.

            'data' => ['clientID' => $clientID, 'queue' => $checkInStatus]

        ]);

        echo $msg;

    } else {

        // Query ran correctly, but found nobody to update. ID incorrect

        http_response_code(404);

        $msg = json_encode(['success' => false, 'message' => 'Client ID not found.']);

        echo $msg;

        error_log("Check-in Failed: ClientID $clientID not found.");

    }



} else {

    // SQL Failed (Crash or syntax error)

    http_response_code(500);

    $msg = json_encode(['success' => false, 'message' => 'Database update failed.']);

    echo $msg;

    error_log("Check-in Error: " . $mysqli->error);

}



$checkInUpdate->close();



// add <script src="../js/check-in.js"></script>

// at the bottom of the registration dashboard.html to prepare for when we connect it to client Ids

// Later we connect each button to clientid database so it knows where to attach.