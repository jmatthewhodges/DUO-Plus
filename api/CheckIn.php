<?php
/**
 * ============================================================
 *  File:        CheckIn.php
 *  Purpose:     Update client info and check them into waiting room
 * 
 *  Last Modified By:  Matthew
 *  Last Modified On:  Feb 24 @ 7:53 PM
 *  Changes Made:      Renamed CheckInTime -> EnteredWaitingRoom (updates every check-in)
 *                     Added FirstCheckedIn (one-time insert, never overwritten)
 *                     Added checkedIn list to response for registration table
 * ============================================================
*/

// Set content-type and default timezone
header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

// Request method check
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed. Use POST.']);
    exit;
}

// Content-Type check
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'message' => 'Content-Type must be application/json.']);
    exit;
}

// Decode JSON body
$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
    exit;
}

// Database connection
require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

// Validate required fields
$clientID         = trim($body['clientID'] ?? '');
$services         = $body['services'] ?? [];
$needsInterpreter = !empty($body['needsInterpreter']) ? 1 : 0;

if (empty($clientID)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required field: clientID.']);
    exit;
}

if (empty($services) || !is_array($services)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing or invalid services array.']);
    exit;
}

// Hardcoded EventID for now
$eventID = '4cbde538985861b9';

// Update TranslatorNeeded on tblClients
$updateClient = $mysqli->prepare("UPDATE tblClients SET TranslatorNeeded = ? WHERE ClientID = ?");
if (!$updateClient) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}
$updateClient->bind_param('is', $needsInterpreter, $clientID);
if (!$updateClient->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update client: ' . $updateClient->error]);
    $updateClient->close();
    exit;
}
$updateClient->close();

// Fetch the VisitID for this client + event
$visitStmt = $mysqli->prepare(
    "SELECT VisitID, FirstCheckedIn FROM tblVisits WHERE ClientID = ? AND EventID = ? LIMIT 1"
);

if (!$visitStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
    exit;
}

$visitStmt->bind_param('ss', $clientID, $eventID);
$visitStmt->execute();
$visitResult = $visitStmt->get_result();
$visitRow = $visitResult->fetch_assoc();
$visitStmt->close();

if (!$visitRow) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'No visit record found for this client and event.']);
    exit;
}

$visitID          = $visitRow['VisitID'];
$alreadyCheckedIn = !empty($visitRow['FirstCheckedIn']); // true if they've checked in before
$now              = date('Y-m-d H:i:s');

// ── Block check-in if client is currently In-Progress at any service ─────
$ipStmt = $mysqli->prepare(
    "SELECT vs.ServiceID FROM tblVisitServices vs WHERE vs.VisitID = ? AND vs.ServiceStatus = 'In-Progress' LIMIT 1"
);
if ($ipStmt) {
    $ipStmt->bind_param('s', $visitID);
    $ipStmt->execute();
    $ipRow = $ipStmt->get_result()->fetch_assoc();
    $ipStmt->close();
    if ($ipRow) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This client is currently being served at a service station and cannot be checked in again until that service is complete.'
        ]);
        exit;
    }
}

// Update tblVisits:
//   - EnteredWaitingRoom: always updated (tracks most recent entry)
//   - FirstCheckedIn: only set if it's null (one-time, never overwritten)
if ($alreadyCheckedIn) {
    // Only update EnteredWaitingRoom
    $updateVisit = $mysqli->prepare(
        "UPDATE tblVisits SET RegistrationStatus = 'CheckedIn', EnteredWaitingRoom = ? WHERE VisitID = ?"
    );
    if (!$updateVisit) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
        exit;
    }
    $updateVisit->bind_param('ss', $now, $visitID);
} else {
    // First time — set both EnteredWaitingRoom and FirstCheckedIn
    $updateVisit = $mysqli->prepare(
        "UPDATE tblVisits SET RegistrationStatus = 'CheckedIn', EnteredWaitingRoom = ?, FirstCheckedIn = ? WHERE VisitID = ?"
    );
    if (!$updateVisit) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
        exit;
    }
    $updateVisit->bind_param('sss', $now, $now, $visitID);
}

