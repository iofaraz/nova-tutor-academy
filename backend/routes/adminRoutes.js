const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { createIpRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const sessions = new Map();
const loginAttempts = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many failed sign-in attempts. Please try again later.",
});
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

async function fetchRows(query, params = []) {
  const [rows] = await pool.execute(query, params);
  return rows;
}

async function moveRequestToApproved({
  requestTable,
  approvedTable,
  requestId,
  approvedBy,
  insertColumns,
  selectColumns,
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT ${selectColumns.join(", ")} FROM ${requestTable} WHERE id = ? LIMIT 1 FOR UPDATE`,
      [requestId]
    );

    const request = rows[0];
    if (!request) {
      await connection.rollback();
      return null;
    }

    const insertValues = insertColumns.map((column) => request[column]);
    await connection.execute(
      `INSERT INTO ${approvedTable}
        (${insertColumns.join(", ")}, approved_by)
       VALUES (${insertColumns.map(() => "?").join(", ")}, ?)`,
      [...insertValues, approvedBy]
    );

    await connection.execute(`DELETE FROM ${requestTable} WHERE id = ?`, [requestId]);
    await connection.commit();
    return request;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRow(table, id) {
  const [result] = await pool.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

router.post("/login", loginAttempts, async (req, res, next) => {
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
    const students = await fetchRows(
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

router.get("/students/approved", requireAdmin, async (req, res, next) => {
  try {
    const students = await fetchRows(
      `SELECT id, source_request_id, name, phone, email, city, tutor_type, class_level,
              curriculum, subjects, notes, approved_by, approved_at
       FROM students
       ORDER BY approved_at DESC, id DESC`
    );
    return res.json({ students });
  } catch (error) {
    return next(error);
  }
});

router.post("/students/:id/approve", requireAdmin, async (req, res, next) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: "Invalid student request id." });
  }

  try {
    const request = await moveRequestToApproved({
      requestTable: "student_requests",
      approvedTable: "students",
      requestId,
      approvedBy: req.admin.username,
      insertColumns: [
        "source_request_id",
        "name",
        "phone",
        "email",
        "city",
        "tutor_type",
        "class_level",
        "curriculum",
        "subjects",
        "notes",
      ],
      selectColumns: [
        "id AS source_request_id",
        "name",
        "phone",
        "email",
        "city",
        "tutor_type",
        "class_level",
        "curriculum",
        "subjects",
        "notes",
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Student request not found." });
    }

    return res.json({
      message: "Student request approved successfully.",
      student: request,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/students/:id/reject", requireAdmin, async (req, res, next) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: "Invalid student request id." });
  }

  try {
    const deleted = await deleteRow("student_requests", requestId);
    if (!deleted) {
      return res.status(404).json({ message: "Student request not found." });
    }
    return res.json({ message: "Student request rejected and removed." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/students/approved/:id", requireAdmin, async (req, res, next) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ message: "Invalid student record id." });
  }

  try {
    const deleted = await deleteRow("students", studentId);
    if (!deleted) {
      return res.status(404).json({ message: "Student record not found." });
    }
    return res.json({ message: "Student record permanently deleted." });
  } catch (error) {
    return next(error);
  }
});

router.get("/teachers", requireAdmin, async (req, res, next) => {
  try {
    const teachers = await fetchRows(
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

router.get("/teachers/approved", requireAdmin, async (req, res, next) => {
  try {
    const teachers = await fetchRows(
      `SELECT id, source_request_id, name, phone, email, city, subjects, experience_years,
              qualification, availability, approved_by, approved_at
       FROM teachers
       ORDER BY approved_at DESC, id DESC`
    );
    return res.json({ teachers });
  } catch (error) {
    return next(error);
  }
});

router.post("/teachers/:id/approve", requireAdmin, async (req, res, next) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: "Invalid teacher application id." });
  }

  try {
    const request = await moveRequestToApproved({
      requestTable: "teacher_applications",
      approvedTable: "teachers",
      requestId,
      approvedBy: req.admin.username,
      insertColumns: [
        "source_request_id",
        "name",
        "phone",
        "email",
        "city",
        "subjects",
        "experience_years",
        "qualification",
        "availability",
      ],
      selectColumns: [
        "id AS source_request_id",
        "name",
        "phone",
        "email",
        "city",
        "subjects",
        "experience_years",
        "qualification",
        "availability",
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Teacher application not found." });
    }

    return res.json({
      message: "Teacher application approved successfully.",
      teacher: request,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/teachers/:id/reject", requireAdmin, async (req, res, next) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: "Invalid teacher application id." });
  }

  try {
    const deleted = await deleteRow("teacher_applications", requestId);
    if (!deleted) {
      return res.status(404).json({ message: "Teacher application not found." });
    }
    return res.json({ message: "Teacher application rejected and removed." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/teachers/approved/:id", requireAdmin, async (req, res, next) => {
  const teacherId = Number(req.params.id);
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: "Invalid teacher record id." });
  }

  try {
    const deleted = await deleteRow("teachers", teacherId);
    if (!deleted) {
      return res.status(404).json({ message: "Teacher record not found." });
    }
    return res.json({ message: "Teacher record permanently deleted." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
