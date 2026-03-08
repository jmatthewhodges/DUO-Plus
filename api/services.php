<?php
/**
 * ============================================================
 *  File:        services.php
 *  Description: Public API for service hierarchy. No PIN required.
 *               Returns categories (for registration) and the
 *               full parent→child tree (for service stations).
 *
 *  GET ?view=categories   → categories only (registration form)
 *  GET ?view=hierarchy    → categories with children (stations)
 *  GET ?view=all          → flat list with all columns
 *  GET (no param)         → defaults to hierarchy
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Mar 8, 2026
 *  Changes Made:      Added IsClosed from tblEventServices
 * ============================================================
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];
$view = $_GET['view'] ?? 'hierarchy';

// Get active event ID for IsClosed status
$activeEventID = null;
$evtStmt = $mysqli->prepare("SELECT EventID FROM tblEvents WHERE IsActive = 1 LIMIT 1");
if ($evtStmt) {
    $evtStmt->execute();
    $evtRow = $evtStmt->get_result()->fetch_assoc();
    $evtStmt->close();
    if ($evtRow) $activeEventID = $evtRow['EventID'];
}

if ($view === 'categories') {
    // Registration form: only top-level categories
    $stmt = $mysqli->prepare(
        "SELECT ServiceID, ServiceName, IconTag, SortOrder
         FROM tblServices
         WHERE ServiceType = 'category' AND ParentServiceID IS NULL
         ORDER BY SortOrder ASC, ServiceName ASC"
    );
    $stmt->execute();
    $categories = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // If we have an active event, check if ALL children of a category are closed
    // If so, mark the category as closed so registration can hide it
    if ($activeEventID) {
        foreach ($categories as &$cat) {
            // Check children
            $childStmt = $mysqli->prepare(
                "SELECT s.ServiceID, COALESCE(es.IsClosed, 0) AS IsClosed
                 FROM tblServices s
                 LEFT JOIN tblEventServices es ON es.ServiceID = s.ServiceID AND es.EventID = ?
                 WHERE s.ParentServiceID = ?"
            );
            $childStmt->bind_param('ss', $activeEventID, $cat['ServiceID']);
            $childStmt->execute();
            $childRows = $childStmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $childStmt->close();

            if (!empty($childRows)) {
                // Category has children — closed if ALL are closed
                $allClosed = true;
                foreach ($childRows as $cr) {
                    if (!(int)$cr['IsClosed']) { $allClosed = false; break; }
                }
                $cat['IsClosed'] = $allClosed;
            } else {
                // Standalone category — check its own IsClosed
                $selfStmt = $mysqli->prepare(
                    "SELECT COALESCE(es.IsClosed, 0) AS IsClosed
                     FROM tblEventServices es
                     WHERE es.ServiceID = ? AND es.EventID = ?"
                );
                $selfStmt->bind_param('ss', $cat['ServiceID'], $activeEventID);
                $selfStmt->execute();
                $selfRow = $selfStmt->get_result()->fetch_assoc();
                $selfStmt->close();
                $cat['IsClosed'] = $selfRow ? (bool)(int)$selfRow['IsClosed'] : false;
            }
        }
        unset($cat);
    }

    echo json_encode(['success' => true, 'categories' => $categories]);
    exit;
}

if ($view === 'hierarchy') {
    // Full tree: categories with their operational children + IsClosed status
    $stmt = $mysqli->prepare(
        "SELECT s.ServiceID, s.ServiceName, s.IconTag, s.ParentServiceID, s.ServiceType, s.SortOrder,
                COALESCE(es.IsClosed, 0) AS IsClosed
         FROM tblServices s
         LEFT JOIN tblEventServices es ON es.ServiceID = s.ServiceID AND es.EventID = ?
         ORDER BY s.SortOrder ASC, s.ServiceName ASC"
    );
    $stmt->bind_param('s', $activeEventID);
    $stmt->execute();
    $all = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Build tree
    $categories = [];
    $children = [];

    foreach ($all as $svc) {
        if ($svc['ServiceType'] === 'category' && $svc['ParentServiceID'] === null) {
            $categories[$svc['ServiceID']] = [
                'ServiceID'   => $svc['ServiceID'],
                'ServiceName' => $svc['ServiceName'],
                'IconTag'     => $svc['IconTag'],
                'SortOrder'   => (int)$svc['SortOrder'],
                'children'    => [],
            ];
        } else if ($svc['ParentServiceID'] !== null) {
            $children[] = $svc;
        }
    }

    foreach ($children as $child) {
        $pid = $child['ParentServiceID'];
        if (isset($categories[$pid])) {
            $categories[$pid]['children'][] = [
                'ServiceID'   => $child['ServiceID'],
                'ServiceName' => $child['ServiceName'],
                'IconTag'     => $child['IconTag'],
                'SortOrder'   => (int)$child['SortOrder'],
                'IsClosed'    => (bool)(int)$child['IsClosed'],
            ];
        }
    }

    echo json_encode(['success' => true, 'hierarchy' => array_values($categories)]);
    exit;
}

// view=all — flat list
$stmt = $mysqli->prepare(
    "SELECT ServiceID, ServiceName, IconTag, ParentServiceID, ServiceType, SortOrder
     FROM tblServices
     ORDER BY SortOrder ASC, ServiceName ASC"
);
$stmt->execute();
$all = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

echo json_encode(['success' => true, 'services' => $all]);