if (!$updateVisit->execute()) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update visit: ' . $updateVisit->error]);
    $updateVisit->close();
    exit;
}
$updateVisit->close();

// Resolve category IDs to operational IDs.
// If a serviceID is a category WITH children, expand to its children.
// If it's a category with no children (e.g. optical), keep it as-is.
// If it's already operational, keep it as-is.
$resolvedServices = [];
foreach ($services as $rawID) {
    $rawID = trim($rawID);
    if (empty($rawID)) continue;

    $childStmt = $mysqli->prepare(
        "SELECT ServiceID FROM tblServices WHERE ParentServiceID = ? ORDER BY SortOrder ASC"
    );
    $childStmt->bind_param('s', $rawID);
    $childStmt->execute();
    $childRows = $childStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $childStmt->close();

    if (!empty($childRows)) {
        // Category with children — expand
        foreach ($childRows as $cr) {
            $resolvedServices[] = $cr['ServiceID'];
        }
    } else {
        // Operational service or standalone category — keep as-is
        $resolvedServices[] = $rawID;
    }
}
$resolvedServices = array_unique($resolvedServices);

// ── Load capacity data for standby detection ─────────────────
$capacityMap = []; // serviceID => { MaxCapacity, CurrentAssigned, StandbyLimit }
$capStmt = $mysqli->prepare(
    "SELECT ServiceID, MaxCapacity, CurrentAssigned, StandbyLimit FROM tblEventServices WHERE EventID = ?"
);
if ($capStmt) {
    $capStmt->bind_param('s', $eventID);
    $capStmt->execute();
    $capRows = $capStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $capStmt->close();
    foreach ($capRows as $cr) {
        $capacityMap[$cr['ServiceID']] = $cr;
    }
}

// Track which services went to standby and whether standby is full
$standbyServices = [];  // service IDs that were placed on standby
$standbyFull = [];      // service IDs where standby limit is also exceeded

