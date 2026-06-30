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
} = require("../utils/validation");

const router = express.Router();
const submissionLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message:
    "Too many tutor requests were submitted from this connection. Please wait a little and try again.",
});

const allowedCities = new Set([
  "Islamabad/Rawalpindi",
  "Lahore",
  "Karachi",
  "Other",
]);
const allowedTutorTypes = new Set(["Home", "Online", "International"]);

router.post("/request", submissionLimiter, async (req, res, next) => {
  const request = {
    name: cleanText(req.body.name, 100),
    phone: cleanText(req.body.phone, 20),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 40),
    tutor_type: cleanText(req.body.tutor_type, 20),
    class_level: cleanText(req.body.class_level, 50),
    curriculum: cleanText(req.body.curriculum, 100, { allowEmpty: true }),
    subjects: cleanText(req.body.subjects, 2000),
    notes: cleanText(req.body.notes, 5000, { allowEmpty: true }),
  };

  const errors = [];
  if (!request.name) addFieldError(errors, "name", "Name is required.");
  if (!isValidPhone(request.phone)) {
    addFieldError(errors, "phone", "Enter a valid phone number.");
  }
  if (!isValidEmail(request.email)) {
    addFieldError(errors, "email", "Please enter a valid email address.");
  }
  if (!allowedCities.has(request.city)) {
    addFieldError(errors, "city", "Please select a valid city.");
  }
  if (!allowedTutorTypes.has(request.tutor_type)) {
    addFieldError(errors, "tutor_type", "Please select a valid tutor type.");
  }
  if (!request.class_level) {
    addFieldError(errors, "class_level", "Class or level is required.");
  }
  if (!request.subjects) {
    addFieldError(errors, "subjects", "At least one subject is required.");
  }

  if (errors.length) {
    return res.status(400).json({ message: errors[0].message, errors });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO student_requests
        (name, phone, email, city, tutor_type, class_level, curriculum, subjects, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.name,
        request.phone,
        request.email || null,
        request.city,
        request.tutor_type,
        request.class_level,
        request.curriculum || null,
        request.subjects,
        request.notes || null,
      ]
    );

    const adminEmail = process.env.MAIL_USER;
    const emailResult = await sendSubmissionEmails(
      [
        adminEmail && {
          to: adminEmail,
          subject: `New tutor request: ${request.name}`,
          heading: "New student tutor request",
          intro: "A new tutoring request has been submitted through the website.",
          replyTo: request.email,
          details: {
            "Request ID": result.insertId,
            Name: request.name,
            Phone: request.phone,
            Email: request.email,
            City: request.city,
            "Tutor type": request.tutor_type,
            "Class / level": request.class_level,
            Curriculum: request.curriculum || "Not specified",
            Subjects: request.subjects,
            Notes: request.notes || "No additional notes",
          },
          footer:
            "This submission was created from the Nova Tutor Academy request form. Follow up with the candidate when appropriate.",
        },
        {
          to: request.email,
          subject: "We received your tutor request",
          heading: "Tutor request received",
          intro:
            "Thank you for reaching out. We have received your request and will contact you soon with suitable tutor options.",
          details: {
            Name: request.name,
            City: request.city,
            "Tutor type": request.tutor_type,
            "Class / level": request.class_level,
            Subjects: request.subjects,
          },
          footer:
            "If you need to update any details, simply reply to this email and our team will help.",
        },
      ].filter(Boolean)
    );

    return res.status(201).json({
      message: emailResult?.sent
        ? "Tutor request submitted successfully. A confirmation email has been sent."
        : emailResult?.skipped
          ? "Tutor request submitted successfully. Email confirmations are not configured right now."
          : "Tutor request submitted successfully, but the confirmation email could not be sent right now.",
      requestId: result.insertId,
      emailStatus: emailResult?.skipped ? "skipped" : emailResult?.sent ? "sent" : "partial",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
