const nodemailer = require("nodemailer");

const mailEnabled = Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);

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

async function sendNotification({ subject, heading, details, replyTo }) {
  if (!transporter) {
    console.info("Email notification skipped: mail credentials are not configured.");
    return { skipped: true };
  }

  const recipient = process.env.MAIL_TO || process.env.MAIL_USER;
  return transporter.sendMail({
    from: `"Nova Tutor Academy" <${process.env.MAIL_USER}>`,
    to: recipient,
    replyTo: replyTo || undefined,
    subject,
    text: [
      heading,
      "",
      ...Object.entries(details)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([label, value]) => `${label}: ${value}`),
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">
        <div style="padding:22px 26px;background:#0b1f47;color:#fff;border-radius:14px 14px 0 0">
          <h2 style="margin:0;color:#fff">${escapeHtml(heading)}</h2>
        </div>
        <div style="padding:18px 14px;border:1px solid #e5eaf1;border-top:0;border-radius:0 0 14px 14px">
          ${detailsTable(details)}
        </div>
      </div>`,
  });
}

async function verifyMailer() {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}

module.exports = { sendNotification, verifyMailer, mailEnabled };
