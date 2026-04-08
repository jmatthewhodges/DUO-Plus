<?php
/**
 * ============================================================
 *  File:        config.php
 *  Description: Centralized configuration pulled from database.
 *               All configurable values live in tblConfig.
 *               Other files should require this instead of
 *               hardcoding values.
 *
 *  Usage:       require_once __DIR__ . '/config.php';
 *               $cfg = getConfig($GLOBALS['mysqli']);
 *               echo $cfg['pin_code'];
 *
 *  Last Modified By:  Matthew
 *  Last Modified On:  Mar 7, 2026
 *  Changes Made:      Initial creation
 * ============================================================
 */

require_once __DIR__ . '/db.php';

/**
 * Fetch all configuration values from tblConfig.
 * Returns associative array keyed by ConfigKey.
 */
function getConfig(mysqli $mysqli): array {
    $config = [];

    $stmt = $mysqli->prepare("SELECT ConfigKey, ConfigValue FROM tblConfig");
    if (!$stmt) {
        error_log("[config.php] Failed to prepare config query: " . $mysqli->error);
        return $config;
    }

    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $config[$row['ConfigKey']] = $row['ConfigValue'];
    }
    $stmt->close();

    return $config;
}

/**
 * Get a single config value by key, with optional default.
 */
function getConfigValue(mysqli $mysqli, string $key, ?string $default = null): ?string {
    $stmt = $mysqli->prepare("SELECT ConfigValue FROM tblConfig WHERE ConfigKey = ? LIMIT 1");
    if (!$stmt) {
        error_log("[config.php] Failed to prepare config query: " . $mysqli->error);
        return $default;
    }

    $stmt->bind_param('s', $key);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();

    return $row ? $row['ConfigValue'] : $default;
}

/**
 * Update or insert a config value.
 */
function setConfigValue(mysqli $mysqli, string $key, string $value): bool {
    // Check if key exists
    $stmt = $mysqli->prepare("SELECT COUNT(*) FROM tblConfig WHERE ConfigKey = ?");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();
    $stmt->close();

    if ($count > 0) {
        $update = $mysqli->prepare("UPDATE tblConfig SET ConfigValue = ?, UpdatedAt = NOW() WHERE ConfigKey = ?");
        $update->bind_param('ss', $value, $key);
        $result = $update->execute();
        $update->close();
        return $result;
    } else {
        $id = bin2hex(random_bytes(8));
        $insert = $mysqli->prepare("INSERT INTO tblConfig (ConfigID, ConfigKey, ConfigValue, UpdatedAt) VALUES (?, ?, ?, NOW())");
        $insert->bind_param('sss', $id, $key, $value);
        $result = $insert->execute();
        $insert->close();
        return $result;
    }
}
