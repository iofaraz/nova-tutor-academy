const ADMIN_API_BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:5000/api/admin"
    : "/api/admin";
const TOKEN_KEY = "novaAdminToken";

const loginSection = document.getElementById("adminLogin");
const dashboard = document.getElementById("adminDashboard");
const loginForm = document.getElementById("adminLoginForm");
const loginStatus = document.getElementById("loginStatus");
const adminStatus = document.getElementById("adminStatus");

function setStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `form-status ${message ? "show" : ""} ${type || ""}`;
}

function escapeHtml(value) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getList(result, possibleKeys) {
  if (Array.isArray(result)) return result;
  for (const key of possibleKeys) {
    if (Array.isArray(result?.[key])) return result[key];
  }
  return [];
}

function showDashboard() {
  loginSection.hidden = true;
  dashboard.hidden = false;
}

function showLogin() {
  dashboard.hidden = true;
  loginSection.hidden = false;
}

async function adminFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to load admin data.");
  return result;
}

function renderStudents(students) {
  const body = document.getElementById("studentTableBody");
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No student requests yet.</td></tr>';
    return;
  }
  body.innerHTML = students.map((student) => `
    <tr>
      <td>${formatDate(student.submitted_at)}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td>${escapeHtml(student.city)}</td>
      <td>${escapeHtml(student.tutor_type)}</td>
      <td>${escapeHtml(student.class_level)}</td>
      <td>${escapeHtml(student.subjects)}</td>
      <td>${escapeHtml(student.email)}</td>
    </tr>`).join("");
}

function renderTeachers(teachers) {
  const body = document.getElementById("teacherTableBody");
  if (!teachers.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No teacher applications yet.</td></tr>';
    return;
  }
  body.innerHTML = teachers.map((teacher) => `
    <tr>
      <td>${formatDate(teacher.submitted_at)}</td>
      <td>${escapeHtml(teacher.name)}</td>
      <td>${escapeHtml(teacher.phone)}</td>
      <td>${escapeHtml(teacher.city)}</td>
      <td>${escapeHtml(teacher.subjects)}</td>
      <td>${escapeHtml(teacher.experience_years)} years</td>
      <td>${escapeHtml(teacher.qualification)}</td>
      <td>${escapeHtml(teacher.availability)}</td>
    </tr>`).join("");
}

async function loadDashboardData() {
  setStatus(adminStatus, "Loading the latest submissions…", "info");
  try {
    const [studentResult, teacherResult] = await Promise.all([
      adminFetch("/students"),
      adminFetch("/teachers"),
    ]);
    const students = getList(studentResult, ["students", "requests", "data"]);
    const teachers = getList(teacherResult, ["teachers", "applications", "data"]);
    renderStudents(students);
    renderTeachers(teachers);
    document.getElementById("studentCount").textContent = students.length;
    document.getElementById("teacherCount").textContent = teachers.length;
    document.getElementById("totalCount").textContent = students.length + teachers.length;
    setStatus(adminStatus, "", "");
  } catch (error) {
    setStatus(adminStatus, error.message, "error");
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector(".submit-button");
  const credentials = Object.fromEntries(new FormData(loginForm).entries());
  submitButton.disabled = true;
  submitButton.textContent = "Signing in…";
  setStatus(loginStatus, "Checking your credentials…", "info");

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Invalid username or password.");
    const token = result.token || result.accessToken;
    if (!token) throw new Error("The server did not return an access token.");
    localStorage.setItem(TOKEN_KEY, token);
    loginForm.reset();
    setStatus(loginStatus, "", "");
    showDashboard();
    await loadDashboardData();
  } catch (error) {
    const message = window.location.protocol === "file:" && error instanceof TypeError
      ? "The admin interface is ready, but the backend must be running on localhost:5000."
      : error.message;
    setStatus(loginStatus, message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== button.dataset.tab;
    });
  });
});

document.getElementById("refreshData")?.addEventListener("click", loadDashboardData);
document.getElementById("logoutButton")?.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

if (localStorage.getItem(TOKEN_KEY)) {
  showDashboard();
  loadDashboardData();
} else {
  showLogin();
}
