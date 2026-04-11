<?php
/**
 * ============================================================
 *  File:        chiropractor-stats.php
 *  Purpose:     Backend of chiropractor.html, handles loading and saving counters
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  April 8, 2026
 *  Changes Made:      Created file from food truck flow for chiropractor tracking.
 * ============================================================
 */

require_once __DIR__ . '/pin-required.php';
require_once __DIR__ . '/db.php';

// Parse JSON body for POST requests
if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' &&
    isset($_SERVER['CONTENT_TYPE']) &&
    str_contains($_SERVER['CONTENT_TYPE'], 'application/json')
) {
    $jsonData = json_decode(file_get_contents('php://input'), true) ?? [];
    $_POST = array_merge($_POST, $jsonData);
}

header('Content-Type: application/json');
date_default_timezone_set('America/Chicago');

$mysqli = $GLOBALS['mysqli'];

// Map JS counters to separate chiropractor stat keys in tblAnalytics
$statConfig = [
    'chiropractorClientsServed' => [
        'statKey' => 'chiropractorClientsServed'
    ],
    'chiropractorVolunteersServed' => [
        'statKey' => 'chiropractorVolunteersServed'
    ]
];

// Always resolve the active event server-side
function grabEventID(mysqli $mysqli): ?string
{
    $activeEventCheck = $mysqli->prepare(
        'SELECT EventID
         FROM tblEvents
         WHERE IsActive = 1
         ORDER BY EventDate DESC
         LIMIT 1'
    );

    if (!$activeEventCheck) {
        return null;
    }

    $activeEventCheck->execute();
    $result = $activeEventCheck->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $activeEventCheck->close();

    return $row['EventID'] ?? null;
}

function saveStat(
    mysqli $mysqli,
    string $eventID,
    string $statKey,
    int $value
): bool {
    $lastUpdated = date('Y-m-d H:i:s');

    $updateStat = $mysqli->prepare(
        'UPDATE tblAnalytics
         SET StatValue = ?,
             LastUpdated = ?
         WHERE EventID = ? AND StatKey = ?'
    );

    if (!$updateStat) {
        return false;
    }

    $updateStat->bind_param('isss', $value, $lastUpdated, $eventID, $statKey);
    $collectSuccess = $updateStat->execute();
    $updatedRows = $updateStat->affected_rows;
    $updateStat->close();

    if (!$collectSuccess) {
        return false;
    }

    if ($updatedRows > 0) {
        return true;
    }

    // 0 affected rows can mean "no matching row" OR "row already had same values".
    // Check existence explicitly before deciding to insert.
    $existingStat = $mysqli->prepare(
        'SELECT StatID
         FROM tblAnalytics
         WHERE EventID = ? AND StatKey = ?
         LIMIT 1'
    );

    if (!$existingStat) {
        return false;
    }

    $existingStat->bind_param('ss', $eventID, $statKey);
    $existingStat->execute();
    $existingRow = $existingStat->get_result()->fetch_assoc();
    $existingStat->close();

    if ($existingRow) {
        return true;
    }

    $statID = bin2hex(random_bytes(8));
    $insertStat = $mysqli->prepare(
        'INSERT INTO tblAnalytics
         (StatID, EventID, StatKey, StatValue, LastUpdated)
            VALUES (?, ?, ?, ?, ?)'
    );

    if (!$insertStat) {
        return false;
    }

    $insertStat->bind_param('sssis', $statID, $eventID, $statKey, $value, $lastUpdated);
    $insertSuccess = $insertStat->execute();
    $insertStat->close();

    return $insertSuccess;
}

$eventID = grabEventID($mysqli);
if (!$eventID) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No active event found.'
    ]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $stats = [
        'chiropractorClientsServed' => 0,
        'chiropractorVolunteersServed' => 0
    ];

    $readStats = $mysqli->prepare(
        'SELECT StatKey, StatValue
         FROM tblAnalytics
         WHERE EventID = ?
         AND StatKey IN (?, ?)'
    );

    if (!$readStats) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare stats query.']);
        exit;
    }

    $clientKey = $statConfig['chiropractorClientsServed']['statKey'];
    $volKey = $statConfig['chiropractorVolunteersServed']['statKey'];

    $readStats->bind_param('sss', $eventID, $clientKey, $volKey);
    $readStats->execute();
    $result = $readStats->get_result();

    while ($row = $result->fetch_assoc()) {
        $key = $row['StatKey'];
        if ($key === $clientKey) {
            $stats['chiropractorClientsServed'] = (int)$row['StatValue'];
        }
        if ($key === $volKey) {
            $stats['chiropractorVolunteersServed'] = (int)$row['StatValue'];
        }
    }
    $readStats->close();

    echo json_encode([
        'success' => true,
        'eventID' => $eventID,
        'stats' => $stats,
        'lastRefreshed' => date('Y-m-d H:i:s')
    ]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $counterName = $_POST['counterName'] ?? '';
    $valuePost = $_POST['value'] ?? null;

    if (!isset($statConfig[$counterName])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Counter not recognized.']);
        exit;
    }

    if (!is_numeric($valuePost)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Value must be numeric.']);
        exit;
    }

    $value = max(0, (int)$valuePost);

    $statInfo = $statConfig[$counterName];
    $collectSuccess = saveStat(
        $mysqli,
        $eventID,
        $statInfo['statKey'],
        $value
    );

    if (!$collectSuccess) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save stat counter.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'eventID' => $eventID,
        'counterName' => $counterName,
        'value' => $value,
        'message' => 'Counter saved.'
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
