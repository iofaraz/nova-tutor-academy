const { getApiBase, isLocalFrontend, setFormStatus } = window.NovaFormUtils;

const ADMIN_API_BASE_URL = getApiBase("/api/admin");
const SIGN_IN_PAGE = "./admin-signin.html";
const ADMIN_CSRF_COOKIE = "nova_admin_csrf";
/*! Production note: admin write requests rely on the CSRF cookie, so keep the dashboard and API on the same origin in production. */

const dashboard = document.getElementById("adminDashboard");
const adminStatus = document.getElementById("adminStatus");
const dashboardReady = document.getElementById("dashboardReady");
const facultyForm = document.getElementById("facultyForm");
const facultyFormStatus = document.getElementById("facultyFormStatus");
const facultyTableBody = document.getElementById("facultyTableBody");
const facultyFormTitle = document.getElementById("facultyFormTitle");
const facultyFormIntro = document.getElementById("facultyFormIntro");
const cancelFacultyEdit = document.getElementById("cancelFacultyEdit");
const confirmModal = document.getElementById("adminConfirmModal");
const confirmTitle = document.getElementById("adminConfirmTitle");
const confirmMessage = document.getElementById("adminConfirmMessage");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");
let toastTimer = null;
let pendingConfirmAction = null;
let editingFacultyId = null;
let adminState = {
  pendingStudents: [],
  pendingTeachers: [],
  approvedStudents: [],
  approvedTeachers: [],
  faculty: [],
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

function getCookie(name) {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : "";
}

async function adminFetch(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrfToken = getCookie(ADMIN_CSRF_COOKIE);
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const result = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    redirectToSignIn("Your session has expired. Please sign in again.");
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to load admin data.");
  return result;
}

async function downloadTeacherCv(status, id, originalName) {
  try {
    const result = await adminFetch(
      `/teachers/${status}/${id}/cv?format=json`
    );
    if (!result.data) {
      throw new Error("The CV file is empty or unavailable.");
    }

    const binary = window.atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const blobUrl = URL.createObjectURL(
      new Blob([bytes], { type: result.mimeType || "application/octet-stream" })
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = result.fileName || originalName || "tutor-cv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    showToast("CV download started.", "success");
  } catch (error) {
    showToast(error.message || "Unable to download the CV.", "error");
  }
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
          ${
            teacher.cv_original_name
              ? `<button class="table-btn cv-download" data-action="download-pending-cv" data-id="${teacher.id}" data-file-name="${escapeHtml(teacher.cv_original_name)}" type="button" title="Download ${escapeHtml(teacher.cv_original_name)}"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i><span>Download CV</span></button>`
              : "<span>—</span>"
          }
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
        ${rowActions(`
          ${
            teacher.cv_original_name
              ? `<button class="table-btn cv-download" data-action="download-approved-cv" data-id="${teacher.id}" data-file-name="${escapeHtml(teacher.cv_original_name)}" type="button" title="Download ${escapeHtml(teacher.cv_original_name)}"><i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i><span>Download CV</span></button>`
              : "<span>—</span>"
          }
          <button class="table-icon-btn danger" data-action="delete-approved-teacher" data-id="${teacher.id}" type="button" aria-label="Delete approved teacher">×</button>
        `)}
      </td>
    </tr>`
    )
    .join("");
}

function renderFaculty(faculty) {
  if (!facultyTableBody) return;
  if (!faculty.length) {
    facultyTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No faculty members yet.</td></tr>';
    return;
  }

  facultyTableBody.innerHTML = faculty
    .map(
      (member) => `
        <tr data-id="${member.id}">
          <td>${escapeHtml(member.name)}</td>
          <td>${escapeHtml(member.city || "—")}</td>
          <td>${escapeHtml(member.subjects)}</td>
          <td>${escapeHtml(member.display_order)}</td>
          <td>${member.is_active ? "Active" : "Inactive"}</td>
          <td>
            <div class="record-actions">
              <button class="table-btn edit" data-action="edit-faculty" data-id="${member.id}" type="button">Edit</button>
              <button class="table-icon-btn danger" data-action="delete-faculty" data-id="${member.id}" type="button" aria-label="Remove faculty member">×</button>
            </div>
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
  const facultyCount = adminState.faculty.length;
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
  document.getElementById("facultyCount").textContent = facultyCount;
}

function renderAll() {
  renderPendingStudents(adminState.pendingStudents);
  renderPendingTeachers(adminState.pendingTeachers);
  renderApprovedStudents(adminState.approvedStudents);
  renderApprovedTeachers(adminState.approvedTeachers);
  renderFaculty(adminState.faculty);
  updateStats();
}

async function loadDashboardData() {
  setStatus(adminStatus, "Loading the latest submissions...", "loading");
  try {
    const [
      studentResult,
      teacherResult,
      approvedStudentResult,
      approvedTeacherResult,
      facultyResult,
    ] = await Promise.all([
      adminFetch("/students"),
      adminFetch("/teachers"),
      adminFetch("/students/approved"),
      adminFetch("/teachers/approved"),
      adminFetch("/faculty"),
    ]);

    adminState = {
      pendingStudents: getList(studentResult, ["students", "requests", "data"]),
      pendingTeachers: getList(teacherResult, ["teachers", "applications", "data"]),
      approvedStudents: getList(approvedStudentResult, ["students", "data"]),
      approvedTeachers: getList(approvedTeacherResult, ["teachers", "data"]),
      faculty: getList(facultyResult, ["faculty", "data"]),
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
    showToast(response.message || successMessage || "Updated successfully.", "success");
    await loadDashboardData();
  } catch (error) {
    showToast(error.message, "error");
    setStatus(adminStatus, error.message, "error");
  }
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

function resetFacultyForm() {
  editingFacultyId = null;
  facultyForm.reset();
  document.getElementById("facultyExperience").value = "0";
  document.getElementById("facultyDisplayOrder").value = "100";
  document.getElementById("facultyStatus").value = "1";
  facultyFormTitle.textContent = "Add Faculty Member";
  facultyFormIntro.textContent =
    "Add a new tutor profile to the public faculty pages. Image upload is optional.";
  facultyForm.querySelector(".submit-button").textContent = "Add Faculty";
  cancelFacultyEdit.hidden = true;
}

function editFaculty(member) {
  editingFacultyId = Number(member.id);
  facultyForm.elements.name.value = member.name || "";
  facultyForm.elements.qualification.value = member.qualification || "";
  facultyForm.elements.experience_years.value = member.experience_years ?? 0;
  facultyForm.elements.display_order.value = member.display_order ?? 100;
  facultyForm.elements.subjects.value = member.subjects || "";
  facultyForm.elements.city.value = member.city || "";
  facultyForm.elements.profile_note.value = member.profile_note || "";
  facultyForm.elements.is_active.value = member.is_active ? "1" : "0";
  facultyForm.elements.image.value = "";
  facultyFormTitle.textContent = "Edit Faculty Member";
  facultyFormIntro.textContent =
    "Update this tutor profile. Leave the image empty to keep the current image.";
  facultyForm.querySelector(".submit-button").textContent = "Save Changes";
  cancelFacultyEdit.hidden = false;
  setStatus(facultyFormStatus, `Editing ${member.name}.`, "loading");
  facultyForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
    showToast("Signed out successfully.", "success");
    redirectToSignIn();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "download-pending-cv") {
    downloadTeacherCv("pending", id, button.dataset.fileName);
    return;
  }
  if (action === "download-approved-cv") {
    downloadTeacherCv("approved", id, button.dataset.fileName);
    return;
  }

  if (action === "edit-faculty") {
    const member = adminState.faculty.find((item) => String(item.id) === String(id));
    if (member) editFaculty(member);
    return;
  }

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
    return;
  }
  if (action === "delete-faculty") {
    openConfirm({
      title: "Remove faculty member?",
      message: "This will permanently remove the faculty member and delete their uploaded image, if one exists. Continue?",
      onConfirm: () =>
        mutateAndRefresh(
          `/faculty/${id}`,
          { method: "DELETE" },
          "Faculty member deleted permanently."
        ),
    });
  }
});

cancelFacultyEdit?.addEventListener("click", () => {
  resetFacultyForm();
  setStatus(facultyFormStatus, "", "");
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

facultyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!facultyForm.reportValidity()) {
    setStatus(facultyFormStatus, "Please correct the highlighted fields.", "error");
    return;
  }

  const submitButton = facultyForm.querySelector(".submit-button");
  const formData = new FormData(facultyForm);
  const imageFile = formData.get("image");
  let imageDataUrl = "";

  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > 2 * 1024 * 1024) {
      setStatus(facultyFormStatus, "Faculty image must be 2 MB or smaller.", "error");
      showToast("Faculty image must be 2 MB or smaller.", "error");
      return;
    }
    imageDataUrl = await readImageAsDataUrl(imageFile);
  }

  const payload = {
    name: String(formData.get("name") || ""),
    qualification: String(formData.get("qualification") || ""),
    experience_years: Number(formData.get("experience_years") || 0),
    subjects: String(formData.get("subjects") || ""),
    city: String(formData.get("city") || ""),
    profile_note: String(formData.get("profile_note") || ""),
    display_order: Number(formData.get("display_order") || 100),
    is_active: Number(formData.get("is_active")) === 1,
    image_data_url: imageDataUrl,
    image_name: imageFile instanceof File ? imageFile.name : "",
  };

  submitButton.disabled = true;
  submitButton.textContent = editingFacultyId ? "Saving Changes..." : "Adding Faculty...";
  setStatus(facultyFormStatus, "Saving faculty profile...", "loading");

  try {
    const editId = editingFacultyId;
    const result = await adminFetch(editId ? `/faculty/${editId}` : "/faculty", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    const successMessage =
      result.message ||
      (editId ? "Faculty member updated successfully." : "Faculty member added successfully.");
    resetFacultyForm();
    setStatus(facultyFormStatus, successMessage, "success");
    showToast(successMessage, "success");
    await loadDashboardData();
  } catch (error) {
    setStatus(facultyFormStatus, error.message, "error");
    showToast(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingFacultyId ? "Save Changes" : "Add Faculty";
  }
});

showDashboard();
loadDashboardData();
