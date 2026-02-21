<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_POST = json_decode(file_get_contents('php://input'), true) ?? [];
}

header('Content-Type: application/json');
$mysqli = $GLOBALS['mysqli'];

date_default_timezone_set('America/Chicago');
$now = date('Y-m-d H:i:s');
