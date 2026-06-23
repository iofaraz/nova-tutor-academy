-- Run this file once to set up the database:
-- mysql -u root -p < db-setup.sql

CREATE DATABASE IF NOT EXISTS nova_tutor_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nova_tutor_db;

CREATE TABLE IF NOT EXISTS student_requests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  email         VARCHAR(150),
  city          ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi') NOT NULL,
  tutor_type    ENUM('Home', 'Online', 'International') NOT NULL,
  class_level   VARCHAR(50) NOT NULL,
  curriculum    VARCHAR(100),
  subjects      TEXT NOT NULL,
  notes         TEXT,
  submitted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_submitted_at (submitted_at),
  INDEX idx_student_city_type (city, tutor_type)
);

CREATE TABLE IF NOT EXISTS teacher_applications (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  email             VARCHAR(150),
  city              ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi') NOT NULL,
  subjects          TEXT NOT NULL,
  experience_years  INT UNSIGNED,
  qualification     VARCHAR(200) NOT NULL,
  availability      VARCHAR(100) NOT NULL,
  submitted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher_submitted_at (submitted_at),
  INDEX idx_teacher_city (city)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Development fallback: admin / admin123
-- ADMIN_USERNAME and ADMIN_PASSWORD in .env take priority.
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '$2b$10$kNgmSZ0K0lA7N9jqJ8VDHOUVgvQlhHy9TfNKhKGAizLW2BSn6JUmC')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
