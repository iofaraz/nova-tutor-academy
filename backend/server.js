const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  quiet: true,
});

const express = require("express");
const cors = require("cors");
const { testConnection } = require("./config/db");
const { verifyMailer, mailEnabled } = require("./config/mailer");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const frontendDirectory = path.join(__dirname, "..", "frontend");

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      const configuredOrigins = String(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (
        !origin ||
        configuredOrigins.length === 0 ||
        configuredOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("This origin is not allowed by CORS."));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", async (req, res) => {
  try {
    await testConnection();
    return res.json({
      status: "ok",
      database: "connected",
      mail: mailEnabled ? "configured" : "not configured",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      database: "disconnected",
      message: "The database is not available.",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use(express.static(path.join(frontendDirectory, "pages")));
app.use(express.static(frontendDirectory));
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDirectory, "pages", "index.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Invalid JSON request body." });
  }
  if (error.message === "This origin is not allowed by CORS.") {
    return res.status(403).json({ message: error.message });
  }

  return res.status(500).json({
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong on the server.",
  });
});

async function startServer() {
  try {
    await testConnection();
    console.log("MySQL connection established.");

    if (mailEnabled) {
      verifyMailer()
        .then(() => console.log("Mail server connection verified."))
        .catch((error) =>
          console.warn("Mail server verification failed:", error.message)
        );
    }

    app.listen(PORT, () => {
      console.log(`Nova Tutor Academy server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server could not start because MySQL is unavailable.");
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
