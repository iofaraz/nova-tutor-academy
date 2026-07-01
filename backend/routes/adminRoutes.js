const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { sendNotification } = require("../config/mailer");
const { createIpRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();
/*! Production note: replace this in-memory session map with Redis or another shared store when you deploy more than one app instance. */
const sessions = new Map();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const loginAttempts = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many failed sign-in attempts. Please try again later.",
});
const SESSION_DURATION_MS =
  Number(process.env.ADMIN_SESSION_HOURS || 8) * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "nova_admin_session";
const CSRF_COOKIE_NAME = "nova_admin_csrf";
const isProduction = process.env.NODE_ENV === "production";
/*! Production note: set ADMIN_COOKIE_SECURE=true whenever the app is served over HTTPS behind a proxy or load balancer. */
const cookieSecure = process.env.ADMIN_COOKIE_SECURE
  ? process.env.ADMIN_COOKIE_SECURE === "true"
  : isProduction;
const facultyImageDirectory = path.join(__dirname, "..", "public", "images", "faculty");
/*! Production note: ensure /uploads/cvs directory exists and is writable. For cloud deployments, migrate to cloud storage (S3, GCS, etc.). */
const cvDirectory = path.join(__dirname, "..", "uploads", "cvs");

function clean(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
}

function cleanNumeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseImageDataUrl(imageDataUrl) {
  if (!imageDataUrl) return null;
  const match = String(imageDataUrl).match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );
  if (!match) {
    throw new Error("Faculty image must be a PNG, JPG, JPEG, WEBP, or GIF file.");
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("Faculty image must be 2 MB or smaller.");
  }

  return { mimeType, buffer };
}

function fileExtensionForMime(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

function issueSession(admin) {
  const token = crypto.randomBytes(48).toString("hex");
  const csrfToken = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    adminId: admin.id || null,
    username: admin.username,
    expiresAt: Date.now() + SESSION_DURATION_MS,
    csrfToken,
  });
  return { token, csrfToken };
}

function removeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return cookies;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies[SESSION_COOKIE_NAME]) {
    return { token: cookies[SESSION_COOKIE_NAME], source: "cookie" };
  }

  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme === "Bearer" && token) {
    return { token, source: "bearer" };
  }

  return { token: null, source: null };
}

function clearAdminCookies(res) {
  const expiredDate = new Date(0);
  res.append("Set-Cookie", [
    `${SESSION_COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Expires=${expiredDate.toUTCString()}; Max-Age=0${cookieSecure ? "; Secure" : ""}`,
    `${CSRF_COOKIE_NAME}=; Path=/; SameSite=Strict; Expires=${expiredDate.toUTCString()}; Max-Age=0${cookieSecure ? "; Secure" : ""}`,
  ]);
}

function setAdminCookies(res, session) {
  const sessionExpires = new Date(Date.now() + SESSION_DURATION_MS).toUTCString();
  const sessionCookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Expires=${sessionExpires}`,
    `Max-Age=${Math.max(Math.floor(SESSION_DURATION_MS / 1000), 1)}`,
  ];
  const csrfCookie = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(session.csrfToken)}`,
    "Path=/",
    "SameSite=Strict",
    `Expires=${sessionExpires}`,
    `Max-Age=${Math.max(Math.floor(SESSION_DURATION_MS / 1000), 1)}`,
  ];

  if (cookieSecure) {
    sessionCookie.push("Secure");
    csrfCookie.push("Secure");
  }

  res.append("Set-Cookie", [sessionCookie.join("; "), csrfCookie.join("; ")]);
}

function readCsrfToken(req) {
  return (
    req.get("x-csrf-token") ||
    req.get("x-xsrf-token") ||
    req.body?._csrf ||
    ""
  );
}

function requireAdmin(req, res, next) {
  removeExpiredSessions();
  const { token, source } = readSessionToken(req);

  if (!token) {
    return res.status(401).json({ message: "Administrator sign-in is required." });
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ message: "Your session has expired." });
  }

  req.admin = session;
  req.adminToken = token;
  req.adminAuthSource = source;
  return next();
}

function requireAdminCsrf(req, res, next) {
  if (req.adminAuthSource !== "cookie") {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = readCsrfToken(req);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      message: "Your admin session could not be verified. Please sign in again.",
    });
  }

  const session = sessions.get(req.adminToken);
  if (!session || session.csrfToken !== csrfCookie) {
    return res.status(403).json({
      message: "Your admin session could not be verified. Please sign in again.",
    });
  }

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

  /*! Production note: use a hashed admin_users table for long-term production admin accounts; the env fallback is for quick bootstrap only. */
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

