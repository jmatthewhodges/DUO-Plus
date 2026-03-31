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

    // Mark categories as closed when appropriate.
    // Single query replaces the previous N+1 loop (one query per category).
    if ($activeEventID) {
        $catIDs = array_column($categories, 'ServiceID');
        $catPlaceholders = implode(',', array_fill(0, count($catIDs), '?'));
        $catTypes = str_repeat('s', count($catIDs));

        // Fetch IsClosed for every child and standalone service in one shot
        $closedStmt = $mysqli->prepare(
            "SELECT s.ServiceID, s.ParentServiceID, COALESCE(es.IsClosed, 0) AS IsClosed
             FROM tblServices s
             LEFT JOIN tblEventServices es ON es.ServiceID = s.ServiceID AND es.EventID = ?
             WHERE s.ParentServiceID IN ($catPlaceholders)
                OR (s.ServiceID IN ($catPlaceholders) AND s.ServiceType = 'category')"
        );
        // bind: eventID, child parent IDs, standalone category IDs
        $closedStmt->bind_param('s' . $catTypes . $catTypes, $activeEventID, ...$catIDs, ...$catIDs);
        $closedStmt->execute();
        $closedRows = $closedStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $closedStmt->close();

        // Group results: parentID → [childIsClosed, ...] ; standalone → isClosed
        $childClosedMap = []; // parentServiceID => [isClosed, ...]
        $selfClosedMap  = []; // serviceID => isClosed (standalone categories)
        foreach ($closedRows as $cr) {
            if ($cr['ParentServiceID'] !== null) {
                $childClosedMap[$cr['ParentServiceID']][] = (int)$cr['IsClosed'];
            } else {
                $selfClosedMap[$cr['ServiceID']] = (int)$cr['IsClosed'];
            }
        }

        foreach ($categories as &$cat) {
            $sid = $cat['ServiceID'];
            if (isset($childClosedMap[$sid])) {
                // Has children — closed only if ALL children are closed
                $cat['IsClosed'] = !in_array(0, $childClosedMap[$sid]);
            } else {
                $cat['IsClosed'] = (bool)($selfClosedMap[$sid] ?? false);
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
