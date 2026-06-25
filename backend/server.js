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
const facultyRoutes = require("./routes/facultyRoutes");
// const { createFrontendRouter } = require("./routes/frontendRoutes");
const { createHealthRouter } = require("./routes/healthRoutes");
const { createNotFoundRouter } = require("./routes/notFoundRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = Number(process.env.PORT || 5000);
// const frontendDirectory = path.join(__dirname, "..", "frontend");

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
app.use("/api/faculty", facultyRoutes);
app.use(createHealthRouter(testConnection, mailEnabled));
// app.use(createFrontendRouter(frontendDirectory));
app.use(createNotFoundRouter());
app.use(errorHandler);

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

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Starting in development mode without a database connection. Static frontend pages will still be served, but API routes may fail."
      );
      app.listen(PORT, () => {
        console.log(`Nova Tutor Academy server running at http://localhost:${PORT}`);
      });
    } else {
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
