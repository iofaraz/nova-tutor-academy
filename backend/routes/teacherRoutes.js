const express = require("express");
const { pool } = require("../config/db");
const { sendNotification } = require("../config/mailer");

const router = express.Router();
const allowedCities = new Set([
  "Islamabad/Rawalpindi",
  "Lahore",
  "Karachi",
]);

function clean(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/apply", async (req, res, next) => {
  const experienceValue =
    req.body.experience_years === "" ||
    req.body.experience_years === undefined ||
    req.body.experience_years === null
      ? null
      : Number(req.body.experience_years);

  const application = {
    name: clean(req.body.name, 100),
    phone: clean(req.body.phone, 20),
    email: clean(req.body.email, 150),
    city: clean(req.body.city, 40),
    subjects: clean(req.body.subjects, 2000),
    experience_years: experienceValue,
    qualification: clean(req.body.qualification, 200),
    availability: clean(req.body.availability, 100),
  };

  const errors = [];
  if (!application.name) errors.push("Name is required.");
  if (!application.phone) errors.push("Phone number is required.");
  if (!allowedCities.has(application.city)) errors.push("Please select a valid city.");
  if (!application.subjects) errors.push("Subjects and levels are required.");
  if (!application.qualification) errors.push("Qualification is required.");
  if (!application.availability) errors.push("Availability is required.");
  if (!isValidEmail(application.email)) {
    errors.push("Please enter a valid email address.");
  }
  if (
    application.experience_years !== null &&
    (!Number.isInteger(application.experience_years) ||
      application.experience_years < 0 ||
      application.experience_years > 60)
  ) {
    errors.push("Experience must be a whole number between 0 and 60.");
  }

  if (errors.length) {
    return res.status(400).json({ message: errors[0], errors });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO teacher_applications
        (name, phone, email, city, subjects, experience_years, qualification, availability)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        application.name,
        application.phone,
        application.email || null,
        application.city,
        application.subjects,
        application.experience_years,
        application.qualification,
        application.availability,
      ]
    );

    sendNotification({
      subject: `New tutor application: ${application.name}`,
      heading: "New teacher application",
      replyTo: application.email,
      details: {
        "Application ID": result.insertId,
        Name: application.name,
        Phone: application.phone,
        Email: application.email,
        City: application.city,
        Subjects: application.subjects,
        "Experience (years)": application.experience_years,
        Qualification: application.qualification,
        Availability: application.availability,
      },
    }).catch((error) => {
      console.error("Teacher notification email failed:", error.message);
    });

    return res.status(201).json({
      message: "Teacher application submitted successfully.",
      applicationId: result.insertId,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