// ── Service diff logic for re-check-in ───────────────────────
// When the client is already checked in, diff existing Pending/Standby services
// against the newly selected ones: remove deselected, add new ones.
// Services that are In-Progress or Complete are never touched.
if ($alreadyCheckedIn) {
    // Fetch existing visit services for this visit
    $existingStmt = $mysqli->prepare(
        "SELECT VisitServiceID, ServiceID, ServiceStatus FROM tblVisitServices WHERE VisitID = ?"
    );
    $existingStmt->bind_param('s', $visitID);
    $existingStmt->execute();
    $existingRows = $existingStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $existingStmt->close();

    // Build lookup of existing services by ID
    $existingByServiceID = [];
    foreach ($existingRows as $row) {
        $existingByServiceID[$row['ServiceID']] = $row;
    }

    $existingServiceIDs = array_keys($existingByServiceID);
    $toAdd    = array_diff($resolvedServices, $existingServiceIDs);
    $toRemove = array_diff($existingServiceIDs, $resolvedServices);

    // Remove deselected services (only Pending or Standby ones)
    $decAssigned = $mysqli->prepare(
        "UPDATE tblEventServices SET CurrentAssigned = GREATEST(CurrentAssigned - 1, 0) WHERE EventID = ? AND ServiceID = ?"
    );
    $delStmt = $mysqli->prepare("DELETE FROM tblVisitServices WHERE VisitServiceID = ?");

    foreach ($toRemove as $svcID) {
        $row = $existingByServiceID[$svcID];
        if ($row['ServiceStatus'] !== 'Pending' && $row['ServiceStatus'] !== 'Standby') continue; // don't touch In-Progress or Complete

        $delStmt->bind_param('s', $row['VisitServiceID']);
        $delStmt->execute();

        // Log removal to tblMovementLogs
        $logID = uniqid('log_', true);
        $logStmt = $mysqli->prepare(
            "INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp) VALUES (?, ?, 'ServiceRemoved', ?)"
        );
        if ($logStmt) {
            $logStmt->bind_param('sss', $logID, $row['VisitServiceID'], $now);
            $logStmt->execute();
            $logStmt->close();
        }

        if ($decAssigned) {
            $decAssigned->bind_param('ss', $eventID, $svcID);
            $decAssigned->execute();
        }
        error_log("Re-check-in: Removed service $svcID (Pending) for VisitID=$visitID");
    }
    $delStmt->close();
    if ($decAssigned) $decAssigned->close();

    // Add newly selected services
    $insertService = $mysqli->prepare(
        "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority)
         VALUES (?, ?, ?, ?, ?)"
    );
    $incrementAssigned = $mysqli->prepare(
        "UPDATE tblEventServices SET CurrentAssigned = CurrentAssigned + 1 WHERE EventID = ? AND ServiceID = ?"
    );

    foreach ($toAdd as $serviceID) {
        $serviceID = trim($serviceID);
        if (empty($serviceID)) continue;

        // Determine status: Standby if at capacity, Pending otherwise
        $svcStatus = 'Pending';
        $cap = $capacityMap[$serviceID] ?? null;
        if ($cap && (int)$cap['MaxCapacity'] > 0 && (int)$cap['CurrentAssigned'] >= (int)$cap['MaxCapacity']) {
            $svcStatus = 'Standby';
            $standbyServices[] = $serviceID;
            $standbyLimit = (int)($cap['StandbyLimit'] ?? 0);
            $standbyCount = (int)$cap['CurrentAssigned'] - (int)$cap['MaxCapacity'];
            if ($standbyLimit > 0 && $standbyCount >= $standbyLimit) {
                $standbyFull[] = $serviceID;
            }
        }

        $visitServiceID = bin2hex(random_bytes(8));
        $queuePriority  = date('Y-m-d H:i:s');

        $insertService->bind_param('sssss', $visitServiceID, $visitID, $serviceID, $svcStatus, $queuePriority);
        if (!$insertService->execute()) {
            error_log('Re-check-in: Failed to insert service ' . $serviceID . ': ' . $insertService->error);
        } else {
            // Log addition to tblMovementLogs
            $logID = uniqid('log_', true);
            $logStmt = $mysqli->prepare(
                "INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp) VALUES (?, ?, 'CheckedIn', ?)"
            );
            if ($logStmt) {
                $logStmt->bind_param('sss', $logID, $visitServiceID, $now);
                $logStmt->execute();
                $logStmt->close();
            }
            if ($incrementAssigned) {
                $incrementAssigned->bind_param('ss', $eventID, $serviceID);
                $incrementAssigned->execute();
            }
        }
        error_log("Re-check-in: Added service $serviceID for VisitID=$visitID");
    }

    $insertService->close();
    if ($incrementAssigned) $incrementAssigned->close();

} else {
    // ── First check-in: insert all services ──────────────────────
    $insertService = $mysqli->prepare(
        "INSERT INTO tblVisitServices (VisitServiceID, VisitID, ServiceID, ServiceStatus, QueuePriority)
         VALUES (?, ?, ?, ?, ?)"
    );

    if (!$insertService) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare error: ' . $mysqli->error]);
        exit;
    }

    $incrementAssigned = $mysqli->prepare(
        "UPDATE tblEventServices SET CurrentAssigned = CurrentAssigned + 1 WHERE EventID = ? AND ServiceID = ?"
    );

    foreach ($resolvedServices as $serviceID) {
        $serviceID = trim($serviceID);
        error_log('Attempting insert — VisitID: ' . $visitID . ' | ServiceID: [' . $serviceID . ']');
        if (empty($serviceID)) continue;

        // Determine status: Standby if at capacity, Pending otherwise
        $svcStatus = 'Pending';
        $cap = $capacityMap[$serviceID] ?? null;
        if ($cap && (int)$cap['MaxCapacity'] > 0 && (int)$cap['CurrentAssigned'] >= (int)$cap['MaxCapacity']) {
            $svcStatus = 'Standby';
            $standbyServices[] = $serviceID;
            $standbyLimit = (int)($cap['StandbyLimit'] ?? 0);
            $standbyCount = (int)$cap['CurrentAssigned'] - (int)$cap['MaxCapacity'];
            if ($standbyLimit > 0 && $standbyCount >= $standbyLimit) {
                $standbyFull[] = $serviceID;
            }
        }

        $visitServiceID = bin2hex(random_bytes(8));
        $queuePriority  = date('Y-m-d H:i:s');

        $insertService->bind_param('sssss', $visitServiceID, $visitID, $serviceID, $svcStatus, $queuePriority);
        if (!$insertService->execute()) {
            error_log('Failed to insert VisitService for ' . $serviceID . ': ' . $insertService->error);
        } else {
            // Log to tblMovementLogs
            $logID = uniqid('log_', true);
            $logStmt = $mysqli->prepare(
                "INSERT INTO tblMovementLogs (LogID, VisitServiceID, Action, Timestamp) VALUES (?, ?, 'CheckedIn', ?)"
            );
            if ($logStmt) {
                $logStmt->bind_param('sss', $logID, $visitServiceID, $now);
                $logStmt->execute();
                $logStmt->close();
            }
            if ($incrementAssigned) {
                $incrementAssigned->bind_param('ss', $eventID, $serviceID);
                $incrementAssigned->execute();
            }
        }
    }

    $insertService->close();
    if ($incrementAssigned) $incrementAssigned->close();
}

