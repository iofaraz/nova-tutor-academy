const { getApiBase, isLocalFrontend, setFormStatus } = window.NovaFormUtils;

const ADMIN_API_BASE_URL = getApiBase("/api/admin");
const TOKEN_KEY = "novaAdminToken";
const SIGN_IN_PAGE = "./admin-signin.html";

const dashboard = document.getElementById("adminDashboard");
const adminStatus = document.getElementById("adminStatus");
const dashboardReady = document.getElementById("dashboardReady");
const confirmModal = document.getElementById("adminConfirmModal");
const confirmTitle = document.getElementById("adminConfirmTitle");
const confirmMessage = document.getElementById("adminConfirmMessage");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");
let toastTimer = null;
let pendingConfirmAction = null;
let adminState = {
  pendingStudents: [],
  pendingTeachers: [],
  approvedStudents: [],
  approvedTeachers: [],
};

function setStatus(element, message, type) {
  setFormStatus(element, message, type);
}

function ensureToastHost() {
  let host = document.getElementById("adminToastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "adminToastHost";
    host.className = "admin-toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    document.body.appendChild(host);
  }
  return host;
}

function showToast(message, type = "success") {
  const host = ensureToastHost();
  host.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `admin-toast admin-toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.remove();
  }, 3500);
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
  dashboard.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function redirectToSignIn(message) {
  if (message) sessionStorage.setItem("novaAdminFlash", message);
  window.location.replace(SIGN_IN_PAGE);
}

async function adminFetch(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
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
    sessionStorage.removeItem(TOKEN_KEY);
    redirectToSignIn("Your session has expired. Please sign in again.");
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to load admin data.");
  return result;
}

function rowActions(actionButtons) {
  return `<div class="record-actions">${actionButtons}</div>`;
}

function renderPendingStudents(students) {
  const body = document.getElementById("studentTableBody");
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No student requests yet.</td></tr>';
    return;
  }
  body.innerHTML = students
    .map(
      (student) => `
    <tr data-id="${student.id}">
      <td>${formatDate(student.submitted_at)}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td>${escapeHtml(student.city)}</td>
      <td>${escapeHtml(student.tutor_type)}</td>
      <td>${escapeHtml(student.class_level)}</td>
      <td>${escapeHtml(student.subjects)}</td>
      <td>${escapeHtml(student.email)}</td>
      <td>
        ${rowActions(`
          <button class="table-btn approve" data-action="approve-student" data-id="${student.id}" type="button">Approve</button>
          <button class="table-btn reject" data-action="reject-student" data-id="${student.id}" type="button">Reject</button>
        `)}
      </td>
    </tr>`
    )
    .join("");
}

function renderPendingTeachers(teachers) {
  const body = document.getElementById("teacherTableBody");
  if (!teachers.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No teacher applications yet.</td></tr>';
    return;
  }
  body.innerHTML = teachers
    .map(
      (teacher) => `
    <tr data-id="${teacher.id}">
      <td>${formatDate(teacher.submitted_at)}</td>
      <td>${escapeHtml(teacher.name)}</td>
      <td>${escapeHtml(teacher.phone)}</td>
      <td>${escapeHtml(teacher.city)}</td>
      <td>${escapeHtml(teacher.subjects)}</td>
      <td>${escapeHtml(teacher.experience_years)} years</td>
      <td>${escapeHtml(teacher.qualification)}</td>
      <td>${escapeHtml(teacher.availability)}</td>
      <td>
        ${rowActions(`
          <button class="table-btn approve" data-action="approve-teacher" data-id="${teacher.id}" type="button">Approve</button>
          <button class="table-btn reject" data-action="reject-teacher" data-id="${teacher.id}" type="button">Reject</button>
        `)}
      </td>
    </tr>`
    )
    .join("");
}

function renderApprovedStudents(students) {
  const body = document.getElementById("approvedStudentTableBody");
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No approved students yet.</td></tr>';
    return;
  }
  body.innerHTML = students
    .map(
      (student) => `
    <tr data-id="${student.id}">
      <td>${formatDate(student.approved_at)}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.phone)}</td>
      <td>${escapeHtml(student.city)}</td>
      <td>${escapeHtml(student.tutor_type)}</td>
      <td>${escapeHtml(student.class_level)}</td>
      <td>${escapeHtml(student.subjects)}</td>
      <td>${escapeHtml(student.approved_by || "—")}</td>
      <td>
        <button class="table-icon-btn danger" data-action="delete-approved-student" data-id="${student.id}" type="button" aria-label="Delete approved student">×</button>
      </td>
    </tr>`
    )
    .join("");
}

function renderApprovedTeachers(teachers) {
  const body = document.getElementById("approvedTeacherTableBody");
  if (!teachers.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">No approved teachers yet.</td></tr>';
    return;
  }
  body.innerHTML = teachers
    .map(
      (teacher) => `
    <tr data-id="${teacher.id}">
      <td>${formatDate(teacher.approved_at)}</td>
      <td>${escapeHtml(teacher.name)}</td>
      <td>${escapeHtml(teacher.phone)}</td>
      <td>${escapeHtml(teacher.city)}</td>
      <td>${escapeHtml(teacher.subjects)}</td>
      <td>${escapeHtml(teacher.experience_years)} years</td>
      <td>${escapeHtml(teacher.qualification)}</td>
      <td>${escapeHtml(teacher.approved_by || "—")}</td>
      <td>
        <button class="table-icon-btn danger" data-action="delete-approved-teacher" data-id="${teacher.id}" type="button" aria-label="Delete approved teacher">×</button>
      </td>
    </tr>`
    )
    .join("");
}

function updateStats() {
  const pendingStudents = adminState.pendingStudents.length;
  const pendingTeachers = adminState.pendingTeachers.length;
  const approvedStudents = adminState.approvedStudents.length;
  const approvedTeachers = adminState.approvedTeachers.length;
  const totalPending = pendingStudents + pendingTeachers;
  const totalApproved = approvedStudents + approvedTeachers;
  const totalAll = totalPending + totalApproved;

  document.getElementById("pendingStudentCount").textContent = pendingStudents;
  document.getElementById("pendingTeacherCount").textContent = pendingTeachers;
  document.getElementById("approvedStudentCount").textContent = approvedStudents;
  document.getElementById("approvedTeacherCount").textContent = approvedTeachers;
  document.getElementById("totalPendingCount").textContent = totalPending;
  document.getElementById("totalApprovedCount").textContent = totalApproved;
  document.getElementById("totalCount").textContent = totalAll;
}

function renderAll() {
  renderPendingStudents(adminState.pendingStudents);
  renderPendingTeachers(adminState.pendingTeachers);
  renderApprovedStudents(adminState.approvedStudents);
  renderApprovedTeachers(adminState.approvedTeachers);
  updateStats();
}

async function loadDashboardData() {
  setStatus(adminStatus, "Loading the latest submissions...", "loading");
  try {
    const [studentResult, teacherResult, approvedStudentResult, approvedTeacherResult] =
      await Promise.all([
        adminFetch("/students"),
        adminFetch("/teachers"),
        adminFetch("/students/approved"),
        adminFetch("/teachers/approved"),
      ]);

    adminState = {
      pendingStudents: getList(studentResult, ["students", "requests", "data"]),
      pendingTeachers: getList(teacherResult, ["teachers", "applications", "data"]),
      approvedStudents: getList(approvedStudentResult, ["students", "data"]),
      approvedTeachers: getList(approvedTeacherResult, ["teachers", "data"]),
    };

    renderAll();
    setStatus(adminStatus, "", "");
    if (dashboardReady) dashboardReady.textContent = "";
  } catch (error) {
    setStatus(adminStatus, error.message, "error");
    if (isLocalFrontend() && error instanceof TypeError && dashboardReady) {
      dashboardReady.textContent =
        "The admin dashboard is ready, but the backend must be running on localhost:5000.";
    }
  }
}

async function mutateAndRefresh(path, options, successMessage) {
  try {
    const response = await adminFetch(path, options);
    showToast(successMessage || response.message || "Updated successfully.", "success");
    await loadDashboardData();
  } catch (error) {
    showToast(error.message, "error");
    setStatus(adminStatus, error.message, "error");
  }
}

function openConfirm({ title, message, onConfirm }) {
  pendingConfirmAction = onConfirm;
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmModal.hidden = false;
}

function closeConfirm() {
  pendingConfirmAction = null;
  confirmModal.hidden = true;
}

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
document.getElementById("logoutButton")?.addEventListener("click", async () => {
  try {
    await adminFetch("/logout", { method: "POST" });
  } catch (error) {
    // Clear local state even if the backend session already expired.
  } finally {
    sessionStorage.removeItem(TOKEN_KEY);
    showToast("Signed out successfully.", "success");
    redirectToSignIn();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "approve-student") {
    mutateAndRefresh(`/students/${id}/approve`, { method: "POST" }, "Student approved successfully.");
    return;
  }
  if (action === "reject-student") {
    mutateAndRefresh(`/students/${id}/reject`, { method: "POST" }, "Student request rejected.");
    return;
  }
  if (action === "approve-teacher") {
    mutateAndRefresh(`/teachers/${id}/approve`, { method: "POST" }, "Teacher approved successfully.");
    return;
  }
  if (action === "reject-teacher") {
    mutateAndRefresh(`/teachers/${id}/reject`, { method: "POST" }, "Teacher application rejected.");
    return;
  }
  if (action === "delete-approved-student") {
    openConfirm({
      title: "Delete approved student?",
      message: "Do you want to permanently delete this entry?",
      onConfirm: () =>
        mutateAndRefresh(
          `/students/approved/${id}`,
          { method: "DELETE" },
          "Approved student deleted permanently."
        ),
    });
    return;
  }
  if (action === "delete-approved-teacher") {
    openConfirm({
      title: "Delete approved teacher?",
      message: "Do you want to permanently delete this entry?",
      onConfirm: () =>
        mutateAndRefresh(
          `/teachers/approved/${id}`,
          { method: "DELETE" },
          "Approved teacher deleted permanently."
        ),
    });
  }
});

confirmYes?.addEventListener("click", () => {
  const action = pendingConfirmAction;
  closeConfirm();
  if (action) action();
});

confirmNo?.addEventListener("click", closeConfirm);
confirmModal?.addEventListener("click", (event) => {
  if (event.target === confirmModal) closeConfirm();
});

if (sessionStorage.getItem(TOKEN_KEY)) {
  showDashboard();
  loadDashboardData();
} else {
  redirectToSignIn();
}
