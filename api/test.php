<?php

// Database connection from other file
require_once DIR . '/db.php';

header('Content-Type: application/json');
$mysqli = $GLOBALS['mysqli'];

// Get variables from the request (POST example)
$name = $_POST['name'] ?? null;
$money = $_POST['money'] ?? null;

// Prepare the SQL statement with placeholders
$stmt = $mysqli->prepare("INSERT INTO tester(name, money) VALUES (?, ?)");

// Bind the variables to the placeholders
// "s" means string, "d" means double (float or number)
$stmt->bind_param("sd", $name, $money);

// Execute the statement
$result = $stmt->execute();

if ($result) {
    http_response_code(201); // Created
    echo json_encode(['success' => true, 'message' => 'Insert successful']);
} else {
    http_response_code(400); // Bad Request
    echo json_encode(['success' => false, 'message' => 'Insert failed']);
}