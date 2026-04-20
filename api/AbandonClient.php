<?php
/**
 * ============================================================
 * File:            AbandonClient.php
 * Description:     Mark a client visit as abandoned and release active seats.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:20 PM
 * Changes Made:      Standardized readability structure and comments.
 * ============================================================
 */
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$clientID = $input['ClientID'] ?? null;

if (!$clientID) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ClientID is required']);
    exit;
}

$mysqli = $GLOBALS['mysqli'];

// Get active event
$eventStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 LIMIT 1");
$eventStmt->execute();
$eventResult = $eventStmt->get_result()->fetch_assoc();
$eventStmt->close();

if (!$eventResult) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No active event']);
    exit;
}
$activeEventID = $eventResult['EventID'];

// Get the client's visit
$visitStmt = $mysqli->prepare(
    "SELECT VisitID, EventID FROM tblVisits
     WHERE ClientID = ? AND EventID = ? AND RegistrationStatus = 'CheckedIn'
     LIMIT 1"
);
$visitStmt->bind_param('ss', $clientID, $activeEventID);
$visitStmt->execute();
$visitRow = $visitStmt->get_result()->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Client visit not found or not checked in']);
    exit;
}
$visitID = $visitRow['VisitID'];
$eventID = $visitRow['EventID'];

try {
    $mysqli->begin_transaction();

    // Gather current active service rows for cleanup + movement logs.
    $activeServicesStmt = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceID, ServiceStatus
         FROM tblVisitServices
         WHERE VisitID = ?
           AND ServiceStatus IN ('Pending','Standby','In-Progress')"
    );
    if (!$activeServicesStmt) {
        throw new Exception('Failed to prepare active service query: ' . $mysqli->error);
    }
    $activeServicesStmt->bind_param('s', $visitID);
    $activeServicesStmt->execute();
    $activeServiceRows = $activeServicesStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $activeServicesStmt->close();

    $inProgressByService = [];
    foreach ($activeServiceRows as $row) {
        if (($row['ServiceStatus'] ?? '') !== 'In-Progress') continue;
        $sid = $row['ServiceID'];
        $inProgressByService[$sid] = ($inProgressByService[$sid] ?? 0) + 1;
    }

    // Clear in-progress state so abandoned clients are not stuck forever as active.
    if (!empty($inProgressByService)) {
        $clearInProgressStmt = $mysqli->prepare(
            "UPDATE tblVisitServices
             SET ServiceStatus = 'Pending'
             WHERE VisitID = ?
               AND ServiceStatus = 'In-Progress'"
        );
        if (!$clearInProgressStmt) {
            throw new Exception('Failed to prepare in-progress cleanup query: ' . $mysqli->error);
        }
        $clearInProgressStmt->bind_param('s', $visitID);
        $clearInProgressStmt->execute();
        $clearInProgressStmt->close();

        // Release occupied seats for services this client was actively in.
        $seatReleaseStmt = $mysqli->prepare(
            "UPDATE tblEventServices
             SET SeatsInProgress = GREATEST(SeatsInProgress - ?, 0)
             WHERE EventID = ? AND ServiceID = ?"
        );
        if (!$seatReleaseStmt) {
            throw new Exception('Failed to prepare seat release query: ' . $mysqli->error);
        }
        foreach ($inProgressByService as $serviceID => $releaseCount) {
            $seatReleaseStmt->bind_param('iss', $releaseCount, $eventID, $serviceID);
            $seatReleaseStmt->execute();
        }
        $seatReleaseStmt->close();
    }

    // Mark visit as abandoned.
    $abandonStmt = $mysqli->prepare("UPDATE tblVisits SET IsAbandoned = 1 WHERE VisitID = ?");
    if (!$abandonStmt) {
        throw new Exception('Failed to prepare abandon query: ' . $mysqli->error);
    }
    $abandonStmt->bind_param('s', $visitID);
    $abandonStmt->execute();
    $abandonStmt->close();

    // Log 'Abandoned' for every active service row on this visit.
    $now     = date('Y-m-d H:i:s');
    $logStmt = $mysqli->prepare(
        "INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp) VALUES (?, ?, 'Abandoned', ?)"
    );
    if ($logStmt) {
        foreach ($activeServiceRows as $row) {
            $logID = uniqid('log_', true);
            $logStmt->bind_param('sss', $logID, $row['VisitServiceID'], $now);
            $logStmt->execute();
        }
        $logStmt->close();
    }

    $mysqli->commit();

    $releasedSeats = array_sum($inProgressByService);
    echo json_encode([
        'success' => true,
        'message' => 'Client marked as abandoned.',
        'releasedInProgressSeats' => $releasedSeats
    ]);
} catch (Throwable $e) {
    $mysqli->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to abandon client: ' . $e->getMessage()]);
}
