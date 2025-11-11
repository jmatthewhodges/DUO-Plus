<?php
/**
 * QR Code Scanning Page
 * Protected page - requires authentication
 */

// Check if user is logged in
require_once __DIR__ . '/../api/auth-check.php';

// Get user information from session
$userName = $_SESSION['user_name'] ?? 'Volunteer';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code Scanner - DUO Plus</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 30px;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        
        .placeholder {
            text-align: center;
            padding: 40px 20px;
            color: #666;
            background-color: #f9f9f9;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        .back-link {
            margin-top: 20px;
            text-align: center;
        }
        
        .back-link a {
            color: #007bff;
            text-decoration: none;
        }
        
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>QR Code Scanner</h1>
        
        <div class="placeholder">
            <p><strong>QR Scanner</strong></p>
            <p>QR code scanning functionality will be implemented here.</p>
        </div>
        
        <div class="back-link">
            <a href="volunteer-dashboard.php">← Back to Dashboard</a>
        </div>
    </div>
</body>
</html>

