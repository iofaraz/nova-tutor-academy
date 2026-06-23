# Nova Tutor Academy

## Project Structure
nova-tutor-academy/
├── frontend/
│   ├── pages/        → all HTML pages
│   ├── css/          → stylesheets
│   ├── js/           → JavaScript files
│   └── assets/       → images, icons
└── backend/
    ├── routes/       → API endpoints
    ├── config/       → DB and mailer setup
    ├── server.js     → Express entry point
    └── .env          → secret credentials

## Setup Steps

### 1. Backend setup
cd nova-tutor-academy/backend
npm install
# Fill in your .env file
node server.js

### 2. Frontend
Just open frontend/pages/index.html in your browser.
No install needed.

### 3. Database
Create a MySQL database named: nova_tutor_db
Then run the SQL from db-setup.sql to create tables.