function resolveCvPath(cvPath) {
  if (!cvPath) return null;
  const absolutePath = path.resolve(cvDirectory, String(cvPath));
  const normalizedDirectory = path.resolve(cvDirectory);
  if (
    absolutePath !== normalizedDirectory &&
    !absolutePath.startsWith(normalizedDirectory + path.sep)
  ) {
    return null;
  }
  return absolutePath;
}

async function removeCv(cvPath) {
  const absolutePath = resolveCvPath(cvPath);
  if (!absolutePath) return;
  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") {
      console.warn("Unable to delete tutor CV:", error.message);
    }
  });
}

async function sendApprovalConfirmation({
  recipient,
  subject,
  heading,
  intro,
  details,
  footer,
}) {
  if (!recipient) return "skipped";

  try {
    const result = await sendNotification({
      to: recipient,
      subject,
      heading,
      intro,
      details,
      footer,
    });
    return result?.skipped ? "skipped" : "sent";
  } catch (error) {
    console.warn("Approval confirmation email failed:", error.message);
    return "failed";
  }
}

function approvalMessage(recordLabel, emailStatus) {
  if (emailStatus === "sent") {
    return `${recordLabel} approved successfully. A confirmation email has been sent.`;
  }
  if (emailStatus === "skipped") {
    return `${recordLabel} approved successfully. Email confirmation is not configured right now.`;
  }
  return `${recordLabel} approved successfully, but the confirmation email could not be sent right now.`;
}

function resolveFacultyImagePath(imagePath) {
  if (!imagePath) return null;
  const normalizedPath = String(imagePath).replace(/^\/+/, "");
  const absolutePath = path.resolve(path.join(__dirname, "..", "public"), normalizedPath);
  const normalizedDirectory = path.resolve(facultyImageDirectory);

  if (!absolutePath.startsWith(normalizedDirectory + path.sep) && absolutePath !== normalizedDirectory) {
    return null;
  }

  return absolutePath;
}

async function saveFacultyImage(name, imageDataUrl) {
  if (!imageDataUrl) return null;

  const parsed = parseImageDataUrl(imageDataUrl);
  await fs.mkdir(facultyImageDirectory, { recursive: true });
  const safeBaseName =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "faculty";
  const extension = fileExtensionForMime(parsed.mimeType);
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const fileName = `${safeBaseName}-${uniqueSuffix}.${extension}`;
  const absolutePath = path.join(facultyImageDirectory, fileName);
  await fs.writeFile(absolutePath, parsed.buffer);

  return {
    publicPath: `/images/faculty/${fileName}`,
    absolutePath,
  };
}

async function removeFacultyImage(imagePath) {
  const absolutePath = resolveFacultyImagePath(imagePath);
  if (!absolutePath) return;

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to delete faculty image:", error.message);
    }
  }
}

router.get("/faculty", requireAdmin, async (req, res, next) => {
  try {
    const faculty = await fetchRows(
      `SELECT id, name, qualification, experience_years, subjects, city, profile_note,
              image_path, display_order, is_active, created_at
       FROM faculty_members
       ORDER BY display_order ASC, experience_years DESC, name ASC`
    );
    return res.json({ faculty });
  } catch (error) {
    return next(error);
  }
});

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

    const session = issueSession(admin);
    setAdminCookies(res, session);
    return res.json({
      message: "Signed in successfully.",
      csrfToken: session.csrfToken,
      expiresIn: SESSION_DURATION_MS,
      admin: { username: admin.username },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/session", requireAdmin, (req, res) => {
  return res.json({
    admin: {
      username: req.admin.username,
      expiresIn: Math.max(req.admin.expiresAt - Date.now(), 0),
    },
  });
});

