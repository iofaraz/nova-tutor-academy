const nodemailer = require("nodemailer");

const mailEnabled = Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
// Set MAIL_FROM in production so admin and candidate emails are branded correctly.

const transporter = mailEnabled
  ? nodemailer.createTransport({
      service: process.env.MAIL_SERVICE || "gmail",
      host: process.env.MAIL_HOST || undefined,
      port: process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : undefined,
      secure:
        process.env.MAIL_SECURE === "true" ||
        Number(process.env.MAIL_PORT) === 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })
  : null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function detailsTable(details) {
  const rows = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5eaf1;font-weight:700;color:#0b1f47;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5eaf1;color:#46536b;white-space:pre-wrap">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  return `<table style="width:100%;border-collapse:collapse">${rows}</table>`;
}

function buildEmailHtml({ heading, intro, details, footer }) {
  return `
      <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:24px">
        <div style="max-width:680px;margin:auto;background:#ffffff;border:1px solid #e5eaf1;border-radius:16px;overflow:hidden;color:#172033">
          <div style="padding:22px 26px;background:linear-gradient(135deg,#0b1f47,#2b5ea7);color:#fff">
            <h2 style="margin:0;color:#fff;font-size:22px">${escapeHtml(heading)}</h2>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.86);font-size:14px;line-height:1.6">${escapeHtml(intro)}</p>
          </div>
          <div style="padding:20px 22px 12px">
            ${detailsTable(details)}
          </div>
          <div style="padding:0 22px 22px;color:#5a6782;font-size:13px;line-height:1.7">
            ${escapeHtml(footer)}
          </div>
        </div>
      </div>`;
}

async function sendNotification({
  to,
  subject,
  heading,
  intro,
  details,
  replyTo,
  footer,
}) {
  if (!transporter) {
    console.info("Email notification skipped: mail credentials are not configured.");
    return { skipped: true };
  }

  const recipient = to;
  return transporter.sendMail({
    from: `"Nova Tutor Academy" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
    to: recipient,
    replyTo: replyTo || undefined,
    subject,
    text: [
      heading,
      intro,
      "",
      ...Object.entries(details)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([label, value]) => `${label}: ${value}`),
      "",
      footer || "",
    ].join("\n"),
    html: buildEmailHtml({ heading, intro, details, footer }),
  });
}

async function verifyMailer() {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}

async function sendSubmissionEmails(messages) {
  if (!transporter) {
    return { skipped: true, results: [] };
  }

  const results = await Promise.allSettled(messages.map((message) => sendNotification(message)));
  return {
    sent: results.every((result) => result.status === "fulfilled"),
    results,
  };
}

module.exports = { sendNotification, sendSubmissionEmails, verifyMailer, mailEnabled };
