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
    "Too many contact messages were submitted from this connection. Please wait a little and try again.",
});

const allowedTopics = new Set([
  "Finding a Tutor",
  "Teaching with Nova",
  "General Information",
  "Other",
]);

router.post("/", submissionLimiter, async (req, res, next) => {
  const inquiry = {
    name: cleanText(req.body.name, 100),
    phone: cleanText(req.body.phone, 20, { allowEmpty: true }),
    email: normalizeEmail(req.body.email),
    topic: cleanText(req.body.topic, 80),
    message: cleanText(req.body.message, 5000),
  };

  const errors = [];
  if (!inquiry.name) {
    addFieldError(errors, "name", "Name is required.");
  }
  if (!isValidEmail(inquiry.email)) {
    addFieldError(errors, "email", "Please enter a valid email address.");
  }
  if (inquiry.phone && !isValidPhone(inquiry.phone)) {
    addFieldError(errors, "phone", "Enter a valid phone number.");
  }
  if (!allowedTopics.has(inquiry.topic)) {
    addFieldError(errors, "topic", "Please select a valid topic.");
  }
  if (!inquiry.message) {
    addFieldError(errors, "message", "Please enter a message.");
  }

  if (errors.length) {
    return res.status(400).json({ message: errors[0].message, errors });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO contact_messages
        (name, phone, email, topic, message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        inquiry.name,
        inquiry.phone || null,
        inquiry.email,
        inquiry.topic,
        inquiry.message,
      ]
    );

    /*! Production note: MAIL_USER is used as the admin email recipient. Set MAIL_USER env variable to your admin's email address for production. */
    const adminEmail = process.env.MAIL_USER;
    const emailResult = await sendSubmissionEmails(
      [
        adminEmail && {
          to: adminEmail,
          subject: `New contact message: ${inquiry.topic}`,
          heading: "New contact message",
          intro: "A website visitor submitted the contact form.",
          replyTo: inquiry.email,
          details: {
            Name: inquiry.name,
            Email: inquiry.email,
            Phone: inquiry.phone || "Not provided",
            Topic: inquiry.topic,
            Message: inquiry.message,
          },
          footer:
            "Reply to the sender or follow up with the relevant team member when needed.",
        },
        {
          to: inquiry.email,
          subject: "We received your message",
          heading: "Message received",
          intro:
            "Thank you for contacting Nova Tutor Academy. We have received your message and will get back to you soon.",
          details: {
            Name: inquiry.name,
            Topic: inquiry.topic,
          },
          footer:
            "If you need to add more details, simply reply to this email.",
        },
      ].filter(Boolean)
    );

    return res.status(201).json({
      message: emailResult?.sent
        ? "Your message has been sent and a confirmation email has been sent."
        : emailResult?.skipped
          ? "Your message has been sent. Email confirmations are not configured right now."
          : "Your message has been sent, but the confirmation email could not be sent right now.",
      messageId: result.insertId,
      emailStatus: emailResult?.skipped ? "skipped" : emailResult?.sent ? "sent" : "partial",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
