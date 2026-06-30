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

const cityEnumDefinition =
  "ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL";

async function syncSchema() {
  const statements = [
    `ALTER TABLE student_requests MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE students MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE teacher_applications MODIFY COLUMN city ${cityEnumDefinition}`,
    `ALTER TABLE teachers MODIFY COLUMN city ${cityEnumDefinition}`,
  ];

  for (const statement of statements) {
    await pool.execute(statement);
  }
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
