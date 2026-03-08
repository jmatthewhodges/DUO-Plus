<?php
/**
 * ============================================================
 *  File:        GrabQueue.php (updated)
 *  Description: Gets queue data for registration dashboard.
 *               - RegistrationStatus=Registered  → pulls from
 *                 tblVisitServiceSelections (pre-reg choices)
 *               - RegistrationStatus=CheckedIn   → pulls from
 *                 tblVisitServices (actual assigned services)
 *
 *  Last Modified By:  Skyler
 *  Last Modified On:  Mar 4
 *  Changes Made:      Added CheckedIn branch that reads from
 *                     tblVisitServices instead of selections
 * ============================================================
*/

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/pin-required.php';

if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $jsonData = json_decode(file_get_contents('php://input'), true) ?? [];
    $_GET = array_merge($_GET, $jsonData);
}

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];

$queue = $_GET['RegistrationStatus'] ?? null;

if (!$queue) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing queue parameter']);
    exit;
}

$EventID = "4cbde538985861b9"; // Hardcoded eventID

// ---------------------------------------------------------------
// Branch: CheckedIn — pull actual assigned services from tblVisitServices
// ---------------------------------------------------------------
if ($queue === 'CheckedIn') {

    $clientDataStmt = $mysqli->prepare(
        "SELECT 
            c.ClientID, 
            c.FirstName, 
            c.MiddleInitial, 
            c.LastName, 
            c.DOB, 
            c.TranslatorNeeded,
            v.VisitID,
            v.QR_Code_Data,
            GROUP_CONCAT(vs.ServiceID) AS ServiceSelections
        FROM tblClients c
        INNER JOIN tblVisits v 
            ON c.ClientID = v.ClientID 
            AND v.EventID = ?
            AND v.RegistrationStatus = 'CheckedIn'
        LEFT JOIN tblVisitServices vs 
            ON v.VisitID = vs.VisitID
        GROUP BY 
            c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, 
            c.DOB, c.TranslatorNeeded, v.VisitID, v.QR_Code_Data"
    );

    if (!$clientDataStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $mysqli->error]);
        exit;
    }

    $clientDataStmt->bind_param('s', $EventID);

// ---------------------------------------------------------------
// Branch: Registered (and any other status) — pull from tblVisitServiceSelections
// ---------------------------------------------------------------
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
        LEFT JOIN tblVisits v 
            ON c.ClientID = v.ClientID
        LEFT JOIN tblVisitServiceSelections s 
            ON c.ClientID = s.ClientID AND v.EventID = s.EventID
        WHERE v.RegistrationStatus = ?
        GROUP BY 
            c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, 
            c.DOB, c.TranslatorNeeded"
    );

    if (!$clientDataStmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $mysqli->error]);
        exit;
    }

    $clientDataStmt->bind_param('s', $queue);
}

// --- Execute ---
if (!$clientDataStmt->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $clientDataStmt->error]);
    $clientDataStmt->close();
    exit;
}

$result = $clientDataStmt->get_result();
$rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$clientDataStmt->close();

// Convert ServiceSelections CSV to array
foreach ($rows as &$row) {
    $row['services'] = $row['ServiceSelections'] ? explode(',', $row['ServiceSelections']) : [];
    unset($row['ServiceSelections']);
}
unset($row);

// --- Fetch processed count (only relevant for Registration tab, but always return it) ---
$clientsProcessed = 0;
$statsResult = $mysqli->query(
    "SELECT StatValue FROM tblAnalytics 
     WHERE StatID = 'clientsProcessed' AND EventID = '$EventID' LIMIT 1"
);
if ($statsResult && $statsRow = $statsResult->fetch_assoc()) {
    $clientsProcessed = (int)$statsRow['StatValue'];
}

// --- Fetch service availability ---
$serviceAvailability = [];
$serviceQuery = $mysqli->prepare(
    "SELECT es.ServiceID, es.MaxCapacity, es.CurrentAssigned, es.IsClosed,
            s.ServiceName
     FROM tblEventServices es
     LEFT JOIN tblServices s ON es.ServiceID = s.ServiceID
     WHERE es.EventID = ?"
);

if ($serviceQuery) {
    $serviceQuery->bind_param('s', $EventID);
    $serviceQuery->execute();
    $serviceResult = $serviceQuery->get_result();

    while ($serviceRow = $serviceResult->fetch_assoc()) {
        $serviceAvailability[] = [
            'serviceID'       => $serviceRow['ServiceID'],
            'serviceName'     => $serviceRow['ServiceName'],
            'maxCapacity'     => (int)$serviceRow['MaxCapacity'],
            'currentAssigned' => (int)$serviceRow['CurrentAssigned'],
            'isClosed'        => (int)$serviceRow['IsClosed']
        ];
    }
    $serviceQuery->close();
}

http_response_code(200);
echo json_encode([
    'success'          => true,
    'count'            => count($rows),
    'data'             => $rows,
    'clientsProcessed' => $clientsProcessed,
    'services'         => $serviceAvailability
]);