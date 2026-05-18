# GIMS – GAD Integrated Management System

GIMS is a web app for the Xavier University Gender and Development (GAD) Office. It handles seminars, employee registrations, attendance, evaluations, certificate issuance, and the yearly compliance reporting the office submits.

Stack: Node.js / Express, MongoDB (Mongoose), Nodemailer over Gmail, Puppeteer for PDF certificates. JWT-based auth with separate admin and employee dashboards.

Authors: Group 1 / Group 6.

## What it does

Admin side:
- Create seminars with one or more sessions, set capacity, mark as mandatory, choose certificate release mode
- Approve registrations, mark sessions as held, take per-session attendance, finalize attendance
- Issue and download certificates (per-seminar or per-participant)
- Soft-delete seminars and restore them from the trash (or permanently delete)
- Manage employee accounts — activate, deactivate, reset password
- Post Articles / Updates (with cover image) for the employee feed
- Upload Learning Materials (PDF / PPT / PPTX, max 50 MB) globally or attached to a seminar
- Send bulk reminder emails to non-compliant employees
- Reports: CHED-format PDF, employees CSV, per-seminar report, evaluation summary
- End-of-school-year reset: archive all current seminars/registrations into a school-year archive, then start fresh. Old archives stay browsable and exportable to Excel masterlist.
- Maintenance log of admin actions (resets, restores, etc.)

Employee side:
- Sign up with an `@xu.edu.ph` Gmail using a 6-digit PIN
- Forgot-password flow (PIN-based)
- View compliance status and the seminars still required
- Register for upcoming seminars, see registration history
- Submit post-seminar evaluations
- Download earned certificates
- Read Articles / Updates and access Learning Materials

Background: a scheduler sends reminder emails for upcoming seminars without anyone needing to click a button.

## Project layout

```
src/
  server.js                       Express bootstrap
  config/
    db.js                         Mongo connection
    bootstrapAccounts.js          Initial admin bootstrap on boot
    passwordPolicy.js             Password rules (length, complexity)
  models/                         Mongoose schemas
    Article, Employee, Evaluation, LearningMaterial,
    Notification, PasswordReset, PinVerification,
    Registration, Seminar, User,
    SeminarArchive, RegistrationArchive,   ← yearly archives
    MaintenanceLog
  routes/
    auth.js                       sign-up / login / PIN / forgot-password
    admin.js                      admin APIs
    employee.js                   employee APIs
    maintenance.js                archives, school-year reset, masterlist
  services/
    certificateService.js         Puppeteer cert rendering
    emailService.js               Gmail PINs + reminders
    reportService.js              CHED PDF + Excel reports (exceljs)
    schoolYearService.js          School year calc / reset logic
    seminarReminderScheduler.js   Auto reminder job
  scripts/
    seedSamples.js                Optional sample data
public/
  *.html, css/, js/, images/
  uploads/                        runtime uploads (gitignored)
```

## Environment

Copy `.env.example` to `.env` and fill in the real values. Sample:

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/gims
JWT_SECRET=change-this-secret
USE_IN_MEMORY_DB=false

GMAIL_USER=your-gad-email@example.com
GMAIL_APP_PASSWORD=your-gmail-app-password

ORG_NAME=Xavier University – Ateneo de Cagayan
SYSTEM_NAME=GIMS
```

A couple of things that have bitten us:
- `GMAIL_APP_PASSWORD` is a Google App Password, not your Gmail password. PINs/reminders silently fail to send if this is wrong.
- `USE_IN_MEMORY_DB=true` is convenient for local testing but the data is wiped every restart — don't leave it on for demos.
- `.env` and `public/uploads/*` are gitignored. Keep them that way.

## Running it

Local:
```bash
npm install
npm run dev
```
App: `http://localhost:4000`.

Docker (brings up Mongo + app together):
```bash
docker compose up --build
```

## First-time setup

1. Get an admin account. Easiest: `npm run seed` (runs `src/scripts/seedSamples.js` — creates a sample admin, employee, and seminar). Or hit the bootstrap endpoint once:

   ```
   POST /api/admin/seed-admin
   { "name": "...", "email": "...", "password": "...", "birthSex": "Female" }
   ```

2. Log in at `/admin.html`, create seminars and upload materials.

3. Employees sign up at `/signup.html` with their `@xu.edu.ph` Gmail.

## Yearly reset

At the end of a school year, admin can run the reset from the Maintenance page. Current seminars + registrations get moved into a `SeminarArchive` / `RegistrationArchive` keyed by school year, and the live collections start empty for the new year. Archives stay readable and can be exported to an Excel masterlist. Don't run this casually — it's irreversible without restoring the archive.

## Security notes

- Passwords are bcrypt-hashed (`bcryptjs`); only the hash is stored.
- JWT secret should be rotated in production. Don't ship the default.
- Uploads are restricted by extension and size (PDF / PPT / PPTX, ≤50 MB).
- Don't commit `.env`, `public/uploads/*`, or any Gmail App Password.

## License

MIT — see `package.json`.
