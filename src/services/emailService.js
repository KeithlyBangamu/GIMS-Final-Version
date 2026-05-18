import axios from 'axios';
import Employee from '../models/Employee.js';
import Seminar from '../models/Seminar.js';


const sendMailViaAPI = async (options) => {
  try {
    const payload = {
      sender: { name: "GIMS", email: "kiethlybangamu@gmail.com" },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text || "GIMS Notification"
    };

    if (Array.isArray(options.bcc) && options.bcc.length > 0) {
      payload.bcc = options.bcc.map((email) => ({ email }));
    }

    // Brevo formatting for the certificate attachment
    if (options.attachments && options.attachments.length > 0) {
      payload.attachment = options.attachments.map(att => ({
        name: att.filename,
        // Brevo requires base64 string for content
        content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
      }));
    }

    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': process.env.BREVO_API_KEY, // Ensure this is set in Render Dashboard
        'Content-Type': 'application/json'
      }
    });

    console.log('Email sent successfully via API!');
    return response.data;
  } catch (error) {
    console.error("Brevo API Error:", error.response?.data || error.message);
    throw error;
  }
};

const sendMailWithRetry = async (mailOptions) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const transporter = await getTransporter();
      await transporter.sendMail(mailOptions);
      return;
    } catch (err) {
      lastError = err;
      transporterPromise = null;
    }
  }
  throw lastError;
};

// =========================================================================
// Branded HTML email template
// =========================================================================
// Email-safe: tables for layout, inline styles, web-safe serif fallbacks.

const COLORS = {
  navy: '#0f2a44',
  navyDeep: '#14264f',
  blue: '#203a73',
  gold: '#c9a24a',
  text: '#1f2937',
  muted: '#6b7280',
  bg: '#f3f5fb',
  card: '#ffffff',
  highlightBg: '#f8f5ec',
  highlightBorder: '#e7d8ad',
};

const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

const buildEmail = ({ preheader = '', heading, intro, highlight, body = '', signoff = 'Xavier University GAD Office' }) => {
  const highlightBlock = highlight
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 26px 0;">
        <tr>
          <td align="center" style="background:${COLORS.highlightBg}; border:1px solid ${COLORS.highlightBorder}; border-left: 4px solid ${COLORS.gold}; border-radius: 8px; padding: 22px 18px;">
            <div style="font-family:${SANS}; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: ${COLORS.blue}; font-weight: 700; margin-bottom: 8px;">
              ${highlight.label || ''}
            </div>
            <div style="font-family:${SERIF}; font-size: ${highlight.large ? '40px' : '32px'}; font-weight: 500; color: ${COLORS.navyDeep}; letter-spacing: ${highlight.large ? '0.18em' : '0'}; line-height: 1.1;">
              ${highlight.value}
            </div>
            ${highlight.caption ? `<div style="font-family:${SANS}; font-size: 13px; color: ${COLORS.muted}; margin-top: 10px;">${highlight.caption}</div>` : ''}
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GIMS</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.bg}; font-family:${SANS}; color:${COLORS.text};">
  <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background:${COLORS.card}; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(15,23,42,0.08);">

          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.navy}, ${COLORS.blue}); padding: 38px 32px 32px; text-align: left; color: #ffffff;">
              <div style="font-family:${SERIF}; font-style: italic; font-size: 14px; color: ${COLORS.gold}; letter-spacing: 0.04em; margin-bottom: 6px;">
                Xavier University &middot; Ateneo de Cagayan
              </div>
              <div style="font-family:${SERIF}; font-size: 46px; font-weight: 500; color: #ffffff; letter-spacing: 0.02em; line-height: 1;">
                GIMS
              </div>
              <div style="width: 48px; height: 2px; background:${COLORS.gold}; margin: 14px 0 10px;"></div>
              <div style="font-family:${SANS}; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.82); font-weight: 600;">
                GAD Integrated Management System
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 38px 32px;">
              <h1 style="font-family:${SERIF}; font-weight: 500; font-size: 26px; line-height: 1.25; color: ${COLORS.navyDeep}; margin: 0 0 14px;">
                ${heading}
              </h1>
              <p style="font-family:${SANS}; font-size: 15px; line-height: 1.65; color: ${COLORS.text}; margin: 0 0 6px;">
                ${intro}
              </p>
              ${highlightBlock}
              ${body ? `<div style="font-family:${SANS}; font-size: 15px; line-height: 1.65; color: ${COLORS.text};">${body}</div>` : ''}
              <p style="font-family:${SERIF}; font-style: italic; font-size: 16px; color: ${COLORS.navyDeep}; margin: 32px 0 0;">
                ${signoff}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${COLORS.navyDeep}; padding: 22px 32px; color: rgba(255,255,255,0.78);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${SERIF}; font-size: 14px; color: #ffffff;">
                    Xavier University<br />
                    <span style="font-style: italic; color: rgba(255,255,255,0.7); font-size: 12px;">Ateneo de Cagayan &middot; GAD Office</span>
                  </td>
                  <td align="right" style="font-family:${SANS}; font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 0.05em;">
                    This is an automated GIMS message.<br />Please do not reply to this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <div style="font-family:${SANS}; font-size: 11px; color: ${COLORS.muted}; margin-top: 16px;">
          &copy; Xavier University Ateneo de Cagayan
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// =========================================================================
// Email senders
// =========================================================================

