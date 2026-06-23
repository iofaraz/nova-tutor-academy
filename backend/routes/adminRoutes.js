const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");

const router = express.Router();
const sessions = new Map();
const SESSION_DURATION_MS =
  Number(process.env.ADMIN_SESSION_HOURS || 8) * 60 * 60 * 1000;

function clean(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
}

function issueSession(admin) {
  const token = crypto.randomBytes(48).toString("hex");
  sessions.set(token, {
    adminId: admin.id || null,
    username: admin.username,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });
  return token;
}

function removeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function requireAdmin(req, res, next) {
  removeExpiredSessions();
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Administrator sign-in is required." });
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ message: "Your session has expired." });
  }

  req.admin = session;
  req.adminToken = token;
  return next();
}

function safeStringMatch(first, second) {
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(first).digest(),
    crypto.createHash("sha256").update(second).digest()
  );
}

async function verifyAdminCredentials(username, password) {
  const environmentUsername = clean(process.env.ADMIN_USERNAME, 50);
  const environmentPassword = String(process.env.ADMIN_PASSWORD || "");

  if (environmentUsername && environmentPassword) {
    if (
      safeStringMatch(username, environmentUsername) &&
      safeStringMatch(password, environmentPassword)
    ) {
      return { id: null, username: environmentUsername };
    }
    return null;
  }

  const [rows] = await pool.execute(
    "SELECT id, username, password_hash FROM admin_users WHERE username = ? LIMIT 1",
    [username]
  );
  const admin = rows[0];
  if (!admin) return null;

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);
  return passwordMatches
    ? { id: admin.id, username: admin.username }
    : null;
}

router.post("/login", async (req, res, next) => {
  const username = clean(req.body.username, 50);
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  try {
    const admin = await verifyAdminCredentials(username, password);
    if (!admin) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = issueSession(admin);
    return res.json({
      message: "Signed in successfully.",
      token,
      expiresIn: SESSION_DURATION_MS,
      admin: { username: admin.username },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", requireAdmin, (req, res) => {
  sessions.delete(req.adminToken);
  return res.json({ message: "Signed out successfully." });
});

router.get("/students", requireAdmin, async (req, res, next) => {
  try {
    const [students] = await pool.execute(
      `SELECT id, name, phone, email, city, tutor_type, class_level,
              curriculum, subjects, notes, submitted_at
       FROM student_requests
       ORDER BY submitted_at DESC, id DESC`
    );
    return res.json({ students });
  } catch (error) {
    return next(error);
  }
});

router.get("/teachers", requireAdmin, async (req, res, next) => {
  try {
    const [teachers] = await pool.execute(
      `SELECT id, name, phone, email, city, subjects, experience_years,
              qualification, availability, submitted_at
       FROM teacher_applications
       ORDER BY submitted_at DESC, id DESC`
    );
    return res.json({ teachers });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
