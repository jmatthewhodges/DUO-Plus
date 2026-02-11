<?php

// Database connection from other file
require_once __DIR__ . '/db.php';

// Get header type, set POST request type for JSON data
if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
    $_GET = json_decode(file_get_contents('php://input'), true) ?? [];
}

// Get set mysql connection
$mysqli = $GLOBALS['mysqli'];

// tldr: join from clientid to clients, then send to javascript 

echo "somthing";