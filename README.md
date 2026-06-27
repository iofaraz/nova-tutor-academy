# Nova Tutor Academy

## 📁 Project Structure

```text
nova-tutor-academy/
│
├── frontend/
│   ├── pages/          # HTML pages
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   ├── assets/         # Images, icons, and static assets
|   └── index.html
│
└── backend/
    ├── routes/         # API routes and endpoints
    ├── config/         # Database and mail configuration
    ├── server.js       # Express application entry point
    └── .env            # Environment variables (not included in version control)
```

---

## 🚀 Getting Started

### Frontend

No installation is required for the frontend.

1. Navigate to the `frontend` directory.
2. Open `index.html` in your preferred web browser.

```text
frontend/index.html
```

---

### Database Setup

1. Create a MySQL database named:

```sql
CREATE DATABASE nova_tutor_db;
```

2. Import and execute the SQL script provided in `db-setup.sql` to create the required tables and initial database structure.

---

## 🛠 Backend Configuration

1. Configure your environment variables in the `.env` file.
2. Update database credentials and mail settings for your environment.
3. Set `CORS_ORIGIN` in production to the deployed frontend origin.
4. Start the Express server using `npm run dev` from `backend/`.

The backend now serves the frontend files locally as well, so you can open the site through the Express app instead of `file://` when testing form submissions, authentication, and email notifications.

---

## 📌 Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL

---

## 📄 Notes

- Ensure MySQL is running before starting the backend server.
- Configure `MAIL_USER`, `MAIL_PASS`, `MAIL_TO`, and optionally `MAIL_FROM` for live email delivery.
- Keep the `.env` file private and never commit it to version control.
- Verify database credentials match your local environment configuration.
