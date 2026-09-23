/**
 * Portfolio Collaboration & Application Backend Server
 * Handles static asset serving, inquiry processing, Excel (.csv) ledger generation,
 * and Microsoft Word (.doc) candidate profile dossiers.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DOSSIERS_DIR = path.join(DATA_DIR, 'dossiers');
const CSV_FILE = path.join(DATA_DIR, 'inquiries.csv');
const JSON_FILE = path.join(DATA_DIR, 'inquiries.json');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DOSSIERS_DIR)) fs.mkdirSync(DOSSIERS_DIR, { recursive: true });

// Ensure inquiries.json exists
if (!fs.existsSync(JSON_FILE)) {
  fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Ensure CSV file exists with UTF-8 BOM for Microsoft Excel auto-detection
if (!fs.existsSync(CSV_FILE)) {
  const csvHeader = '\uFEFF"Inquiry ID","Submission Date","Full Name","Email Address","Phone / WhatsApp","Engagement Type","Portfolio / Profile","Budget / Rate","Message / Proposal"\r\n';
  fs.writeFileSync(CSV_FILE, csvHeader, 'utf8');
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword; charset=utf-8',
};

// Helper: Escape CSV fields safely
function escapeCsv(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

// Helper: Generate a beautifully formatted Word (.doc) candidate profile
function generateWordDoc(inquiry) {
  const safeName = (inquiry.name || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Candidate_${inquiry.id}_${safeName}.doc`;
  const filePath = path.join(DOSSIERS_DIR, filename);

  const htmlDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Candidate Dossier - ${inquiry.name}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Segoe UI', Calibri, Arial, sans-serif;
      margin: 40px;
      color: #1a202c;
      background: #ffffff;
      line-height: 1.6;
    }
    .header-box {
      border-bottom: 3px solid #00b4d8;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .brand {
      color: #0077b6;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    h1 {
      margin: 6px 0;
      font-size: 26px;
      color: #0f172a;
    }
    .meta-tag {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      margin-top: 4px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .details-table th, .details-table td {
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      font-size: 14px;
      text-align: left;
    }
    .details-table th {
      background: #f8fafc;
      width: 25%;
      color: #475569;
    }
    .details-table td {
      color: #0f172a;
      font-weight: 500;
    }
    .message-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #00b4d8;
      padding: 18px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      font-size: 11px;
      color: #94a3b8;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="brand">NEXUS LABS &bull; EXECUTIVE CANDIDATE DOSSIER</div>
    <h1>${inquiry.name}</h1>
    <span class="meta-tag">${inquiry.role || 'General Collaboration'}</span>
    <span style="font-size: 12px; color: #64748b; margin-left: 14px;">ID: ${inquiry.id} &bull; Received: ${inquiry.timestamp}</span>
  </div>

  <table class="details-table">
    <tr>
      <th>Email Address</th>
      <td><a href="mailto:${inquiry.email}">${inquiry.email}</a></td>
    </tr>
    <tr>
      <th>Phone / WhatsApp</th>
      <td>${inquiry.phone || 'Not provided'}</td>
    </tr>
    <tr>
      <th>Engagement Scope</th>
      <td>${inquiry.role || 'Not specified'}</td>
    </tr>
    <tr>
      <th>Portfolio / Profile</th>
      <td>${inquiry.portfolio ? `<a href="${inquiry.portfolio}">${inquiry.portfolio}</a>` : 'Not provided'}</td>
    </tr>
    <tr>
      <th>Target Timeline & Budget</th>
      <td>${inquiry.budget || 'Flexible / Negotiable'}</td>
    </tr>
  </table>

  <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">Message & Architectural Proposal</h3>
  <div class="message-box">${inquiry.message || 'No additional notes provided.'}</div>

  <div class="footer">
    Compiled automatically by Portfolio Inquiries Gateway &bull; Alex Carter Engineering &bull; ${new Date().toUTCString()}
  </div>
</body>
</html>`;

  fs.writeFileSync(filePath, htmlDoc, 'utf8');
  return filename;
}

// Server Request Handler
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API ROUTE: POST /api/inquiries ---
  if (pathname === '/api/inquiries' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || !data.email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Name and Email are required fields.' }));
          return;
        }

        const now = new Date();
        const timestamp = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' (PST)';
        const inquiryId = 'INQ-' + Date.now().toString(36).toUpperCase();

        const inquiry = {
          id: inquiryId,
          timestamp: timestamp,
          isoDate: now.toISOString(),
          name: data.name.trim(),
          email: data.email.trim(),
          phone: (data.phone || '').trim(),
          role: data.role || 'Full-Time Role',
          portfolio: (data.portfolio || '').trim(),
          budget: (data.budget || '').trim(),
          message: (data.message || '').trim(),
        };

        // 1. Generate Word Document Dossier
        const docFile = generateWordDoc(inquiry);
        inquiry.dossierFile = docFile;

        // 2. Append to inquiries.json
        const rawJson = fs.readFileSync(JSON_FILE, 'utf8');
        const list = JSON.parse(rawJson || '[]');
        list.unshift(inquiry); // newest first
        fs.writeFileSync(JSON_FILE, JSON.stringify(list, null, 2), 'utf8');

        // 3. Append to Excel inquiries.csv
        const csvLine = [
          escapeCsv(inquiry.id),
          escapeCsv(inquiry.timestamp),
          escapeCsv(inquiry.name),
          escapeCsv(inquiry.email),
          escapeCsv(inquiry.phone),
          escapeCsv(inquiry.role),
          escapeCsv(inquiry.portfolio),
          escapeCsv(inquiry.budget),
          escapeCsv(inquiry.message)
        ].join(',') + '\r\n';

        fs.appendFileSync(CSV_FILE, csvLine, 'utf8');

        // Respond with success
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          id: inquiryId,
          message: 'Information received and dossiers compiled successfully.',
          totalInquiries: list.length,
          docFile: docFile
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Failed to process inquiry payload.' }));
      }
    });
    return;
  }

  // --- API ROUTE: GET /api/inquiries ---
  if (pathname === '/api/inquiries' && req.method === 'GET') {
    try {
      const rawJson = fs.readFileSync(JSON_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(rawJson);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read inquiries.' }));
    }
    return;
  }

  // --- API ROUTE: GET /api/export/csv ---
  if (pathname === '/api/export/csv' && req.method === 'GET') {
    if (fs.existsSync(CSV_FILE)) {
      const stat = fs.statSync(CSV_FILE);
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Candidate_Inquiries_Master.csv"',
        'Content-Length': stat.size
      });
      fs.createReadStream(CSV_FILE).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No CSV data available yet.');
    }
    return;
  }

  // --- API ROUTE: GET /api/export/doc/:id ---
  if (pathname.startsWith('/api/export/doc/') && req.method === 'GET') {
    const id = pathname.replace('/api/export/doc/', '').trim();
    const rawJson = fs.readFileSync(JSON_FILE, 'utf8');
    const list = JSON.parse(rawJson || '[]');
    const item = list.find(i => i.id === id);

    if (item && item.dossierFile) {
      const docPath = path.join(DOSSIERS_DIR, item.dossierFile);
      if (fs.existsSync(docPath)) {
        const stat = fs.statSync(docPath);
        res.writeHead(200, {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="${item.dossierFile}"`,
          'Content-Length': stat.size
        });
        fs.createReadStream(docPath).pipe(res);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Dossier document not found.');
    return;
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  // Security check: ensure path is within current working directory
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(normalizedPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[Backend Server] Portfolio & Inquiries Gateway running at http://localhost:${PORT}`);
});
