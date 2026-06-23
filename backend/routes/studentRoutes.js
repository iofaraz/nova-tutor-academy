const express = require("express");
const { pool } = require("../config/db");
const { sendNotification } = require("../config/mailer");

const router = express.Router();

const allowedCities = new Set([
  "Islamabad/Rawalpindi",
  "Lahore",
  "Karachi",
]);
const allowedTutorTypes = new Set(["Home", "Online", "International"]);

function clean(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/request", async (req, res, next) => {
  const request = {
    name: clean(req.body.name, 100),
    phone: clean(req.body.phone, 20),
    email: clean(req.body.email, 150),
    city: clean(req.body.city, 40),
    tutor_type: clean(req.body.tutor_type, 20),
    class_level: clean(req.body.class_level, 50),
    curriculum: clean(req.body.curriculum, 100),
    subjects: clean(req.body.subjects, 2000),
    notes: clean(req.body.notes, 5000),
  };

  const errors = [];
  if (!request.name) errors.push("Name is required.");
  if (!request.phone) errors.push("Phone number is required.");
  if (!allowedCities.has(request.city)) errors.push("Please select a valid city.");
  if (!allowedTutorTypes.has(request.tutor_type)) {
    errors.push("Please select a valid tutor type.");
  }
  if (!request.class_level) errors.push("Class or level is required.");
  if (!request.subjects) errors.push("At least one subject is required.");
  if (!isValidEmail(request.email)) errors.push("Please enter a valid email address.");

  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
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

    sendNotification({
      subject: `New tutor request: ${request.name}`,
      heading: "New student tutor request",
      replyTo: request.email,
      details: {
        "Request ID": result.insertId,
        Name: request.name,
        Phone: request.phone,
        Email: request.email,
        City: request.city,
        "Tutor type": request.tutor_type,
        "Class / level": request.class_level,
        Curriculum: request.curriculum,
        Subjects: request.subjects,
        Notes: request.notes,
      },
    }).catch((error) => {
      console.error("Student notification email failed:", error.message);
    });

    return res.status(201).json({
      message: "Tutor request submitted successfully.",
      requestId: result.insertId,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
