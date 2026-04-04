<?php
/**
 * ============================================================
 *  File:        GrabQueue.php
 *  Description: Simple PHP endpoint that gets needed users
 *               from inputted "servicestatus". for use in 
 *               scenarios such as registration dashboard.
 *
 *  Last Modified By:  Cameron
 *  Last Modified On:  April 1 @ 11:00 PM
 *  Changes Made:      Added reset password functionality, added soundex matching to search.
 * ============================================================
*/

// Database connection from other file
require_once __DIR__ . '/db.php';

// PIN verification required
require_once __DIR__ . '/pin-required.php';

// Get header type, set POST request type for JSON data (Array merges GET with jsonData)
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $jsonData = json_decode(file_get_contents('php://input'), true) ?? [];
    $_GET = array_merge($_GET, $jsonData);
}

// Set response header to JSON
header('Content-Type: application/json');

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

$action = $_GET['action'] ?? null;

// Call for searching users by name/email with optional Soundex matching for misspellings
if ($action === 'searchUsers') {
    $query = trim($_GET['query'] ?? '');

    // Return empty immediately — do not auto-load all clients
    if ($query === '') {
        echo json_encode(['success' => true, 'count' => 0, 'data' => []]);
        exit;
    }

    $like = '%' . $query . '%';

    // Split query into words for per-word Soundex matching
    $words = array_values(array_filter(preg_split('/\s+/', $query), fn($w) => strlen($w) >= 2));
    $soundexConditions = [];
    $soundexParams     = [];
    $soundexTypes      = '';
    foreach ($words as $word) {
        $soundexConditions[] = 'SOUNDEX(c.FirstName) = SOUNDEX(?)';
        $soundexParams[]     = $word;
        $soundexTypes       .= 's';
        $soundexConditions[] = 'SOUNDEX(c.LastName) = SOUNDEX(?)';
        $soundexParams[]     = $word;
        $soundexTypes       .= 's';
    }
    $soundexClause = !empty($soundexConditions)
        ? ' OR ' . implode(' OR ', $soundexConditions)
        : '';

    // Main query to search clients by name/email limited to 50 clients
    $sql = "SELECT
                c.ClientID,
                c.FirstName,
                c.MiddleInitial,
                c.LastName,
                c.DOB,
                a.Email
             FROM tblClients c
             LEFT JOIN tblClientAuth a ON c.ClientID = a.ClientID
             WHERE
                c.FirstName LIKE ? OR
                c.LastName LIKE ? OR
                CONCAT(c.FirstName, ' ', c.LastName) LIKE ? OR
                a.Email LIKE ?
                {$soundexClause}
             ORDER BY c.LastName ASC, c.FirstName ASC
             LIMIT 50";

    // Error statement for if the search fails
    $searchStmt = $mysqli->prepare($sql);
    if (!$searchStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while preparing search.']);
        exit;
    }

    // Bind parameters for both LIKE and Soundex conditions
    $types  = 'ssss' . $soundexTypes;
    $params = array_merge([$like, $like, $like, $like], $soundexParams);
    $searchStmt->bind_param($types, ...$params);

    // Error statement for if the database fails to execute the search
    if (!$searchStmt->execute()) {
        $searchStmt->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while searching users.']);
        exit;
    }

    // Gets result, fetches all rows, closes statement
    $result = $searchStmt->get_result();
    $rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
    $searchStmt->close();

    //Returns JSON success response with count of data provided
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'count'   => count($rows),
        'data'    => $rows
    ]);
    exit;
}

// Call for resetting a user's password by clientID, with validation and error handling
if ($action === 'resetUserPassword') {
    $clientID = trim($_GET['clientID'] ?? '');
    $password = $_GET['password'] ?? '';

    // error for if clientID is not provided 
    if ($clientID === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'clientID and password are required.']);
        exit;
    }

    // error for if password does not meet complexity requirements
    if (!preg_match('/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])\S{8,}$/', $password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password does not meet requirements.']);
        exit;
    }

    // Check if clientID exists in tblClientAuth before attempting update
    $checkStmt = $mysqli->prepare('SELECT ClientID FROM tblClientAuth WHERE ClientID = ? LIMIT 1');
    if (!$checkStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while verifying user.']);
        exit;
    }

    // Bind clientID parameter and execute check query
    $checkStmt->bind_param('s', $clientID);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $exists = $checkResult && $checkResult->num_rows > 0;
    $checkStmt->close();

    // Make sure client exists before attempting to reset password, otherwise return error (prevents creating new auth entries for clients without accounts)
    if (!$exists) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'This client does not have an account set up yet and cannot have their password reset.']);
        exit;
    }

    // Hash the new password and update it in the database for the specified clientID
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $updateStmt = $mysqli->prepare('UPDATE tblClientAuth SET Password = ? WHERE ClientID = ?');
    if (!$updateStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database error while preparing password update.']);
        exit;
    }

    // Error statement for if the database fails to execute the password update
    $updateStmt->bind_param('ss', $passwordHash, $clientID);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update password.']);
        exit;
    }

    $updateStmt->close();

    // Return success response if password reset was successful
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Password reset successful.']);
    exit;
}

