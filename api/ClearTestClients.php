<?php
/**
 * ============================================================
 *  File:        ClearTestClients.php
 *  Purpose:     Deletes only test clients and their dependent rows.
 *               Test clients are identified by tblClients.DateCreated
 *               strictly AFTER the configured cutoff date.
 * ============================================================
 */

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed. Use POST.']);
    exit;
}

require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

$body = [];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') !== false) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Strictly AFTER 2026-03-14 means > 2026-03-14 23:59:59.
$cutoffInput = trim((string)($body['cutoffDate'] ?? '2026-03-14'));
$cutoffDateTime = null;

if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $cutoffInput)) {
    $cutoffDateTime = $cutoffInput . ' 23:59:59';
} else {
    $parsed = strtotime($cutoffInput);
    if ($parsed !== false) {
        $cutoffDateTime = date('Y-m-d H:i:s', $parsed);
    }
}

if (!$cutoffDateTime) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid cutoffDate. Use YYYY-MM-DD or a valid datetime string.'
    ]);
    exit;
}

$countStmt = $mysqli->prepare('SELECT COUNT(*) AS cnt FROM tblClients WHERE DateCreated > ?');
if (!$countStmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to prepare count query: ' . $mysqli->error]);
    exit;
}

$countStmt->bind_param('s', $cutoffDateTime);
$countStmt->execute();
$countRow = $countStmt->get_result()->fetch_assoc();
$countStmt->close();

$targetClientCount = (int)($countRow['cnt'] ?? 0);
if ($targetClientCount === 0) {
    echo json_encode([
        'success' => true,
        'message' => 'No test clients matched the cutoff. No records were deleted.',
        'cutoffDateTime' => $cutoffDateTime,
        'deleted' => [
            'movementLogs' => 0,
            'visitServices' => 0,
            'visitServiceSelections' => 0,
            'visits' => 0,
            'clientEmergencyContacts' => 0,
            'clientAddress' => 0,
            'clientAuth' => 0,
            'clients' => 0
        ]
    ]);
    exit;
}

$deleteQueries = [
    'movementLogs' => "DELETE ml
                       FROM tblMovementLogs ml
                       INNER JOIN tblVisitServices vs ON ml.VisitServiceID = vs.VisitServiceID
                       INNER JOIN tblVisits v ON vs.VisitID = v.VisitID
                       INNER JOIN tblClients c ON v.ClientID = c.ClientID
                       WHERE c.DateCreated > ?",
    'visitServices' => "DELETE vs
                        FROM tblVisitServices vs
                        INNER JOIN tblVisits v ON vs.VisitID = v.VisitID
                        INNER JOIN tblClients c ON v.ClientID = c.ClientID
                        WHERE c.DateCreated > ?",
    'visitServiceSelections' => "DELETE vss
                                 FROM tblVisitServiceSelections vss
                                 INNER JOIN tblClients c ON vss.ClientID = c.ClientID
                                 WHERE c.DateCreated > ?",
    'visits' => "DELETE v
                 FROM tblVisits v
                 INNER JOIN tblClients c ON v.ClientID = c.ClientID
                 WHERE c.DateCreated > ?",
    'clientEmergencyContacts' => "DELETE ce
                                  FROM tblClientEmergencyContacts ce
                                  INNER JOIN tblClients c ON ce.ClientID = c.ClientID
                                  WHERE c.DateCreated > ?",
    'clientAddress' => "DELETE ca
                        FROM tblClientAddress ca
                        INNER JOIN tblClients c ON ca.ClientID = c.ClientID
                        WHERE c.DateCreated > ?",
    'clientAuth' => "DELETE au
                     FROM tblClientAuth au
                     INNER JOIN tblClients c ON au.ClientID = c.ClientID
                     WHERE c.DateCreated > ?",
    'clients' => 'DELETE FROM tblClients WHERE DateCreated > ?'
];

$deleted = [
    'movementLogs' => 0,
    'visitServices' => 0,
    'visitServiceSelections' => 0,
    'visits' => 0,
    'clientEmergencyContacts' => 0,
    'clientAddress' => 0,
    'clientAuth' => 0,
    'clients' => 0
];

$mysqli->begin_transaction();

try {
    foreach ($deleteQueries as $key => $sql) {
        $stmt = $mysqli->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare delete query for ' . $key . ': ' . $mysqli->error);
        }

        $stmt->bind_param('s', $cutoffDateTime);

        if (!$stmt->execute()) {
            $msg = $stmt->error;
            $stmt->close();
            throw new RuntimeException('Failed to delete ' . $key . ': ' . $msg);
        }

        $deleted[$key] = $stmt->affected_rows;
        $stmt->close();
    }

    $mysqli->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Test client cleanup completed.',
        'cutoffDateTime' => $cutoffDateTime,
        'targetClientCount' => $targetClientCount,
        'deleted' => $deleted
    ]);
} catch (Throwable $e) {
    $mysqli->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Cleanup failed and was rolled back.',
        'error' => $e->getMessage(),
        'cutoffDateTime' => $cutoffDateTime
    ]);
}