export const sendVerificationPinEmail = async (email, code, expiresAt) => {
  const expiresStr = expiresAt.toLocaleTimeString();
  const html = buildEmail({
    preheader: `Your GIMS verification PIN is ${code}. Expires at ${expiresStr}.`,
    heading: 'Verify your GIMS account',
    intro: `Welcome to GIMS. Use the verification PIN below to confirm your Xavier University email address and continue creating your account.`,
    highlight: {
      label: 'Your verification PIN',
      value: code,
      large: true,
      caption: `Expires at ${expiresStr} (valid for 5 minutes).`,
    },
    body: `<p style="margin:0;">Enter this code on the signup page to complete your email verification. If you did not start a GIMS signup, you can safely ignore this message.</p>`,
  });

await sendMailViaAPI({
    to: email,
    subject: 'Your GIMS verification PIN',
    text: `Your GIMS verification PIN is: ${code}`, // Simple text fallback
    html, // Your beautiful branded template
  });
};

export const sendPasswordResetPinEmail = async (email, code, expiresAt) => {
  const expiresStr = expiresAt.toLocaleTimeString();
  const html = buildEmail({
    preheader: `Your GIMS password reset PIN is ${code}. Expires at ${expiresStr}.`,
    heading: 'Reset your GIMS password',
    intro: `We received a request to reset the password for your GIMS account. Use the verification PIN below to continue.`,
    highlight: {
      label: 'Password reset PIN',
      value: code,
      large: true,
      caption: `Expires at ${expiresStr} (valid for 10 minutes).`,
    },
    body: `<p style="margin:0;">If you did not request a password reset, you can safely ignore this email — your account remains secure.</p>`,
  });

  await sendMailViaAPI({
    from: `"GIMS" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'GIMS password reset PIN',
    text: `Your GIMS password reset PIN is: ${code}\n\nThis code expires at ${expiresStr} (10 minutes).\n\nIf you did not request this, you can ignore this email.\n\n— Xavier University GAD Office`,
    html,
  });
};

export const sendTemporaryPasswordEmail = async (email, tempPassword) => {
  const html = buildEmail({
    preheader: `An administrator has issued a temporary password for your GIMS account.`,
    heading: 'A temporary password has been issued',
    intro: `An administrator has reset the password for your GIMS account. Use the temporary password below to sign in.`,
    highlight: {
      label: 'Temporary password',
      value: tempPassword,
      caption: 'Please change this password immediately after signing in.',
    },
    body: `<p style="margin:0;">For your security, this password should be changed as soon as you sign in. If you did not expect this reset, please contact the GAD Office.</p>`,
  });

  await sendMailViaAPI({
    to: email,
    subject: 'Your GIMS temporary password', 
    text: `Your temporary password is: ${tempPassword}`, 
    html,
  });
};

export const sendCertificateEmail = async ({
  employee,
  seminar,
  certificateCode,
  attachment,
}) => {
  if (!employee?.email) throw new Error('Employee has no email address.');

  const seminarTitle = seminar?.title || 'GAD Seminar';
  const dateStr = seminar?.date
    ? new Date(seminar.date).toLocaleDateString()
    : '';

  const html = buildEmail({
    preheader: `Your certificate for "${seminarTitle}" is now available.`,
    heading: 'Your certificate has been released',
    intro: `Congratulations, ${employee.name || 'colleague'}. Your certificate of attendance for the seminar "<strong>${seminarTitle}</strong>" has been released and is attached to this email.`,
    highlight: {
      label: 'Certificate code',
      value: certificateCode || '—',
      caption: dateStr ? `Seminar held on ${dateStr}.` : '',
    },
    body: `<p style="margin: 0 0 12px;">You may also download your certificate any time from the <strong>Attended Seminars</strong> section of your GIMS dashboard.</p>
      <p style="margin: 0; color:${COLORS.muted}; font-size: 14px;">Thank you for your continued participation in Xavier University's GAD initiatives.</p>`,
  });

  const attachments = attachment
    ? [
        {
          filename: attachment.filename || `${seminarTitle}-certificate.png`.replace(/[^a-zA-Z0-9.-]+/g, '-'),
          content: attachment.content,
          contentType: attachment.contentType || 'image/png',
        },
      ]
    : [];

  await sendMailViaAPI({
    from: `"GIMS" <${process.env.GMAIL_USER}>`,
    to: employee.email,
    subject: `Your GIMS certificate: ${seminarTitle}`,
    text: `Hello ${employee.name || 'colleague'},\n\nYour certificate of attendance for "${seminarTitle}" has been released.\n\nCertificate code: ${certificateCode || '—'}\n\nThe certificate is attached to this email and is also available in the Attended Seminars section of your GIMS dashboard.\n\n— Xavier University GAD Office`,
    html,
    attachments,
  });
};

