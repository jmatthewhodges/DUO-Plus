<?php
/**
 * ============================================================
 * File:            CheckEmail.php
 * Description:     Check whether an email is already registered.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:20 PM
 * Changes Made:      Standardized readability structure and comments.
 * ============================================================
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['exists' => false]);
    exit;
}

$email = trim($_GET['email'] ?? '');

if (empty($email)) {
    echo json_encode(['exists' => false]);
    exit;
}

require_once __DIR__ . '/db.php';
$mysqli = $GLOBALS['mysqli'];

$stmt = $mysqli->prepare("SELECT 1 FROM tblClientAuth WHERE Email = ? LIMIT 1");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['exists' => false]);
    exit;
}

$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();

echo json_encode(['exists' => $stmt->num_rows > 0]);
$stmt->close();
