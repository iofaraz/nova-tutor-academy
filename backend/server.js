const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  quiet: true,
});

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const { syncSchema, testConnection } = require("./config/db");
const { verifyMailer, mailEnabled } = require("./config/mailer");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contactRoutes = require("./routes/contactRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const { createHealthRouter } = require("./routes/healthRoutes");
const { createNotFoundRouter } = require("./routes/notFoundRoutes");
const errorHandler = require("./middleware/errorHandler");
const { hasDangerousKeys, isPlainObject } = require("./utils/validation");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const frontendDirectory = path.join(__dirname, "..", "frontend");
const isProduction = process.env.NODE_ENV === "production";
const siteUrl = String(process.env.SITE_URL || "").replace(/\/+$/, "");

/*! Production note: set SITE_URL and CORS_ORIGIN to the real deployed origin before launch. */
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: [
          "'self'",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        //! Production note: add your image CDN or domain to imgSrc (e.g., 'https://cdn.yourdomain.com' or your S3 bucket URL). 
        imgSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "https://kit.fontawesome.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);
app.use(
  (req, res, next) => {
    res.set({
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    });
    next();
  }
);
app.use(compression({ threshold: 1024 }));
app.use(
  cors({
    origin(origin, callback) {
      const configuredOrigins = String(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const developmentOrigins = isProduction
        ? []
        : ["http://localhost:5000", "http://127.0.0.1:5000", "null"];
      const siteOrigins = siteUrl ? [siteUrl] : [];
      const allowedOrigins = new Set([
        ...configuredOrigins,
        ...siteOrigins,
        ...developmentOrigins,
      ]);

      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("This origin is not allowed by CORS."));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-XSRF-Token"],
    credentials: true,
    maxAge: 600,
  })
);
app.use(express.json({ limit: "6mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use((req, res, next) => {
  if (req.body && isPlainObject(req.body) && hasDangerousKeys(req.body)) {
    return res.status(400).json({ message: "The submitted data contains invalid fields." });
  }
  return next();
});

function staticAssetHeaders(res, filePath) {
  if (/\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
}

app.use(
  "/images",
  (req, res, next) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "public", "images"), {
    maxAge: "30d",
    setHeaders: staticAssetHeaders,
  })
);
// Keep the frontend available locally and in production so page links work in both modes.
app.use("/frontend", express.static(frontendDirectory, { setHeaders: staticAssetHeaders }));
app.use(express.static(frontendDirectory, { setHeaders: staticAssetHeaders }));

app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/faculty", facultyRoutes);
app.use(createHealthRouter(testConnection, mailEnabled));
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDirectory, "index.html"));
});
app.get("/frontend", (req, res) => {
  res.sendFile(path.join(frontendDirectory, "index.html"));
});
app.get("/robots.txt", (req, res) => {
  const baseUrl = siteUrl || `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
});
app.get("/sitemap.xml", (req, res) => {
  const baseUrl = siteUrl || `${req.protocol}://${req.get("host")}`;
  const pages = [
    "/",
    "/pages/about.html",
    "/pages/contact.html",
    "/pages/home-tutor.html",
    "/pages/international-tutor.html",
    "/pages/online-tutor.html",
    "/pages/our-faculty.html",
    "/pages/request-tutor.html",
    "/pages/teach-with-us.html",
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    pages
      .map((page) => `<url><loc>${baseUrl}${page}</loc></url>`)
      .join("") +
    `</urlset>`;

  res.type("application/xml").send(xml);
});
app.use(createNotFoundRouter());
app.use(errorHandler);

async function startServer() {
  try {
    await testConnection();
    /*! Production note: keep SYNC_SCHEMA_ON_START disabled in production unless you are applying a controlled migration. */
    const syncResult = await syncSchema();
    console.log("MySQL connection established.");

    if (syncResult?.skipped) {
      console.warn(
        "Automatic schema syncing is disabled in production. Run backend/db-setup.sql during deployment."
      );
    }

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