// Get the queue parameter from GET request
$queue = $_GET['RegistrationStatus'] ?? null;

// Validate queue parameter exists
if (!$queue) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter']);
    exit;
}

// Query to get all client data related to the dashboard (client names, DOBs, language flags, and services.)
// For CheckedIn clients, use tblVisitServices (actual assigned services).
// For Registered clients, use tblVisitServiceSelections (pre-registration selections).
if ($queue === 'CheckedIn') {
    $clientDataStmt = $mysqli->prepare(
        "SELECT 
            c.ClientID, 
            c.FirstName, 
            c.MiddleInitial, 
            c.LastName, 
            c.DOB, 
            c.TranslatorNeeded,
            GROUP_CONCAT(vs.ServiceID) AS ServiceSelections
        FROM tblClients c
        LEFT JOIN tblVisits v ON c.ClientID = v.ClientID
        LEFT JOIN tblVisitServices vs ON vs.VisitID = v.VisitID
        WHERE v.RegistrationStatus = ?
        GROUP BY c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, c.TranslatorNeeded"
    );
} else {
    $clientDataStmt = $mysqli->prepare(
        "SELECT 
            c.ClientID, 
            c.FirstName, 
            c.MiddleInitial, 
            c.LastName, 
            c.DOB, 
            c.TranslatorNeeded,
            GROUP_CONCAT(s.ServiceID) AS ServiceSelections
        FROM tblClients c
        LEFT JOIN tblVisits v ON c.ClientID = v.ClientID
        LEFT JOIN tblVisitServiceSelections s ON c.ClientID = s.ClientID AND v.EventID = s.EventID
        WHERE v.RegistrationStatus = ?
        GROUP BY c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, c.TranslatorNeeded"
    );
}

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
$statsStmt = $mysqli->prepare("SELECT StatValue FROM tblAnalytics WHERE StatID = 'clientsProcessed' AND EventID = ? LIMIT 1");
if ($statsStmt) {
    $statsStmt->bind_param('s', $EventID);
    $statsStmt->execute();
    $statsResult = $statsStmt->get_result();
    if ($statsResult && $statsRow = $statsResult->fetch_assoc()) {
        $clientsProcessed = (int)$statsRow['StatValue'];
    }
    $statsStmt->close();
}

// Fetch service availability data from tblEventServices
$serviceAvailability = [];
$serviceQuery = $mysqli->prepare(
    "SELECT es.ServiceID, es.MaxCapacity, es.CurrentAssigned, es.IsClosed,
            es.StandbyLimit, s.ServiceName
     FROM tblEventServices es
     LEFT JOIN tblServices s ON es.ServiceID = s.ServiceID
     WHERE es.EventID = ?"
);

if ($serviceQuery) {
    $serviceQuery->bind_param('s', $EventID);
    $serviceQuery->execute();
    $serviceResult = $serviceQuery->get_result();
    
    while ($serviceRow = $serviceResult->fetch_assoc()) {
        $maxCap = (int)$serviceRow['MaxCapacity'];
        $assigned = (int)$serviceRow['CurrentAssigned'];
        $standbyCount = ($maxCap > 0 && $assigned > $maxCap) ? ($assigned - $maxCap) : 0;

        $serviceAvailability[] = [
            'serviceID' => $serviceRow['ServiceID'],
            'serviceName' => $serviceRow['ServiceName'],
            'maxCapacity' => $maxCap,
            'currentAssigned' => $assigned,
            'isClosed' => (int)$serviceRow['IsClosed'],
            'standbyLimit' => (int)$serviceRow['StandbyLimit'],
            'standbyCount' => $standbyCount
        ];
    }
    $serviceQuery->close();
}

http_response_code(200);
$msg = json_encode([
    'success' => true,
    'count' => count($rows),
    'data' => $rows,
    'clientsProcessed' => $clientsProcessed,
    'services' => $serviceAvailability
]);
echo $msg;
error_log($msg);