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
 *  Last Modified On:  Mar 7, 2026
 *  Changes Made:      Initial creation
 * ============================================================
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

$mysqli = $GLOBALS['mysqli'];
$view = $_GET['view'] ?? 'hierarchy';

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

    echo json_encode(['success' => true, 'categories' => $categories]);
    exit;
}

if ($view === 'hierarchy') {
    // Full tree: categories with their operational children
    $stmt = $mysqli->prepare(
        "SELECT ServiceID, ServiceName, IconTag, ParentServiceID, ServiceType, SortOrder
         FROM tblServices
         ORDER BY SortOrder ASC, ServiceName ASC"
    );
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