router.post("/logout", requireAdmin, requireAdminCsrf, (req, res) => {
  sessions.delete(req.adminToken);
  clearAdminCookies(res);
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

router.post("/students/:id/approve", requireAdmin, requireAdminCsrf, async (req, res, next) => {
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

    const emailStatus = await sendApprovalConfirmation({
      recipient: request.email,
      subject: "Your tutor request has been approved",
      heading: "Tutor request approved",
      intro:
        "Good news! Your tutoring request has been reviewed, approved, and confirmed by Nova Tutor Academy.",
      details: {
        Name: request.name,
        "Tutor type": request.tutor_type,
        "Class / level": request.class_level,
        Subjects: request.subjects,
        City: request.city,
      },
      footer:
        "Our team will contact you with the next steps and suitable tutor options. If you need to update any details, reply to this email.",
    });

    return res.json({
      message: approvalMessage("Student request", emailStatus),
      student: request,
      emailStatus,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/students/:id/reject", requireAdmin, requireAdminCsrf, async (req, res, next) => {
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

router.delete("/students/approved/:id", requireAdmin, requireAdminCsrf, async (req, res, next) => {
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
              qualification, availability, cv_original_name, submitted_at
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
              qualification, availability, cv_original_name, approved_by, approved_at
       FROM teachers
       ORDER BY approved_at DESC, id DESC`
    );
    return res.json({ teachers });
  } catch (error) {
    return next(error);
  }
});

router.get("/teachers/:status/:id/cv", requireAdmin, async (req, res, next) => {
  const teacherId = Number(req.params.id);
  const table =
    req.params.status === "pending"
      ? "teacher_applications"
      : req.params.status === "approved"
        ? "teachers"
        : null;

  if (!table || !Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: "Invalid CV request." });
  }

  try {
    const rows = await fetchRows(
      `SELECT cv_path, cv_original_name FROM ${table} WHERE id = ? LIMIT 1`,
      [teacherId]
    );
    const cv = rows[0];
    const absolutePath = resolveCvPath(cv?.cv_path);
    if (!cv || !absolutePath) {
      return res.status(404).json({ message: "CV not found." });
    }

    await fs.access(absolutePath);
    if (req.query.format === "json") {
      const extension = path.extname(absolutePath).toLowerCase();
      const mimeTypes = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const file = await fs.readFile(absolutePath);
      return res.json({
        fileName: cv.cv_original_name || path.basename(absolutePath),
        mimeType: mimeTypes[extension] || "application/octet-stream",
        data: file.toString("base64"),
      });
    }
    return res.download(absolutePath, cv.cv_original_name || path.basename(absolutePath));
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({ message: "CV file not found." });
    }
    return next(error);
  }
});

router.post("/teachers/:id/approve", requireAdmin, requireAdminCsrf, async (req, res, next) => {
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
        "cv_path",
        "cv_original_name",
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
        "cv_path",
        "cv_original_name",
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Teacher application not found." });
    }

    const emailStatus = await sendApprovalConfirmation({
      recipient: request.email,
      subject: "Your tutor application has been approved",
      heading: "Tutor application approved",
      intro:
        "Congratulations! Your tutor application has been reviewed, approved, and confirmed by Nova Tutor Academy.",
      details: {
        Name: request.name,
        Subjects: request.subjects,
        Qualification: request.qualification,
        Experience:
          request.experience_years === null
            ? "Not specified"
            : `${request.experience_years} year(s)`,
        City: request.city,
      },
      footer:
        "Our team will contact you when a suitable tutoring opportunity is available. Please reply to this email if any profile details change.",
    });

    return res.json({
      message: approvalMessage("Teacher application", emailStatus),
      teacher: request,
      emailStatus,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/teachers/:id/reject", requireAdmin, requireAdminCsrf, async (req, res, next) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: "Invalid teacher application id." });
  }

  try {
    const rows = await fetchRows(
      "SELECT cv_path FROM teacher_applications WHERE id = ? LIMIT 1",
      [requestId]
    );
    const deleted = await deleteRow("teacher_applications", requestId);
    if (!deleted) {
      return res.status(404).json({ message: "Teacher application not found." });
    }
    await removeCv(rows[0]?.cv_path);
    return res.json({ message: "Teacher application rejected and removed." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/teachers/approved/:id", requireAdmin, requireAdminCsrf, async (req, res, next) => {
  const teacherId = Number(req.params.id);
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({ message: "Invalid teacher record id." });
  }

  try {
    const rows = await fetchRows(
      "SELECT cv_path FROM teachers WHERE id = ? LIMIT 1",
      [teacherId]
    );
    const deleted = await deleteRow("teachers", teacherId);
    if (!deleted) {
      return res.status(404).json({ message: "Teacher record not found." });
    }
    await removeCv(rows[0]?.cv_path);
    return res.json({ message: "Teacher record permanently deleted." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/faculty/:id", requireAdmin, requireAdminCsrf, async (req, res, next) => {
  const facultyId = Number(req.params.id);
  if (!Number.isInteger(facultyId) || facultyId <= 0) {
    return res.status(400).json({ message: "Invalid faculty id." });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT image_path FROM faculty_members WHERE id = ? LIMIT 1",
      [facultyId]
    );
    const faculty = rows[0];
    if (!faculty) {
      return res.status(404).json({ message: "Faculty member not found." });
    }

    const deleted = await deleteRow("faculty_members", facultyId);
    if (!deleted) {
      return res.status(404).json({ message: "Faculty member not found." });
    }

    await removeFacultyImage(faculty.image_path);

    return res.json({ message: "Faculty member deleted permanently." });
  } catch (error) {
    return next(error);
  }
});

router.put("/faculty/:id", requireAdmin, requireAdminCsrf, async (req, res, next) => {
  const facultyId = Number(req.params.id);
  if (!Number.isInteger(facultyId) || facultyId <= 0) {
    return res.status(400).json({ message: "Invalid faculty id." });
  }

  const name = clean(req.body.name, 100);
  const qualification = clean(req.body.qualification, 200);
  const subjects = clean(req.body.subjects, 255);
  const city = clean(req.body.city, 100);
  const profileNote = clean(req.body.profile_note, 5000);
  const displayOrder = cleanNumeric(req.body.display_order, 100);
  const experienceYears = cleanNumeric(req.body.experience_years, 0);
  const imageDataUrl = clean(req.body.image_data_url, 5000000);
  const isActive = req.body.is_active === undefined ? true : Boolean(req.body.is_active);

  if (!name || !qualification || !subjects) {
    return res.status(400).json({
      message: "Name, qualification, and subjects are required.",
    });
  }

  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 1000) {
    return res.status(400).json({
      message: "Display order must be a whole number between 0 and 1000.",
    });
  }

  if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
    return res.status(400).json({
      message: "Experience must be a whole number between 0 and 80.",
    });
  }

  let savedImage = null;
  try {
    const [rows] = await pool.execute(
      "SELECT image_path FROM faculty_members WHERE id = ? LIMIT 1",
      [facultyId]
    );
    const faculty = rows[0];
    if (!faculty) {
      return res.status(404).json({ message: "Faculty member not found." });
    }

    savedImage = await saveFacultyImage(name, imageDataUrl);
    const imagePath = savedImage?.publicPath || faculty.image_path || null;
    const [result] = await pool.execute(
      `UPDATE faculty_members
       SET name = ?, qualification = ?, experience_years = ?, subjects = ?,
           city = ?, profile_note = ?, image_path = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        name,
        qualification,
        experienceYears,
        subjects,
        city || null,
        profileNote || null,
        imagePath,
        displayOrder,
        isActive ? 1 : 0,
        facultyId,
      ]
    );

    if (result.affectedRows === 0) {
      if (savedImage) await removeFacultyImage(savedImage.publicPath);
      return res.status(404).json({ message: "Faculty member not found." });
    }

    if (savedImage && faculty.image_path) {
      await removeFacultyImage(faculty.image_path);
    }

    return res.json({
      message: "Faculty member updated successfully.",
      facultyId,
      imagePath,
    });
  } catch (error) {
    if (savedImage) await removeFacultyImage(savedImage.publicPath);
    return next(error);
  }
});

router.post("/faculty", requireAdmin, requireAdminCsrf, async (req, res, next) => {
  const name = clean(req.body.name, 100);
  const qualification = clean(req.body.qualification, 200);
  const subjects = clean(req.body.subjects, 255);
  const city = clean(req.body.city, 100);
  const profileNote = clean(req.body.profile_note, 5000);
  const displayOrder = cleanNumeric(req.body.display_order, 100);
  const experienceYears = cleanNumeric(req.body.experience_years, 0);
  const imageDataUrl = clean(req.body.image_data_url, 5000000);
  const isActive = req.body.is_active === undefined ? true : Boolean(req.body.is_active);

  if (!name || !qualification || !subjects) {
    return res.status(400).json({
      message: "Name, qualification, and subjects are required.",
    });
  }

  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 1000) {
    return res.status(400).json({
      message: "Display order must be a whole number between 0 and 1000.",
    });
  }

  if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 80) {
    return res.status(400).json({
      message: "Experience must be a whole number between 0 and 80.",
    });
  }

  let savedImage = null;
  try {
    savedImage = await saveFacultyImage(name, imageDataUrl);
    const [result] = await pool.execute(
      `INSERT INTO faculty_members
        (name, qualification, experience_years, subjects, city, profile_note, image_path, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        qualification,
        experienceYears,
        subjects,
        city || null,
        profileNote || null,
        savedImage?.publicPath || null,
        displayOrder,
        isActive ? 1 : 0,
      ]
    );

    return res.status(201).json({
      message: "Faculty member added successfully.",
      facultyId: result.insertId,
      imagePath: savedImage?.publicPath || null,
    });
  } catch (error) {
    if (savedImage) await removeFacultyImage(savedImage.publicPath);
    return next(error);
  }
});

module.exports = router;
