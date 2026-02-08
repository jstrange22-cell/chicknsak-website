<?php
/**
 * Photo Upload Endpoint for ProjectWorks
 * Handles photo uploads to Hostinger server since Firebase Storage
 * requires the Blaze (paid) plan.
 *
 * Accepts: POST with multipart/form-data (field name: "photo")
 * Returns: JSON with { url, thumbnailUrl, storagePath, thumbnailPath }
 */

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Configuration
$uploadBaseDir = __DIR__ . '/../uploads/photos';
$thumbBaseDir = __DIR__ . '/../uploads/thumbs';
$maxFileSize = 15 * 1024 * 1024; // 15MB

// Get metadata from POST
$companyId = $_POST['companyId'] ?? 'default';
$projectId = $_POST['projectId'] ?? 'default';

// Sanitize directory names
$companyId = preg_replace('/[^a-zA-Z0-9_-]/', '', $companyId);
$projectId = preg_replace('/[^a-zA-Z0-9_-]/', '', $projectId);

// Create directories
$photoDir = "$uploadBaseDir/$companyId/$projectId";
$thumbDir = "$thumbBaseDir/$companyId/$projectId";

if (!is_dir($photoDir)) {
    mkdir($photoDir, 0755, true);
}
if (!is_dir($thumbDir)) {
    mkdir($thumbDir, 0755, true);
}

// Check for file upload
if (!isset($_FILES['photo']) && !isset($_POST['photoBase64'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No photo provided. Send as "photo" file field or "photoBase64" POST field.']);
    exit;
}

$filename = 'photo_' . time() . '_' . bin2hex(random_bytes(4)) . '.jpg';
$thumbFilename = 'thumb_' . $filename;
$photoPath = "$photoDir/$filename";
$thumbPath = "$thumbDir/$thumbFilename";

// Handle file upload vs base64
if (isset($_FILES['photo'])) {
    $file = $_FILES['photo'];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds server limit',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds form limit',
            UPLOAD_ERR_PARTIAL => 'File only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temp folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
            UPLOAD_ERR_EXTENSION => 'Upload blocked by extension',
        ];
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => $errorMessages[$file['error']] ?? 'Upload failed']);
        exit;
    }
    
    if ($file['size'] > $maxFileSize) {
        http_response_code(413);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File too large. Maximum is 15MB.']);
        exit;
    }
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $photoPath)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Failed to save file']);
        exit;
    }
} elseif (isset($_POST['photoBase64'])) {
    // Handle base64 upload
    $base64 = $_POST['photoBase64'];
    // Remove data URI prefix if present
    if (strpos($base64, ',') !== false) {
        $base64 = explode(',', $base64, 2)[1];
    }
    $decoded = base64_decode($base64);
    if ($decoded === false || strlen($decoded) < 100) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid base64 data']);
        exit;
    }
    if (strlen($decoded) > $maxFileSize) {
        http_response_code(413);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File too large. Maximum is 15MB.']);
        exit;
    }
    file_put_contents($photoPath, $decoded);
}

// Handle thumbnail
if (isset($_FILES['thumbnail'])) {
    move_uploaded_file($_FILES['thumbnail']['tmp_name'], $thumbPath);
} elseif (isset($_POST['thumbnailBase64'])) {
    $thumbBase64 = $_POST['thumbnailBase64'];
    if (strpos($thumbBase64, ',') !== false) {
        $thumbBase64 = explode(',', $thumbBase64, 2)[1];
    }
    $decoded = base64_decode($thumbBase64);
    if ($decoded !== false) {
        file_put_contents($thumbPath, $decoded);
    }
} else {
    // Generate thumbnail using GD if available
    if (function_exists('imagecreatefromjpeg') && file_exists($photoPath)) {
        $src = @imagecreatefromjpeg($photoPath);
        if (!$src) {
            $src = @imagecreatefromstring(file_get_contents($photoPath));
        }
        if ($src) {
            $origW = imagesx($src);
            $origH = imagesy($src);
            $thumbW = 400;
            $thumbH = (int)($origH * ($thumbW / $origW));
            $thumb = imagecreatetruecolor($thumbW, $thumbH);
            imagecopyresampled($thumb, $src, 0, 0, 0, 0, $thumbW, $thumbH, $origW, $origH);
            imagejpeg($thumb, $thumbPath, 60);
            imagedestroy($src);
            imagedestroy($thumb);
        } else {
            // If we can't create thumbnail, just copy the original
            copy($photoPath, $thumbPath);
        }
    } else {
        // No GD available, copy original as thumbnail
        copy($photoPath, $thumbPath);
    }
}

// Build public URLs
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$basePath = dirname(dirname($_SERVER['SCRIPT_NAME']));
if ($basePath === '/' || $basePath === '\\') $basePath = '';

$photoUrl = "$protocol://$host$basePath/uploads/photos/$companyId/$projectId/$filename";
$thumbUrl = "$protocol://$host$basePath/uploads/thumbs/$companyId/$projectId/$thumbFilename";
$storagePath = "uploads/photos/$companyId/$projectId/$filename";
$thumbnailStoragePath = "uploads/thumbs/$companyId/$projectId/$thumbFilename";

http_response_code(200);
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'url' => $photoUrl,
    'originalUrl' => $photoUrl,
    'thumbnailUrl' => $thumbUrl,
    'storagePath' => $storagePath,
    'thumbnailPath' => $thumbnailStoragePath,
    'filename' => $filename,
    'size' => filesize($photoPath),
]);
