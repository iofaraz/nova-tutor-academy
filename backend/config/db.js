const mysql = require("mysql2/promise");

const requiredVariables = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length) {
  console.warn(
    `Database configuration is incomplete. Missing: ${missingVariables.join(", ")}`
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "nova_tutor_db",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
});

async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

const cityEnumDefinition =
  "ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL";

async function syncSchema() {
  /* Production note: run the SQL migration manually in production; this helper is for controlled local setup only. */
  if (process.env.NODE_ENV === "production" && process.env.SYNC_SCHEMA_ON_START !== "true") {
    return { skipped: true };
  }

  const statements = [
    `ALTER TABLE student_requests MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE students MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE teacher_applications MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE teachers MODIFY COLUMN city ${cityEnumDefinition}`,
  ];

  for (const statement of statements) {
    const tableName = statement.match(/ALTER TABLE (\w+)/)?.[1];
    if (tableName && (await tableExists(tableName))) {
      await pool.execute(statement);
    }
  }

  const cvColumns = [
    ["teacher_applications", "cv_path", "VARCHAR(255) NULL AFTER availability"],
    ["teacher_applications", "cv_original_name", "VARCHAR(255) NULL AFTER cv_path"],
    ["teachers", "cv_path", "VARCHAR(255) NULL AFTER availability"],
    ["teachers", "cv_original_name", "VARCHAR(255) NULL AFTER cv_path"],
  ];

  for (const [table, column, definition] of cvColumns) {
    if ((await tableExists(table)) && !(await columnExists(table, column))) {
      await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  return { skipped: false };
}

async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = { pool, syncSchema, testConnection };
