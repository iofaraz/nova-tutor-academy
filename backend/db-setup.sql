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

CREATE TABLE IF NOT EXISTS students (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_request_id   INT UNSIGNED NOT NULL,
  name                VARCHAR(100) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  email               VARCHAR(150),
  city                ENUM('Islamabad/Rawalpindi', 'Lahore', 'Karachi') NOT NULL,
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

-- -- Development fallback: admin / admin123
-- -- ADMIN_USERNAME and ADMIN_PASSWORD in .env take priority.
-- INSERT INTO admin_users (username, password_hash)
-- VALUES ('admin', '$2b$10$kNgmSZ0K0lA7N9jqJ8VDHOUVgvQlhHy9TfNKhKGAizLW2BSn6JUmC')
-- ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

-- INSERT INTO faculty_members
-- (name, qualification, experience_years, subjects, city, profile_note, image_path, display_order)
-- VALUES
-- (
-- 'Sir Talat Ameer',
-- 'MSc Mathematics',
-- 10,
-- 'Mathematics, O Level, A Level',
-- 'Islamabad/Rawalpindi',
-- '10 years of experience teaching O Level and A Level Mathematics at Wawell, a reputed educational institute in Pakistan.',
-- '/images/faculty/talat.jpeg',
-- 1
-- ),
-- (
-- 'Miss Rida Khaliq',
-- 'MPhil Bioinformatics',
-- 8,
-- 'Biology, Chemistry, Mathematics, Pakistan Studies, Spoken English',
-- 'Islamabad/Rawalpindi',
-- 'Experienced O Level teacher specializing in Biology, Chemistry, Mathematics, Pakistan Studies, and Spoken English.',
-- '/images/faculty/rida.jpeg',
-- 2
-- ),
-- (
-- 'Sir Tahseen Raza',
-- 'MPhil Accounting & Finance, MCom',
-- 15,
-- 'Accounting, Business Studies, Economics, ACCA, CA',
-- 'Islamabad/Rawalpindi',
-- 'Experienced Accounting and Business educator. Has taught at Roots, Punjab College, SKANS, Roots Wellington Campus, and MIUC. Specializes in O Level, A Level, ACCA, and CA courses.',
-- '/images/faculty/tehseen.jpeg',
-- 3
-- ),
-- (
-- 'Sir M. Nadeem Akram',
-- 'MPhil English Linguistics',
-- 15,
-- 'English Language, English Literature',
-- 'Islamabad/Rawalpindi',
-- 'Experienced educationist with 15 years of teaching English Language and Literature.',
-- '/images/faculty/nadeem.jpeg',
-- 4
-- ),
-- (
-- 'Miss Tahreem Tahir',
-- 'MPhil Chemistry',
-- 5,
-- 'Chemistry',
-- 'Islamabad/Rawalpindi',
-- 'Chemistry teacher with 5 years of teaching experience at The City School.',
-- '/images/faculty/tehreem.jpeg',
-- 5
-- ),
-- (
-- 'Sir Fayyaz Ahmed',
-- 'MBA',
-- 15,
-- 'Business Studies, O Level, A Level',
-- 'Islamabad/Rawalpindi',
-- '15 years of experience teaching Business Studies at Roots International, Super Nova, and Beaconhouse.',
-- '/images/faculty/fayyaz.jpeg',
-- 6
-- ),
-- (
-- 'Sir Adnan Qaisar',
-- 'MIT',
-- 25,
-- 'Computer Science, Information Technology',
-- 'Islamabad/Rawalpindi',
-- '25 years of teaching experience at Bahria College, The City School, Beaconhouse, and Kids College.',
-- '/images/faculty/adnan.jpeg',
-- 7
-- ),
-- (
-- 'Sir Najab Sami',
-- 'MPhil Physics',
-- 12,
-- 'Physics, O Level, A Level',
-- 'Islamabad/Rawalpindi',
-- '12 years of teaching experience at Roots International, Beaconhouse, and ASAS Academy.',
-- '/images/faculty/najab.jpeg',
-- 8
-- ),
-- (
-- 'Sir Qamar Baloch',
-- 'MPhil Economics',
-- 15,
-- 'Economics',
-- 'Islamabad/Rawalpindi',
-- '15 years of teaching experience at Beaconhouse, LGS, The City School, and ASAS Academy.',
-- '/images/faculty/qamar.jpeg',
-- 9
-- ),
-- (
-- 'Sir M Fazil',
-- 'MA Islamic Studies',
-- 15,
-- 'Islamic Studies',
-- 'Islamabad/Rawalpindi',
-- '15 years of teaching experience in reputed educational institutes in Pakistan.',
-- '/images/faculty/fazil.jpeg',
-- 10
-- ),
-- (
-- 'Sir Waqas Noor',
-- 'MA History',
-- 11,
-- 'History',
-- 'Islamabad/Rawalpindi',
-- '11 years of teaching experience in reputed educational institutes in Pakistan.',
-- '/images/faculty/waqas.jpeg',
-- 11
-- ),
-- (
-- 'Miss Amna',
-- 'MA Urdu',
-- 27,
-- 'Urdu',
-- 'Islamabad/Rawalpindi',
-- '27 years of teaching experience in reputed educational institutes in Pakistan.',
-- '/images/faculty/amna.jpeg',
-- 12
-- )
-- ON DUPLICATE KEY UPDATE
-- qualification = VALUES(qualification),
-- experience_years = VALUES(experience_years),
-- subjects = VALUES(subjects),
-- city = VALUES(city),
-- profile_note = VALUES(profile_note),
-- image_path = VALUES(image_path),
-- display_order = VALUES(display_order),
-- is_active = 1;
