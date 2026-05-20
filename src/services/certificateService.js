import puppeteer from 'puppeteer';
import Employee from '../models/Employee.js';
import { sendCertificateEmail } from './emailService.js';

const escapeHtml = (value) => {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

export const makeCertificateCode = ({ seminarId, employeeId, registrationId }) => {
  const seminarCode = String(seminarId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  const employeeCode = String(employeeId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  const registrationCode = String(registrationId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  const randomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GAD-${seminarCode || '00000'}-${employeeCode || '00000'}-${registrationCode || randomCode}-${randomCode}`;
};

export const buildCertificateHtml = ({
  employeeName,
  seminarTitle,
  dateStr,
  startTime,
  certificateCode,
  employeeDisplayId,
  department,
  issuedStr,
}) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GIMS Certificate - ${escapeHtml(employeeName)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 20px;
        background: #f6f8fb;
        font-family: Arial, sans-serif;
        width: 100vw;
        height: 100vh;
        box-sizing: border-box;
      }
      .certificate {
        width: 100%;
        height: 100%;
        margin: 0 auto;
        background: #ffffff;
        border: 12px solid #1f3c77;
        border-radius: 20px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        padding: 40px 52px 36px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .watermark {
        position: absolute;
        right: 16px;
        bottom: -12px;
        font-size: 140px;
        color: rgba(31, 60, 119, 0.06);
        font-weight: 800;
        letter-spacing: 0.08em;
        user-select: none;
      }
      .header {
        text-align: center;
        border-bottom: 2px solid #dbe5f7;
        padding-bottom: 14px;
      }
      .org {
        font-size: 13px;
        letter-spacing: 0.12em;
        color: #334155;
      }
      .title {
        margin-top: 6px;
        font-size: 54px;
        line-height: 1.1;
        color: #1f3c77;
        font-weight: 800;
      }
      .subtitle {
        margin-top: 6px;
        color: #475569;
        font-size: 20px;
      }
      .name {
        margin-top: 34px;
        text-align: center;
        font-size: 62px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
      }
      .line {
        margin: 10px auto 24px;
        width: min(820px, 90%);
        border-bottom: 2px solid #cbd5e1;
      }
      .body-text {
        text-align: center;
        margin: 0 auto;
        max-width: 1180px;
        color: #334155;
        font-size: 32px;
        line-height: 1.5;
      }
      .seminar {
        color: #1f3c77;
        font-weight: 700;
      }
      .meta {
        margin-top: auto;
        padding-top: 30px;
        display: grid;
        grid-template-columns: repeat(2, minmax(320px, 1fr));
        gap: 10px 40px;
        font-size: 20px;
        color: #334155;
      }
      .meta b { color: #0f172a; }
      .footer {
        margin-top: 28px;
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 22px;
      }
      .sig {
        border-top: 1px solid #94a3b8;
        width: 320px;
        text-align: center;
        padding-top: 10px;
        font-size: 18px;
        color: #334155;
      }
      .badge {
        background: #eaf0fb;
        color: #1f3c77;
        border: 1px solid #c9d8f3;
        border-radius: 999px;
        padding: 12px 18px;
        font-size: 17px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <article class="certificate">
      <div class="watermark">GIMS</div>
      <header class="header">
        <div class="org">XAVIER UNIVERSITY - ATENEO DE CAGAYAN</div>
        <div class="title">Certificate of Attendance</div>
        <div class="subtitle">Gender and Development Information and Management System</div>
      </header>

      <div class="name">${escapeHtml(employeeName)}</div>
      <div class="line"></div>

      <p class="body-text">
        is hereby recognized for attending the seminar
        <span class="seminar">${escapeHtml(seminarTitle)}</span>
        held on <span class="seminar">${escapeHtml(dateStr)}</span>
        at <span class="seminar">${escapeHtml(startTime)}</span>.
      </p>

      <section class="meta">
        <div><b>Certificate Code:</b> ${escapeHtml(certificateCode)}</div>
        <div><b>Employee ID:</b> ${escapeHtml(employeeDisplayId)}</div>
        <div><b>Department:</b> ${escapeHtml(department || 'N/A')}</div>
        <div><b>Issued At:</b> ${escapeHtml(issuedStr)}</div>
      </section>

      <footer class="footer">
        <div class="sig">GAD Office Representative</div>
        <div class="badge">System-Issued via GIMS</div>
      </footer>
    </article>
  </body>
</html>`;
};

export const renderCertificateBuffer = async ({ html }) => {
  // NOTE: --single-process was previously set but is unstable on Render/low-mem
  // environments and was the source of intermittent "TargetCloseError: Target
  // closed" crashes (returned to the client as 502 Bad Gateway).
  const launchOptions = {
    headless: true,
    protocolTimeout: 60_000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(45_000);
    await page.setViewport({ width: 1754, height: 1240, deviceScaleFactor: 1 });
    // The certificate HTML has no external network resources, so
    // 'domcontentloaded' is sufficient and avoids networkidle0 hangs.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return await page.screenshot({ type: 'png', fullPage: false });
  } finally {
    try { await browser.close(); } catch { /* ignore close errors */ }
  }
};

export const buildCertificateDownload = ({ employee, registration, seminar }) => {
  const dateStr = seminar?.date ? new Date(seminar.date).toLocaleDateString() : '';
  const issuedAt = registration?.certificateIssuedAt ? new Date(registration.certificateIssuedAt) : new Date();
  const certificateCode =
    registration?.certificateCode ||
    makeCertificateCode({ seminarId: seminar?._id, employeeId: employee?._id, registrationId: registration?._id });

  return {
    html: buildCertificateHtml({
      employeeName: employee?.name || '',
      seminarTitle: seminar?.title || '',
      dateStr,
      startTime: seminar?.startTime || '',
      certificateCode,
      employeeDisplayId: `EMP-${String(employee?._id || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6)
        .toUpperCase() || '000000'}`,
      department: employee?.department || 'N/A',
      issuedStr: issuedAt.toLocaleString(),
    }),
    certificateCode,
    fileNameSafe: `${seminar?.title || 'certificate'}`.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60),
  };
};

export const issueCertificateForRegistration = async ({
  registration,
  seminar,
  employee,
  Notification,
}) => {
  if (!registration || !seminar || !employee) return null;
  if (String(registration.status || '').toLowerCase() !== 'attended') return null;
  if (registration.certificateIssued) return registration;

  // Defensive: callers sometimes pass a stub { _id } without accountStatus/email.
  // Load the real employee so the deactivation gate works correctly.
  let employeeRecord = employee;
  if (employee && employee._id && (employee.accountStatus === undefined || employee.email === undefined)) {
    const fetched = await Employee.findById(employee._id);
    if (fetched) employeeRecord = fetched;
  }

  registration.certificateIssued = true;
  registration.certificateIssuedAt = new Date();
  registration.certificateCode =
    registration.certificateCode ||
    makeCertificateCode({ seminarId: seminar._id, employeeId: employeeRecord._id, registrationId: registration._id });
  await registration.save();

  const isDeactivated = employeeRecord.accountStatus === 'deactivated';

  if (Notification && !isDeactivated) {
    await Notification.create({
      employeeID: employeeRecord._id,
      type: 'certificate',
      message: `Your certificate for \"${seminar.title}\" is now available. You can download it from your dashboard.`,
      seminarID: seminar._id,
      registrationID: registration._id,
    });
  }

  if (employeeRecord.email && !isDeactivated) {
    queueCertificateEmail({ employee: employeeRecord, seminar, registration });
  }

  return registration;
};

const queueCertificateEmail = ({ employee, seminar, registration }) => {
  setImmediate(async () => {
    try {
      const { html, certificateCode, fileNameSafe } = buildCertificateDownload({
        employee,
        registration,
        seminar,
      });
      const buffer = await renderCertificateBuffer({ html });
      await sendCertificateEmail({
        employee,
        seminar,
        certificateCode,
        attachment: {
          filename: `${fileNameSafe || 'certificate'}.png`,
          content: buffer,
          contentType: 'image/png',
        },
      });
      console.log(
        `Certificate emailed to ${employee.email} for "${seminar.title}".`
      );
    } catch (err) {
      console.error(
        `Certificate email failed for ${employee.email} (seminar ${seminar._id}):`,
        err.message
      );
    }
  });
};