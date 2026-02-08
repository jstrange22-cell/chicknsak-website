<?php
/**
 * QuickBooks Online API Proxy for ProjectWorks
 * Routes requests to QBO API server-side to handle OAuth tokens.
 * Firebase Cloud Functions require the Blaze plan, so this PHP
 * proxy runs on the same Hostinger shared hosting.
 *
 * POST /api/quickbooks-proxy.php
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

$clientId = $creds['clientId'] ?? '';
$clientSecret = $creds['clientSecret'] ?? '';
$realmId = $creds['realmId'] ?? '';
$env = ($creds['environment'] ?? 'production') === 'sandbox' ? 'sandbox' : 'production';

$baseUrl = $env === 'sandbox'
    ? "https://sandbox-quickbooks.api.intuit.com/v3/company/$realmId"
    : "https://quickbooks.api.intuit.com/v3/company/$realmId";

// For now, we use basic auth with client credentials
// In production, you'd implement proper OAuth2 token flow
$authHeader = 'Basic ' . base64_encode("$clientId:$clientSecret");

function qboRequest($url, $method = 'GET', $postData = null, $authHeader = '') {
    $ch = curl_init($url);
    $headers = [
        'Authorization: ' . $authHeader,
        'Accept: application/json',
        'Content-Type: application/json',
    ];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($postData) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postData));
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
        $errMsg = $decoded['Fault']['Error'][0]['Detail'] ?? $decoded['error'] ?? "HTTP $httpCode";
        return ['success' => false, 'error' => $errMsg];
    }
    return ['success' => true, 'data' => $decoded, 'httpCode' => $httpCode];
}

$result = ['success' => false, 'error' => 'Unknown action'];

switch ($action) {
    case 'test-connection':
        $r = qboRequest("$baseUrl/companyinfo/$realmId", 'GET', null, $authHeader);
        if ($r['success']) {
            $result = ['success' => true, 'company' => $r['data']['CompanyInfo'] ?? $r['data']];
        } else {
            $result = $r;
        }
        break;

    case 'get-customers':
        $r = qboRequest("$baseUrl/query?query=" . urlencode("SELECT * FROM Customer MAXRESULTS 100"), 'GET', null, $authHeader);
        if ($r['success']) {
            $result = ['success' => true, 'customers' => $r['data']['QueryResponse']['Customer'] ?? []];
        } else {
            $result = $r;
        }
        break;

    case 'get-invoices':
        $r = qboRequest("$baseUrl/query?query=" . urlencode("SELECT * FROM Invoice MAXRESULTS 100"), 'GET', null, $authHeader);
        if ($r['success']) {
            $result = ['success' => true, 'invoices' => $r['data']['QueryResponse']['Invoice'] ?? []];
        } else {
            $result = $r;
        }
        break;

    case 'get-payments':
        $r = qboRequest("$baseUrl/query?query=" . urlencode("SELECT * FROM Payment MAXRESULTS 100"), 'GET', null, $authHeader);
        if ($r['success']) {
            $result = ['success' => true, 'payments' => $r['data']['QueryResponse']['Payment'] ?? []];
        } else {
            $result = $r;
        }
        break;

    case 'create-invoice':
        $lineItems = $data['lineItems'] ?? [];
        $qboLines = [];
        foreach ($lineItems as $item) {
            $qboLines[] = [
                'Amount' => $item['amount'],
                'DetailType' => 'SalesItemLineDetail',
                'Description' => $item['description'] ?? '',
                'SalesItemLineDetail' => [
                    'Qty' => $item['quantity'] ?? 1,
                    'UnitPrice' => $item['unitPrice'] ?? $item['amount'],
                ],
            ];
        }
        $invoiceBody = [
            'Line' => $qboLines,
        ];
        if (!empty($data['customerRef'])) {
            $invoiceBody['CustomerRef'] = ['value' => $data['customerRef']];
        }
        if (!empty($data['dueDate'])) {
            $invoiceBody['DueDate'] = $data['dueDate'];
        }
        if (!empty($data['memo'])) {
            $invoiceBody['CustomerMemo'] = ['value' => $data['memo']];
        }
        if (!empty($data['docNumber'])) {
            $invoiceBody['DocNumber'] = $data['docNumber'];
        }
        $r = qboRequest("$baseUrl/invoice", 'POST', $invoiceBody, $authHeader);
        if ($r['success']) {
            $result = ['success' => true, 'invoice' => $r['data']['Invoice'] ?? $r['data']];
        } else {
            $result = $r;
        }
        break;

    case 'sync-payment':
        $invoiceId = $data['invoiceId'] ?? '';
        if ($invoiceId) {
            $r = qboRequest("$baseUrl/invoice/$invoiceId", 'GET', null, $authHeader);
            if ($r['success']) {
                $invoice = $r['data']['Invoice'] ?? $r['data'];
                $result = [
                    'success' => true,
                    'invoice' => $invoice,
                    'balance' => $invoice['Balance'] ?? null,
                    'totalAmt' => $invoice['TotalAmt'] ?? null,
                    'isPaid' => ($invoice['Balance'] ?? 1) == 0,
                ];
            } else {
                $result = $r;
            }
        } else {
            $result = ['success' => false, 'error' => 'Invoice ID required'];
        }
        break;
}

http_response_code(200);
header('Content-Type: application/json');
echo json_encode($result);