export const sendReminderEmail = async (employee, remainingCount) => {
  const noun = remainingCount === 1 ? 'seminar' : 'seminars';
  const html = buildEmail({
    preheader: `You have ${remainingCount} ${noun} remaining to meet your GAD requirements this year.`,
    heading: `Hello, ${employee.name || 'colleague'}.`,
    intro: `Our records show you still have GAD seminars to complete for the current academic year. We're sending a friendly reminder so you can plan ahead and stay on track with your compliance requirements.`,
    highlight: {
      label: 'Seminars remaining',
      value: String(remainingCount),
      large: true,
      caption: `You still need ${remainingCount} ${noun} to fulfill this year's requirement.`,
    },
    body: `<p style="margin: 0 0 12px;"><strong style="color:${COLORS.navyDeep};">What to do next</strong></p>
      <ul style="margin: 0 0 8px; padding-left: 20px; font-family:${SANS}; font-size: 15px; line-height: 1.7; color:${COLORS.text};">
        <li>Sign in to GIMS and review the upcoming GAD seminar schedule.</li>
        <li>Reserve a seat for any session that fits your calendar.</li>
        <li>Reach out to the GAD Office if you have questions or scheduling conflicts.</li>
      </ul>
      <p style="margin: 16px 0 0; color:${COLORS.muted}; font-size: 14px;">Thank you for your continued participation in shaping a more inclusive Xavier University.</p>`,
  });

  await sendMailViaAPI({
    from: `"XU GAD Office" <${process.env.GMAIL_USER}>`,
    to: employee.email,
    subject: 'GAD Seminar Compliance Reminder',
    text: `Dear ${employee.name},\n\nOur records show that you have remaining GAD seminars to complete for the current academic year.\n\nYou still need ${remainingCount} ${noun} to complete your requirements.\n\nPlease refer to the upcoming GAD seminar schedule and ensure your participation.\n\nThank you,\nXavier University GAD Office`,
    html,
  });
};

