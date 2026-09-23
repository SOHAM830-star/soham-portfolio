const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/database');

const DOSSIERS_DIR = path.join(__dirname, '..', 'data', 'dossiers');
const CSV_HEADER = '\uFEFF"Inquiry ID","Submission Date","Full Name","Email Address","Phone / WhatsApp","Engagement Type","Portfolio / Profile","Budget / Rate","Message / Proposal"\r\n';

function escapeCsv(field) {
  if (field === null || field === undefined) return '""';
  let value = String(field).replace(/"/g, '""');
  if (/^[=+\-@]/.test(value)) value = `'${value}`;
  return `"${value}"`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function mapInquiry(row) {
  return {
    id: String(row.id),
    timestamp: new Date(row.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' (PST)',
    isoDate: new Date(row.created_at).toISOString(),
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role || 'General Collaboration',
    portfolio: row.portfolio || '',
    budget: row.budget || '',
    message: row.message,
    createdAt: row.created_at
  };
}

function generateWordDoc(inquiry) {
  const safeName = inquiry.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'Candidate';
  const filename = `Candidate_${inquiry.id}_${safeName}.doc`;
  const filePath = path.join(DOSSIERS_DIR, filename);
  const name = escapeHtml(inquiry.name);
  const email = escapeHtml(inquiry.email);
  const phone = escapeHtml(inquiry.phone || 'Not provided');
  const role = escapeHtml(inquiry.role || 'General Collaboration');
  const portfolio = inquiry.portfolio ? `<a href="${escapeHtml(inquiry.portfolio)}">${escapeHtml(inquiry.portfolio)}</a>` : 'Not provided';
  const budget = escapeHtml(inquiry.budget || 'Flexible / Negotiable');
  const message = escapeHtml(inquiry.message || 'No additional notes provided.');
  const timestamp = escapeHtml(inquiry.timestamp);

  const htmlDoc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Inquiry Dossier - ${name}</title>
<style>body{font-family:'Segoe UI',Calibri,Arial,sans-serif;margin:40px;color:#1a202c;line-height:1.6}.header-box{border-bottom:3px solid #00b4d8;padding-bottom:18px;margin-bottom:24px}.brand{color:#0077b6;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase}h1{margin:6px 0;font-size:26px;color:#0f172a}.meta-tag{display:inline-block;background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:4px;font-weight:600;font-size:12px}.details-table{width:100%;border-collapse:collapse;margin-bottom:24px}.details-table th,.details-table td{border:1px solid #cbd5e1;padding:10px 14px;font-size:14px;text-align:left}.details-table th{background:#f8fafc;width:25%;color:#475569}.details-table td{color:#0f172a;font-weight:500}.message-box{background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #00b4d8;padding:18px;border-radius:4px;font-size:14px;line-height:1.7;white-space:pre-wrap}.footer{margin-top:36px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;text-align:right}</style></head>
<body><div class="header-box"><div class="brand">SOHAM A. CHAVAN - INQUIRY DOSSIER</div><h1>${name}</h1><span class="meta-tag">${role}</span><span style="font-size:12px;color:#64748b;margin-left:14px">ID: ${escapeHtml(inquiry.id)} - Received: ${timestamp}</span></div>
<table class="details-table"><tr><th>Email Address</th><td><a href="mailto:${email}">${email}</a></td></tr><tr><th>Phone / WhatsApp</th><td>${phone}</td></tr><tr><th>Engagement Scope</th><td>${role}</td></tr><tr><th>Portfolio / Profile</th><td>${portfolio}</td></tr><tr><th>Target Timeline & Budget</th><td>${budget}</td></tr></table>
<h3 style="color:#1e293b;font-size:16px;margin-bottom:10px">Message / Project Proposal</h3><div class="message-box">${message}</div><div class="footer">Compiled automatically by the Portfolio Inquiry Gateway - ${new Date().toUTCString()}</div></body></html>`;

  fs.mkdirSync(DOSSIERS_DIR, { recursive: true });
  fs.writeFileSync(filePath, htmlDoc, 'utf8');
  return { filename, filePath };
}

async function countInquiries() {
  const result = await getPool().query('SELECT COUNT(*)::int AS count FROM inquiries');
  return result.rows[0].count;
}

async function createInquiry(input) {
  const result = await getPool().query(
    `INSERT INTO inquiries (name, email, phone, role, portfolio, budget, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, phone, role, portfolio, budget, message, created_at`,
    [input.name, input.email, input.phone || null, input.role || null, input.portfolio || null, input.budget || null, input.message]
  );
  const inquiry = mapInquiry(result.rows[0]);
  const dossier = generateWordDoc(inquiry);
  return { inquiry: { ...inquiry, dossierFile: dossier.filename }, totalInquiries: await countInquiries() };
}

async function getInquiries() {
  const result = await getPool().query('SELECT id, name, email, phone, role, portfolio, budget, message, created_at FROM inquiries ORDER BY created_at DESC, id DESC');
  return result.rows.map(mapInquiry);
}

async function getInquiryById(inquiryId) {
  if (!/^\d+$/.test(String(inquiryId))) return null;
  const result = await getPool().query(
    'SELECT id, name, email, phone, role, portfolio, budget, message, created_at FROM inquiries WHERE id = $1',
    [Number(inquiryId)]
  );
  return result.rows[0] ? mapInquiry(result.rows[0]) : null;
}

async function getCsvContent() {
  const inquiries = await getInquiries();
  const lines = inquiries.map(inquiry => [
    inquiry.id,
    inquiry.timestamp,
    inquiry.name,
    inquiry.email,
    inquiry.phone,
    inquiry.role,
    inquiry.portfolio,
    inquiry.budget,
    inquiry.message
  ].map(escapeCsv).join(','));
  return CSV_HEADER + (lines.length ? `${lines.join('\r\n')}\r\n` : '');
}

async function getDossier(inquiryId) {
  const inquiry = await getInquiryById(inquiryId);
  if (!inquiry) return null;
  return generateWordDoc(inquiry);
}

module.exports = { createInquiry, getInquiries, getInquiryById, getCsvContent, getDossier };