// ── Fast Track Logic ─────────────────────────────────────────
// If this client has dental sub-services, and the fast-track limit hasn't been reached,
// flag their dental visit-services as IsFastTracked = 1 so they go to dental first.
$isFastTracked = false;

// 1. Fetch FastTrackLimit setting for this event
$fastTrackLimit = 0;
$ftSetting = $mysqli->prepare(
    "SELECT SettingValue FROM tblEventSettings WHERE EventID = ? AND SettingKey = 'FastTrackLimit' LIMIT 1"
);
if ($ftSetting) {
    $ftSetting->bind_param('s', $eventID);
    $ftSetting->execute();
    $ftResult = $ftSetting->get_result()->fetch_assoc();
    $ftSetting->close();
    if ($ftResult) {
        $fastTrackLimit = (int)$ftResult['SettingValue'];
    }
}
error_log("[FastTrack] Limit=$fastTrackLimit | resolvedServices=" . implode(',', $resolvedServices));

if ($fastTrackLimit > 0) {
    // 2. Identify which of the resolved services are "dental" (have a dental parent category)
    $dentalServiceIDs = [];
    foreach ($resolvedServices as $svcID) {
        $parentStmt = $mysqli->prepare(
            "SELECT p.ServiceID AS ParentID, p.ServiceName AS ParentName
             FROM tblServices s
             JOIN tblServices p ON p.ServiceID = s.ParentServiceID
             WHERE s.ServiceID = ? AND p.ServiceType = 'category'"
        );
        if ($parentStmt) {
            $parentStmt->bind_param('s', $svcID);
            $parentStmt->execute();
            $parentRow = $parentStmt->get_result()->fetch_assoc();
            $parentStmt->close();
            error_log("[FastTrack] Service=$svcID | Parent=" . ($parentRow ? $parentRow['ParentName'] : 'NONE'));
            if ($parentRow && stripos($parentRow['ParentName'], 'dental') !== false) {
                $dentalServiceIDs[] = $svcID;
            }
        }
    }

    error_log("[FastTrack] dentalServiceIDs=" . implode(',', $dentalServiceIDs));

    if (!empty($dentalServiceIDs)) {
        // 3. Count how many distinct visits already have fast-tracked dental services
        $countStmt = $mysqli->prepare(
            "SELECT COUNT(DISTINCT vs.VisitID) AS FastTrackedCount
             FROM tblVisitServices vs
             JOIN tblVisits v ON v.VisitID = vs.VisitID
             WHERE v.EventID = ? AND vs.IsFastTracked = 1"
        );
        $currentFTCount = 0;
        if ($countStmt) {
            $countStmt->bind_param('s', $eventID);
            $countStmt->execute();
            $countRow = $countStmt->get_result()->fetch_assoc();
            $countStmt->close();
            $currentFTCount = (int)($countRow['FastTrackedCount'] ?? 0);
        }

        error_log("[FastTrack] currentFTCount=$currentFTCount / limit=$fastTrackLimit");

        // 4. If under the limit, flag this client's dental services
        if ($currentFTCount < $fastTrackLimit) {
            foreach ($dentalServiceIDs as $dentalSvcID) {
                $flagStmt = $mysqli->prepare(
                    "UPDATE tblVisitServices SET IsFastTracked = 1 WHERE VisitID = ? AND ServiceID = ?"
                );
                if ($flagStmt) {
                    $flagStmt->bind_param('ss', $visitID, $dentalSvcID);
                    $flagStmt->execute();
                    error_log("[FastTrack] Flagged VisitID=$visitID ServiceID=$dentalSvcID as fast-tracked");
                    $flagStmt->close();
                }
            }
            $isFastTracked = true;
        }
    }
}
error_log("[FastTrack] Final isFastTracked=" . ($isFastTracked ? 'true' : 'false'));