export const sendSeminarReminderEmail = async ({ employee, seminar, sessionDate, sessionStartTime }) => {
  if (!employee?.email) throw new Error('Employee has no email address.');

  const seminarTitle = seminar?.title || 'GAD Seminar';
  const dateObj = sessionDate ? new Date(sessionDate) : (seminar?.date ? new Date(seminar.date) : null);
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'tomorrow';
  const timeStr = sessionStartTime || seminar?.startTime || '';
  const location = seminar?.location || 'TBA';
  const duration = seminar?.durationHours ? `${seminar.durationHours} hour(s)` : '';

  const detailsRows = [
    ['Date', dateStr],
    timeStr ? ['Start Time', timeStr] : null,
    ['Location', location],
    duration ? ['Duration', duration] : null,
  ].filter(Boolean);

  const detailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 18px; border-collapse: separate; border-spacing: 0;">
      ${detailsRows.map(([label, value]) => `
        <tr>
          <td style="padding: 8px 0; font-family:${SANS}; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: ${COLORS.muted}; font-weight: 600; width: 110px; vertical-align: top;">
            ${label}
          </td>
          <td style="padding: 8px 0; font-family:${SANS}; font-size: 15px; color: ${COLORS.text}; border-bottom: 1px solid #eef0f5;">
            ${value}
          </td>
        </tr>`).join('')}
    </table>`;

  const html = buildEmail({
    preheader: `Reminder: "${seminarTitle}" is tomorrow.`,
    heading: 'Your seminar is tomorrow',
    intro: `Hello ${employee.name || 'colleague'}, this is a friendly reminder that the GAD seminar you registered for is scheduled for <strong>tomorrow</strong>. We look forward to seeing you there.`,
    highlight: {
      label: 'Seminar',
      value: seminarTitle,
      caption: dateStr,
    },
    body: `<p style="margin: 0 0 10px;"><strong style="color:${COLORS.navyDeep};">Session details</strong></p>
      ${detailsHtml}
      <p style="margin: 0 0 10px; font-family:${SANS}; font-size: 14px; color:${COLORS.muted};">
        Please arrive a few minutes early. If you can no longer attend, kindly cancel your registration in GIMS so the slot can be released.
      </p>`,
  });

  await sendMailViaAPI({
    to: employee.email,
    subject: `Reminder: "${seminarTitle}" is tomorrow`,
    text: `Hello ${employee.name || 'colleague'},\n\nThis is a reminder that "${seminarTitle}" is scheduled for ${dateStr}${timeStr ? ` at ${timeStr}` : ''}.\nLocation: ${location}\n\nWe look forward to seeing you there.\n\n— Xavier University GAD Office`,
    html,
  });
};

export const sendNewSeminarAnnouncement = async ({ seminar }) => {
  if (!seminar) return { sent: 0 };

  const recipients = await Employee.find({}).select('email').lean();
  const emails = recipients
    .map((e) => (e?.email || '').trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return { sent: 0 };

  const seminarTitle = seminar.title || 'New GAD Seminar';
  const dateObj = seminar.date ? new Date(seminar.date) : null;
  const dateStr = dateObj
    ? dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBA';
  const timeStr = seminar.startTime || '';
  const location = seminar.location || 'TBA';
  const duration = seminar.durationHours ? `${seminar.durationHours} hour(s)` : '';
  const resourcePerson = seminar.resourcePerson || '';

  const detailsRows = [
    ['Date', dateStr],
    timeStr ? ['Start Time', timeStr] : null,
    ['Location', location],
    duration ? ['Duration', duration] : null,
    resourcePerson ? ['Resource Person', resourcePerson] : null,
    seminar.mandatory ? ['Attendance', 'Mandatory'] : null,
  ].filter(Boolean);

  const detailsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 18px; border-collapse: separate; border-spacing: 0;">
      ${detailsRows.map(([label, value]) => `
        <tr>
          <td style="padding: 8px 0; font-family:${SANS}; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: ${COLORS.muted}; font-weight: 600; width: 140px; vertical-align: top;">
            ${label}
          </td>
          <td style="padding: 8px 0; font-family:${SANS}; font-size: 15px; color: ${COLORS.text}; border-bottom: 1px solid #eef0f5;">
            ${value}
          </td>
        </tr>`).join('')}
    </table>`;

  const descriptionHtml = seminar.description
    ? `<p style="margin: 0 0 14px; font-family:${SANS}; font-size: 15px; line-height: 1.65; color:${COLORS.text};">${seminar.description}</p>`
    : '';

  const html = buildEmail({
    preheader: `New GAD seminar announced: "${seminarTitle}".`,
    heading: 'A new GAD seminar has been announced',
    intro: `The GAD Office has just announced a new seminar. Sign in to GIMS to review the details and reserve your slot.`,
    highlight: {
      label: 'New seminar',
      value: seminarTitle,
      caption: dateStr,
    },
    body: `${descriptionHtml}
      <p style="margin: 0 0 10px;"><strong style="color:${COLORS.navyDeep};">Session details</strong></p>
      ${detailsHtml}
      <p style="margin: 0; font-family:${SANS}; font-size: 14px; color:${COLORS.muted};">
        Open GIMS and visit the Seminars section to pre-register.
      </p>`,
  });

  const text = `A new GAD seminar has been announced: "${seminarTitle}".\n\nDate: ${dateStr}${timeStr ? `\nStart Time: ${timeStr}` : ''}\nLocation: ${location}${duration ? `\nDuration: ${duration}` : ''}${resourcePerson ? `\nResource Person: ${resourcePerson}` : ''}\n\nSign in to GIMS to reserve your slot.\n\n— Xavier University GAD Office`;

  // Chunk BCC recipients to avoid spam-trigger thresholds and stay well under
  // Brevo's per-message recipient cap.
  const CHUNK = 50;
  let sent = 0;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    try {
      await sendMailViaAPI({
        to: 'kiethlybangamu@gmail.com', // sender mailbox; real recipients are BCC'd
        bcc: chunk,
        subject: `New GAD Seminar: ${seminarTitle}`,
        text,
        html,
      });
      sent += chunk.length;
    } catch (err) {
      console.error('New-seminar announcement chunk failed:', err.message);
    }
  }
  return { sent };
};

// =========================================================================
// Bulk reminder runner
// =========================================================================

export const sendBulkReminders = async () => {
  const employees = await Employee.find();
  const activeSeminars = await Seminar.find({ isDeleted: { $ne: true } }).select('_id').lean();
  const activeSeminarIdSet = new Set(activeSeminars.map((s) => String(s._id)));

  const countActiveAttended = (seminarIds) => {
    if (!Array.isArray(seminarIds) || seminarIds.length === 0) return 0;
    const unique = new Set(seminarIds.map((id) => String(id)));
    let count = 0;
    unique.forEach((id) => {
      if (activeSeminarIdSet.has(id)) count += 1;
    });
    return count;
  };

  let sent = 0;

  for (const employee of employees) {
    const required = Number(employee.requiredSeminarsPerYear || 5);
    const completed = countActiveAttended(employee.seminarsAttended);
    const remaining = required - completed;
    if (remaining > 0) {
      try {
        await sendReminderEmail(employee, remaining);
        sent += 1;
      } catch (err) {
        console.error(`Failed to email ${employee.email}`, err.message);
      }
    }
  }

  return { sent };
};
