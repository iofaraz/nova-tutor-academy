const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const { pool } = require("../config/db");
const { sendSubmissionEmails } = require("../config/mailer");
const { createIpRateLimiter } = require("../middleware/rateLimit");
const {
  addFieldError,
  cleanText,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  parseOptionalInteger,
} = require("../utils/validation");

const router = express.Router();
const cvDirectory = path.join(__dirname, "..", "uploads", "cvs");
const MAX_CV_SIZE = 3 * 1024 * 1024;
const cvTypes = {
  pdf: new Set(["application/pdf", "application/octet-stream", ""]),
  doc: new Set(["application/msword", "application/octet-stream", ""]),
  docx: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "",
  ]),
};
const submissionLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message:
    "Too many teacher applications were submitted from this connection. Please wait a little and try again.",
});
const allowedCities = new Set([
  "Islamabad/Rawalpindi",
  "Lahore",
  "Karachi",
  "Other",
]);

function parseCv(cvData, originalName) {
  if (!cvData || !originalName) {
    throw new Error("Please upload your CV.");
  }

  const match = String(cvData).match(
    /^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/
  );
  const mimeType = match?.[1]?.toLowerCase();
  const extension = path.extname(String(originalName)).slice(1).toLowerCase();

  if (!match || !cvTypes[extension]?.has(mimeType)) {
    throw new Error("CV must be a PDF, DOC, or DOCX file.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_CV_SIZE) {
    throw new Error("CV must be 3 MB or smaller.");
  }

  const hasValidSignature =
    (extension === "pdf" && buffer.subarray(0, 5).toString() === "%PDF-") ||
    (extension === "doc" &&
      buffer.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))) ||
    (extension === "docx" && buffer.subarray(0, 2).toString() === "PK");

  if (!hasValidSignature) {
    throw new Error("The uploaded CV does not appear to be a valid document.");
  }

  return {
    buffer,
    extension,
    originalName: path.basename(String(originalName)).slice(0, 255),
  };
}

async function saveCv(name, cv) {
  await fs.mkdir(cvDirectory, { recursive: true });
  const safeName =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tutor";
  const fileName = `${safeName}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${cv.extension}`;
  await fs.writeFile(path.join(cvDirectory, fileName), cv.buffer, { flag: "wx" });
  return fileName;
}

router.post("/apply", submissionLimiter, async (req, res, next) => {
  const experienceValue = parseOptionalInteger(req.body.experience_years);

  const application = {
    name: cleanText(req.body.name, 100),
    phone: cleanText(req.body.phone, 20),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 40),
    subjects: cleanText(req.body.subjects, 2000),
    experience_years: experienceValue,
    qualification: cleanText(req.body.qualification, 200),
    availability: cleanText(req.body.availability, 100),
  };

  const errors = [];
  let cv;
  if (!application.name) {
    addFieldError(errors, "name", "Name is required.");
  }
  if (!isValidPhone(application.phone)) {
    addFieldError(errors, "phone", "Enter a valid phone number.");
  }
  if (!isValidEmail(application.email)) {
    addFieldError(errors, "email", "Please enter a valid email address.");
  }
  if (!allowedCities.has(application.city)) {
    addFieldError(errors, "city", "Please select a valid city.");
  }
  if (!application.subjects) {
    addFieldError(errors, "subjects", "Subjects and levels are required.");
  }
  if (!application.qualification) {
    addFieldError(errors, "qualification", "Qualification is required.");
  }
  if (!application.availability) {
    addFieldError(errors, "availability", "Availability is required.");
  }
  try {
    cv = parseCv(req.body.cv_data, req.body.cv_name);
  } catch (error) {
    addFieldError(errors, "cv", error.message);
  }
  if (
    application.experience_years !== null &&
    (!Number.isInteger(application.experience_years) ||
      application.experience_years < 0 ||
      application.experience_years > 60)
  ) {
    addFieldError(
      errors,
      "experience_years",
      "Experience must be a whole number between 0 and 60."
    );
  }

  if (errors.length) {
    return res.status(400).json({ message: errors[0].message, errors });
  }

  let savedCvPath;
  let applicationSaved = false;
  try {
    savedCvPath = await saveCv(application.name, cv);
    const [result] = await pool.execute(
      `INSERT INTO teacher_applications
        (name, phone, email, city, subjects, experience_years, qualification, availability,
         cv_path, cv_original_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        application.name,
        application.phone,
        application.email || null,
        application.city,
        application.subjects,
        application.experience_years,
        application.qualification,
        application.availability,
        savedCvPath,
        cv.originalName,
      ]
    );
    applicationSaved = true;

    const adminEmail = process.env.MAIL_USER;
    const emailResult = await sendSubmissionEmails(
      [
        adminEmail && {
          to: adminEmail,
          subject: `New tutor application: ${application.name}`,
          heading: "New teacher application",
          intro:
            "A new tutor application has been submitted through the website.",
          replyTo: application.email,
          details: {
            "Application ID": result.insertId,
            Name: application.name,
            Phone: application.phone,
            Email: application.email,
            City: application.city,
            Subjects: application.subjects,
            "Experience (years)":
              application.experience_years === null
                ? "Not specified"
                : application.experience_years,
            Qualification: application.qualification,
            Availability: application.availability,
            CV: `${cv.originalName} (available in the admin dashboard)`,
          },
          footer:
            "Review this application and reach out to the candidate if the profile matches current teaching needs.",
        },
        {
          to: application.email,
          subject: "We received your tutor application",
          heading: "Tutor application received",
          intro:
            "Thank you for applying. We have received your details and will review your profile soon. If there is a match, we will contact you directly.",
          details: {
            Name: application.name,
            City: application.city,
            Subjects: application.subjects,
            Qualification: application.qualification,
          },
          footer:
            "Please keep an eye on your inbox for follow-up communication from Nova Tutor Academy.",
        },
      ].filter(Boolean)
    );

    return res.status(201).json({
      message: emailResult?.sent
        ? "Teacher application submitted successfully. A confirmation email has been sent."
        : emailResult?.skipped
          ? "Teacher application submitted successfully. Email confirmations are not configured right now."
          : "Teacher application submitted successfully, but the confirmation email could not be sent right now.",
      applicationId: result.insertId,
      emailStatus: emailResult?.skipped ? "skipped" : emailResult?.sent ? "sent" : "partial",
    });
  } catch (error) {
    if (savedCvPath && !applicationSaved) {
      await fs.unlink(path.join(cvDirectory, savedCvPath)).catch(() => {});
    }
    return next(error);
  }
});

module.exports = router;
