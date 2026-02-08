<?php
/**
 * Google Drive API Proxy for ProjectWorks
 * Routes requests to Google Drive API server-side.
 *
 * POST /api/googledrive-proxy.php
 * Body: { "action": "...", "credentials": {...}, "data": {...} }
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!$body || !isset($body['action']) || !isset($body['credentials'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Missing action or credentials']);
    exit;
}

$action = $body['action'];
$creds = $body['credentials'];
$data = $body['data'] ?? [];

$accessToken = $creds['accessToken'] ?? $creds['clientId'] ?? '';

function driveRequest($url, $method = 'GET', $postData = null, $token = '', $contentType = 'application/json') {
    $ch = curl_init($url);
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ];
    if ($contentType) {
        $headers[] = 'Content-Type: ' . $contentType;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($postData) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($postData) ? $postData : json_encode($postData));
        }
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['success' => false, 'error' => 'Request failed: ' . $error];
    }
    $decoded = json_decode($response, true);
    if ($httpCode >= 400) {
        $errMsg = $decoded['error']['message'] ?? $decoded['error'] ?? "HTTP $httpCode";
        return ['success' => false, 'error' => $errMsg];
    }
    return ['success' => true, 'data' => $decoded, 'httpCode' => $httpCode];
}

$result = ['success' => false, 'error' => 'Unknown action'];

switch ($action) {
    case 'test-connection':
        $r = driveRequest('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', 'GET', null, $accessToken);
        if ($r['success']) {
            $result = ['success' => true, 'user' => $r['data']['user'] ?? null];
        } else {
            $result = $r;
        }
        break;

    case 'list-files':
        $folderId = $data['folderId'] ?? 'root';
        $q = urlencode("'$folderId' in parents and trashed = false");
        $r = driveRequest("https://www.googleapis.com/drive/v3/files?q=$q&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)&pageSize=100", 'GET', null, $accessToken);
        if ($r['success']) {
            $result = ['success' => true, 'data' => ['files' => $r['data']['files'] ?? []]];
        } else {
            $result = $r;
        }
        break;

    case 'create-folder':
        $folderName = $data['name'] ?? 'ProjectWorks';
        $parentId = $data['parentId'] ?? null;
        $metadata = [
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
        ];
        if ($parentId) {
            $metadata['parents'] = [$parentId];
        }
        $r = driveRequest('https://www.googleapis.com/drive/v3/files', 'POST', $metadata, $accessToken);
        if ($r['success']) {
            $result = ['success' => true, 'folder' => $r['data']];
        } else {
            $result = $r;
        }
        break;

    case 'get-or-create-project-folder':
        $projectName = $data['projectName'] ?? 'Project';
        $rootId = $creds['rootFolderId'] ?? 'root';

        // Search for existing folder
        $searchQ = urlencode("name = '$projectName' and '$rootId' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
        $r = driveRequest("https://www.googleapis.com/drive/v3/files?q=$searchQ&fields=files(id,name)", 'GET', null, $accessToken);

        if ($r['success'] && !empty($r['data']['files'])) {
            $result = ['success' => true, 'folder' => $r['data']['files'][0], 'created' => false];
        } else {
            // Create new folder
            $metadata = [
                'name' => $projectName,
                'mimeType' => 'application/vnd.google-apps.folder',
                'parents' => [$rootId],
            ];
            $cr = driveRequest('https://www.googleapis.com/drive/v3/files', 'POST', $metadata, $accessToken);
            if ($cr['success']) {
                $result = ['success' => true, 'folder' => $cr['data'], 'created' => true];
            } else {
                $result = $cr;
            }
        }
        break;

    case 'upload-photo':
        $photoUrl = $data['photoUrl'] ?? '';
        $fileName = $data['fileName'] ?? 'photo.jpg';
        $folderId = $data['folderId'] ?? null;
        $description = $data['description'] ?? '';

        if (!$photoUrl) {
            $result = ['success' => false, 'error' => 'No photo URL provided'];
            break;
        }

        // Download the photo from the URL
        $imageData = file_get_contents($photoUrl);
        if ($imageData === false) {
            $result = ['success' => false, 'error' => 'Failed to download photo from URL'];
            break;
        }

        // Multipart upload to Drive
        $boundary = 'ProjectWorks' . time();
        $metadata = ['name' => $fileName];
        if ($folderId) $metadata['parents'] = [$folderId];
        if ($description) $metadata['description'] = $description;

        $multipartBody = "--$boundary\r\n"
            . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            . json_encode($metadata) . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: image/jpeg\r\n\r\n"
            . $imageData . "\r\n"
            . "--$boundary--";

        $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $multipartBody,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: multipart/related; boundary=' . $boundary,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 400 && $response) {
            $fileData = json_decode($response, true);
            $result = ['success' => true, 'file' => $fileData];
        } else {
            $err = json_decode($response, true);
            $result = ['success' => false, 'error' => $err['error']['message'] ?? "Upload failed (HTTP $httpCode)"];
        }
        break;
}

http_response_code(200);
header('Content-Type: application/json');
echo json_encode($result);
