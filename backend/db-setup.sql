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

CREATE TABLE IF NOT EXISTS faculty_members (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  qualification     VARCHAR(200) NOT NULL,
  experience_years  INT UNSIGNED NOT NULL DEFAULT 0,
  subjects          VARCHAR(255) NOT NULL,
  city              VARCHAR(100),
  profile_note      TEXT,
  display_order     INT UNSIGNED NOT NULL DEFAULT 100,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_faculty_name (name),
  INDEX idx_faculty_active_order (is_active, display_order),
  INDEX idx_faculty_experience (experience_years)
);

-- Development fallback: admin / admin123
-- ADMIN_USERNAME and ADMIN_PASSWORD in .env take priority.
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '$2b$10$kNgmSZ0K0lA7N9jqJ8VDHOUVgvQlhHy9TfNKhKGAizLW2BSn6JUmC')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

INSERT INTO faculty_members
  (name, qualification, experience_years, subjects, city, profile_note, display_order)
VALUES
  ('Ayesha Siddiqui', 'MSc Mathematics, BEd', 8, 'Mathematics, O/A Level, Entry Test', 'Islamabad/Rawalpindi', 'Known for calm explanations, structured practice, and confidence-building exam preparation.', 1),
  ('Hamza Ahmed', 'MPhil Physics', 7, 'Physics, FSc, A Level', 'Lahore', 'Helps students connect formulas with real concepts through examples, diagrams, and targeted revision.', 2),
  ('Maryam Khan', 'MA English Literature, CELTA', 9, 'English, IELTS, Grammar, Literature', 'Karachi', 'Focuses on fluent communication, writing clarity, and practical language improvement.', 3),
  ('Bilal Raza', 'BS Computer Science', 6, 'Computer Science, Programming, Web Basics', 'Online', 'Teaches coding through simple projects, problem-solving habits, and step-by-step debugging.', 4),
  ('Sara Noor', 'MSc Chemistry', 10, 'Chemistry, Biology, O Level Science', 'Islamabad/Rawalpindi', 'Makes science easier with visual explanations, topic maps, and regular concept checks.', 5),
  ('Usman Tariq', 'MBA Finance, ACCA Finalist', 7, 'Accounting, Business Studies, Economics', 'Online', 'Supports commerce students with exam-focused practice and clear real-world examples.', 6)
ON DUPLICATE KEY UPDATE
  qualification = VALUES(qualification),
  experience_years = VALUES(experience_years),
  subjects = VALUES(subjects),
  city = VALUES(city),
  profile_note = VALUES(profile_note),
  display_order = VALUES(display_order),
  is_active = 1;
