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
  city          ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL,
  tutor_type    ENUM('Home', 'Online', 'International') NOT NULL,
  class_level   VARCHAR(50) NOT NULL,
  curriculum    VARCHAR(100),
  subjects      TEXT NOT NULL,
  notes         TEXT,
  submitted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_submitted_at (submitted_at),
  INDEX idx_student_city_type (city, tutor_type)
);

CREATE TABLE IF NOT EXISTS students (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_request_id   INT UNSIGNED NOT NULL,
  name                VARCHAR(100) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  email               VARCHAR(150),
  city                ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL,
  tutor_type          ENUM('Home', 'Online', 'International') NOT NULL,
  class_level         VARCHAR(50) NOT NULL,
  curriculum          VARCHAR(100),
  subjects            TEXT NOT NULL,
  notes               TEXT,
  approved_by         VARCHAR(50),
  approved_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_students_source_request (source_request_id),
  INDEX idx_students_approved_at (approved_at),
  INDEX idx_students_city_type (city, tutor_type)
);

CREATE TABLE IF NOT EXISTS teacher_applications (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  email             VARCHAR(150),
  city              ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL,
  subjects          TEXT NOT NULL,
  experience_years  INT UNSIGNED,
  qualification     VARCHAR(200) NOT NULL,
  availability      VARCHAR(100) NOT NULL,
  submitted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher_submitted_at (submitted_at),
  INDEX idx_teacher_city (city)
);

CREATE TABLE IF NOT EXISTS teachers (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_request_id   INT UNSIGNED NOT NULL,
  name                VARCHAR(100) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  email               VARCHAR(150),
  city                ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi', 'Other') NOT NULL,
  subjects            TEXT NOT NULL,
  experience_years    INT UNSIGNED,
  qualification       VARCHAR(200) NOT NULL,
  availability        VARCHAR(100) NOT NULL,
  approved_by         VARCHAR(50),
  approved_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teachers_source_request (source_request_id),
  INDEX idx_teachers_approved_at (approved_at),
  INDEX idx_teachers_city (city)
);

-- CREATE TABLE IF NOT EXISTS admin_users (
--   id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--   username      VARCHAR(50) UNIQUE NOT NULL,
--   password_hash VARCHAR(255) NOT NULL
-- );

CREATE TABLE IF NOT EXISTS contact_messages (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(150) NOT NULL,
  topic         VARCHAR(80) NOT NULL,
  message       TEXT NOT NULL,
  submitted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_submitted_at (submitted_at)
);

CREATE TABLE IF NOT EXISTS faculty_members (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  qualification     VARCHAR(200) NOT NULL,
  experience_years  INT UNSIGNED NOT NULL DEFAULT 0,
  subjects          VARCHAR(255) NOT NULL,
  city              VARCHAR(100),
  profile_note      TEXT,
  image_path        VARCHAR(255),
  display_order     INT UNSIGNED NOT NULL DEFAULT 100,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_faculty_name (name),
  INDEX idx_faculty_active_order (is_active, display_order),
  INDEX idx_faculty_experience (experience_years)
);

-- Keep existing databases in sync when this setup script is run again.
-- Use a conditional prepared statement for compatibility with MySQL versions
-- that do not support ADD COLUMN IF NOT EXISTS.
SET @image_path_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'faculty_members'
    AND COLUMN_NAME = 'image_path'
);
SET @image_path_migration = IF(
  @image_path_exists = 0,
  'ALTER TABLE faculty_members ADD COLUMN image_path VARCHAR(255) AFTER profile_note',
  'SELECT 1'
);
PREPARE image_path_statement FROM @image_path_migration;
EXECUTE image_path_statement;
DEALLOCATE PREPARE image_path_statement;

-- Keep teacher city options aligned with the application form.
ALTER TABLE teacher_applications
  MODIFY COLUMN city ENUM(
    'Islamabad/Rawalpindi',
    'Lahore',
    'Karachi',
    'Other'
  ) NOT NULL;

ALTER TABLE teachers
  MODIFY COLUMN city ENUM(
    'Islamabad/Rawalpindi',
    'Lahore',
    'Karachi',
    'Other'
  ) NOT NULL;

ALTER TABLE student_requests
  MODIFY COLUMN city ENUM(
    'Islamabad/Rawalpindi',
    'Lahore',
    'Karachi',
    'Other'
  ) NOT NULL;

ALTER TABLE students
  MODIFY COLUMN city ENUM(
    'Islamabad/Rawalpindi',
    'Lahore',
    'Karachi',
    'Other'
  ) NOT NULL;