# Soham A. Chavan Portfolio

A static HTML/CSS/JavaScript portfolio served by a Node.js backend. Contact inquiries are stored in PostgreSQL, while the existing authenticated Vault provides list and export access.

## Local setup

Requirements: Node.js 20 or newer and a PostgreSQL database.

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a local PostgreSQL connection string.
3. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a long random `ADMIN_SESSION_SECRET`.
4. Install dependencies with `npm install`.
5. Initialize the schema with `npm run db:init`.
6. Start the server with `npm start`.
7. Open `http://localhost:<PORT>` (the default is `http://localhost:3000`).

The server fails clearly at startup if `DATABASE_URL` is missing or PostgreSQL cannot initialize. It does not silently fall back to JSON files.

## Database setup

PostgreSQL is the persistent source of truth for inquiries. The table is created from `db/schema.sql` using `CREATE TABLE IF NOT EXISTS`; startup runs this initialization safely and does not drop or reset tables.

Required environment variables:

- `PORT`: supplied by Render; local default is `3000`.
- `DATABASE_URL`: PostgreSQL connection string. Never expose it to frontend code.
- `ADMIN_USERNAME`: username for protected Vault and export endpoints.
- `ADMIN_PASSWORD`: password for protected Vault and export endpoints.
- `ADMIN_SESSION_SECRET`: long random secret used to sign the admin session cookie.
- `NODE_ENV`: use `production` on Render so the admin cookie uses `Secure`.

`.env` and real credentials must never be committed. `.env.example` contains placeholders only.

For local PostgreSQL, install PostgreSQL directly or use a local container, create a development database, and set for example:

```text
DATABASE_URL=postgresql://postgres:your_local_password@localhost:5432/soham_portfolio
```

The application uses the `pg` client and parameterized SQL queries. It does not use an ORM.

## Existing data migration

The existing `data/inquiries.json` and `data/inquiries.csv` were inspected and contained no inquiry records, so no migration was required. The original files were not deleted.

If a future checkout contains JSON records, review them first, configure `DATABASE_URL`, then run:

```powershell
npm run db:import-inquiries
```

The importer validates records, uses parameterized inserts, skips invalid or matching records, reports imported/skipped counts, and never deletes the source files. CSV is not used as a primary import source.

## API and Vault

The public contact form continues to use:

```text
POST /api/inquiries
```

It accepts `name`, `email`, `phone`, `role`, `portfolio`, `budget`, and `message`. The response remains compatible with the existing success banner and includes the inquiry ID, total count, and generated dossier filename.

The following routes remain admin-protected:

- `GET /api/inquiries`
- `GET /api/export/csv`
- `GET /api/export/doc/:id`

The browser never connects directly to PostgreSQL. The existing Vault UI calls the authenticated Node.js API exactly as before. Opening the Vault prompts for admin credentials and creates an 8-hour signed `HttpOnly`, `SameSite=Strict` session. HTTP Basic authentication remains available for command-line checks.

CSV export queries PostgreSQL and builds the CSV response in memory. DOC export queries the selected PostgreSQL row and generates the existing Word-compatible dossier under `data/dossiers/` on demand. Dossier files are generated artifacts only; inquiry records remain in PostgreSQL.

## API checks

Submit an inquiry:

```powershell
$body = @{ name = 'Test User'; email = 'test@example.com'; role = 'Project Collaboration'; message = 'Test inquiry' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/inquiries -Method Post -ContentType 'application/json' -Body $body
```

Use Basic authentication for protected endpoints:

```powershell
$pair = 'your_admin_username:your_strong_password'
$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{ Authorization = "Basic $basic" }
Invoke-RestMethod -Uri http://localhost:3000/api/inquiries -Headers $headers
Invoke-WebRequest -Uri http://localhost:3000/api/export/csv -Headers $headers -OutFile inquiries-export.csv
```

## Render deployment

Do not create a database from the application. In Render:

1. Create a Render PostgreSQL database from the Render dashboard.
2. Copy its internal connection string or provided `DATABASE_URL` value.
3. Open the existing portfolio Web Service.
4. Add `DATABASE_URL` to the service environment variables.
5. Add or verify `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `NODE_ENV=production`.
6. Keep the build/install behavior and start command as `npm start`.
7. Deploy the application manually when ready. The server uses Render's `process.env.PORT`.
8. Check service logs for successful database initialization and server startup.
9. Submit a test inquiry through the public contact form and confirm a `201` response.
10. Open the Vault, authenticate, and confirm the inquiry appears.
11. Test the CSV and DOC export links from the authenticated Vault.

Do not put `DATABASE_URL`, passwords, or session secrets in source files, HTML, frontend JavaScript, or README examples.

## Security and reliability

- Public inquiry submission does not require admin authentication.
- Admin list and export routes return `401` without a valid session or Basic credentials.
- Input validation, 32 KB request limits, rate limiting, security headers, safe error responses, path protection, and CSV formula protection remain enabled.
- SQL uses parameterized queries only.
- Database connection errors are logged server-side without exposing SQL, credentials, or connection strings to users.
- Render's filesystem is ephemeral; it is not used as the persistent inquiry database.
- Use Render PostgreSQL backups or scheduled exports for operational backup planning.
