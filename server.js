const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const inquiryStorage = require('./storage/inquiry-storage');
const { initializeDatabase, closeDatabase } = require('./db/database');

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitStore = new Map();
const rateLimitCleanup = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, timestamps] of rateLimitStore) {
    const current = timestamps.filter(timestamp => timestamp > cutoff);
    if (current.length) rateLimitStore.set(key, current);
    else rateLimitStore.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);
rateLimitCleanup.unref();

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

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(body);
}

function getClientKey(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function isRateLimited(req) {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(getClientKey(req)) || []).filter(timestamp => timestamp > now - RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  rateLimitStore.set(getClientKey(req), timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionCookie(username) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ username, issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `admin_session=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`;
}

function hasValidSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const session = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('admin_session='));
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!session || !secret) return false;
  const value = session.slice('admin_session='.length);
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.username === process.env.ADMIN_USERNAME && Date.now() - parsed.issuedAt < 8 * 60 * 60 * 1000;
  } catch (error) {
    return false;
  }
}

function hasValidBasicAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    return separator > 0 && safeEqual(decoded.slice(0, separator), process.env.ADMIN_USERNAME) && safeEqual(decoded.slice(separator + 1), process.env.ADMIN_PASSWORD);
  } catch (error) {
    return false;
  }
}

function requireAdmin(req, res) {
  if (hasValidSession(req) || hasValidBasicAuth(req)) return true;
  sendJson(res, 401, { success: false, error: 'Admin authentication required.' }, { 'WWW-Authenticate': 'Basic realm="Portfolio admin"' });
  return false;
}

function validateInquiry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Request body must be a JSON object.' };
  const required = (value, label, max) => {
    if (typeof value !== 'string' || !value.trim()) return { error: `${label} is required.` };
    const trimmed = value.trim();
    if (trimmed.length > max) return { error: `${label} must be ${max} characters or fewer.` };
    if (/[^\x09\x0A\x0D\x20-\uFFFF]/.test(trimmed)) return { error: `${label} contains invalid characters.` };
    return { value: trimmed };
  };
  const optional = (value, max) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>"']/.test(trimmed) ? trimmed : null;
  };

  const name = required(data.name, 'Name', 120);
  const email = required(data.email, 'Email', 254);
  const subject = required(data.subject || data.role, 'Subject', 160);
  const message = required(data.message, 'Message', 5000);
  if (name.error || email.error || subject.error || message.error) return { error: (name.error || email.error || subject.error || message.error) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) return { error: 'Please provide a valid email address.' };

  const phone = optional(data.phone, 40);
  const portfolio = optional(data.portfolio, 500);
  const budget = optional(data.budget, 300);
  if (phone === null || portfolio === null || budget === null) return { error: 'One or more optional fields are invalid or too long.' };
  if (portfolio && !/^https?:\/\//i.test(portfolio)) return { error: 'Portfolio URL must use http or https.' };
  return { value: { name: name.value, email: email.value, subject: subject.value, role: subject.value, message: message.value, phone, portfolio, budget } };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (error) { reject(Object.assign(new Error('Malformed JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname); } catch (error) { sendJson(res, 400, { success: false, error: 'Invalid URL.' }); return; }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const data = await readJsonBody(req);
      const username = typeof data.username === 'string' ? data.username : '';
      const password = typeof data.password === 'string' ? data.password : '';
      const cookie = sessionCookie(username);
      if (!cookie || !safeEqual(username, process.env.ADMIN_USERNAME) || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
        sendJson(res, 401, { success: false, error: 'Invalid admin credentials.' });
        return;
      }
      sendJson(res, 200, { success: true }, { 'Set-Cookie': cookie });
    } catch (error) {
      sendJson(res, error.statusCode || 400, { success: false, error: error.statusCode === 413 ? 'Request body too large.' : 'Invalid login request.' });
    }
    return;
  }

  // --- API ROUTE: POST /api/inquiries ---
  if (pathname === '/api/inquiries' && req.method === 'POST') {
    if (isRateLimited(req)) { sendJson(res, 429, { success: false, error: 'Too many submissions. Please try again later.' }, { 'Retry-After': '900' }); return; }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { sendJson(res, 415, { success: false, error: 'Content-Type must be application/json.' }); return; }
    try {
      const validation = validateInquiry(await readJsonBody(req));
      if (validation.error) { sendJson(res, 400, { success: false, error: validation.error }); return; }
      const now = new Date();
      const inquiry = { id: `INQ-${Date.now().toString(36).toUpperCase()}`, timestamp: `${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} (PST)`, isoDate: now.toISOString(), ...validation.value };
      const result = await inquiryStorage.createInquiry(inquiry);
      sendJson(res, 201, { success: true, id: inquiry.id, message: 'Information received and dossiers compiled successfully.', totalInquiries: result.totalInquiries, docFile: result.inquiry.dossierFile });
    } catch (error) {
      console.error('[Inquiry submission error]', error);
      sendJson(res, error.statusCode || 500, { success: false, error: error.statusCode === 413 ? 'Request body too large.' : error.statusCode === 400 ? error.message : 'Failed to process inquiry payload.' });
    }
    return;
  }

  // --- API ROUTE: GET /api/inquiries ---
  if (pathname === '/api/inquiries' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      sendJson(res, 200, await inquiryStorage.getInquiries());
    } catch (err) {
      console.error('[Inquiry read error]', err);
      sendJson(res, 500, { success: false, error: 'Failed to read inquiries.' });
    }
    return;
  }

  // --- API ROUTE: GET /api/export/csv ---
  if (pathname === '/api/export/csv' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      const csv = await inquiryStorage.getCsvContent();
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Candidate_Inquiries_Master.csv"',
        'Content-Length': Buffer.byteLength(csv, 'utf8')
      });
      res.end(csv);
    } catch (error) {
      console.error('[CSV export error]', error);
      sendJson(res, 500, { success: false, error: 'Failed to export inquiries.' });
    }
    return;
  }

  // --- API ROUTE: GET /api/export/doc/:id ---
  if (pathname.startsWith('/api/export/doc/') && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.slice('/api/export/doc/'.length).trim();
    try {
      const dossier = await inquiryStorage.getDossier(id);
      if (dossier && fs.existsSync(dossier.filePath)) {
        const stat = fs.statSync(dossier.filePath);
        const filename = path.basename(dossier.filePath);
        res.writeHead(200, {
          'Content-Type': 'application/msword; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': stat.size
        });
        fs.createReadStream(dossier.filePath).on('error', error => console.error('[Dossier export error]', error)).pipe(res);
        return;
      }
    } catch (error) {
      console.error('[Dossier lookup error]', error);
    }
    sendJson(res, 404, { success: false, error: 'Dossier document not found.' });
    return;
  }

  // --- STATIC FILE SERVING ---
  if (pathname === '/.env' || pathname.startsWith('/.env.') || pathname === '/data' || pathname.startsWith('/data/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalizedPath = path.resolve(__dirname, requestedPath);
  if (normalizedPath !== __dirname && !normalizedPath.startsWith(`${__dirname}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(normalizedPath).pipe(res);
  });
});

async function startServer() {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      console.log(`[Backend Server] Portfolio & Inquiries Gateway running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Database startup error]', error.message);
    await closeDatabase().catch(() => {});
    process.exitCode = 1;
  }
}

startServer();