// Update clientsProcessed stat in tblAnalytics
$statKey = 'clientsProcessed';
$updateStat = $mysqli->prepare(
    "UPDATE tblAnalytics SET StatValue = StatValue + 1, LastUpdated = NOW()
     WHERE EventID = ? AND StatID = ?"
);
if ($updateStat) {
    $updateStat->bind_param('ss', $eventID, $statKey);
    $updateStat->execute();
    $updateStat->close();
}

// Fetch updated clientsProcessed to return to frontend
$clientsProcessed = 0;
$statFetch = $mysqli->query(
    "SELECT StatValue FROM tblAnalytics WHERE EventID = '$eventID' AND StatID = 'clientsProcessed' LIMIT 1"
);
if ($statFetch && $statRow = $statFetch->fetch_assoc()) {
    $clientsProcessed = (int)$statRow['StatValue'];
}

// Fetch all checked-in clients for this event (for registration table)
$checkedIn = [];
$checkedInQuery = $mysqli->prepare(
    "SELECT c.ClientID, c.FirstName, c.MiddleInitial, c.LastName, c.DOB, c.TranslatorNeeded,
            GROUP_CONCAT(vs.ServiceID ORDER BY vs.ServiceID SEPARATOR ', ') AS Services
     FROM tblVisits v
     JOIN tblClients c ON c.ClientID = v.ClientID
     JOIN tblVisitServices vs ON vs.VisitID = v.VisitID
     WHERE v.EventID = ? AND v.RegistrationStatus = 'CheckedIn'
     GROUP BY c.ClientID
     ORDER BY c.LastName ASC, c.FirstName ASC"
);
if ($checkedInQuery) {
    $checkedInQuery->bind_param('s', $eventID);
    $checkedInQuery->execute();
    $checkedIn = $checkedInQuery->get_result()->fetch_all(MYSQLI_ASSOC);
    $checkedInQuery->close();
}

// Build standby message if any services went to standby
$standbyMessage = '';
if (!empty($standbyServices)) {
    // Resolve service names for the standby services
    $standbyNames = [];
    foreach (array_unique($standbyServices) as $sbID) {
        $nameStmt = $mysqli->prepare("SELECT ServiceName FROM tblServices WHERE ServiceID = ? LIMIT 1");
        if ($nameStmt) {
            $nameStmt->bind_param('s', $sbID);
            $nameStmt->execute();
            $nameRow = $nameStmt->get_result()->fetch_assoc();
            $nameStmt->close();
            if ($nameRow) $standbyNames[] = $nameRow['ServiceName'];
        }
    }
    $standbyMessage = 'Client placed on STANDBY for: ' . implode(', ', $standbyNames) . '. They are still checked in and in the queue.';
    if (!empty($standbyFull)) {
        $standbyMessage .= ' Note: Standby list is full for some services.';
    }
}

// Success
http_response_code(200);
echo json_encode([
    'success'          => true,
    'message'          => 'Client checked in successfully.',
    'visitID'          => $visitID,
    'firstCheckIn'     => !$alreadyCheckedIn,
    'clientsProcessed' => $clientsProcessed,
    'checkedIn'        => $checkedIn,
    'isFastTracked'    => $isFastTracked,
    'standbyServices'  => array_values(array_unique($standbyServices)),
    'standbyFull'      => array_values(array_unique($standbyFull)),
    'standbyMessage'   => $standbyMessage
]);