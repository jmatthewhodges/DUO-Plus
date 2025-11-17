<?php
/**
 * Volunteer Dashboard
 * Protected page - requires authentication
 */

// CRITICAL: Authentication check MUST be first, before any output
require_once __DIR__ . '/../api/auth-check.php';

// Get user information from session
$userName = $_SESSION['user_name'] ?? 'Volunteer';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Volunteer Dashboard - DUO Plus</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .dashboard-container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 30px;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        
        .welcome {
            color: #666;
            margin-bottom: 30px;
        }
        
        .qr-button {
            width: 100%;
            padding: 15px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            text-decoration: none;
            display: block;
            text-align: center;
        }
        
        .qr-button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <h1>Volunteer Dashboard</h1>
        <p class="welcome">Welcome, <?php echo htmlspecialchars($userName); ?>!</p>
        
        <a href="qrcode.php" class="qr-button">Scan QR Code</a>
    </div>
</body>
</html>
