<?php
/**
 * Client Login API Endpoint (Placeholder)
 * Currently returns "coming soon" message
 * Will be fully implemented later
 */

// Set content type to JSON
header('Content-Type: application/json');

// Return coming soon message
http_response_code(200);
echo json_encode([
    'success' => false,
    'message' => 'Client login is coming soon! We\'re working on getting this set up for you.'
]);
exit;
?>
