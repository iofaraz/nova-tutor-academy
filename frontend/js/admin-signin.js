const { getApiBase, isLocalFrontend, setFormStatus } = window.NovaFormUtils;

const ADMIN_API_BASE_URL = getApiBase("/api/admin");
const DASHBOARD_PAGE = "./admin.html";
const SESSION_CHECK_URL = `${ADMIN_API_BASE_URL}/session`;
/*! Production note: this sign-in page expects a cookie-based session from the same origin as the API. */

const loginForm = document.getElementById("adminLoginForm");
const loginStatus = document.getElementById("loginStatus");
let toastTimer = null;

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

function redirectToDashboard() {
  window.location.replace(DASHBOARD_PAGE);
}

async function hasActiveSession() {
  try {
    const response = await fetch(SESSION_CHECK_URL, {
      credentials: "include",
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

const flashMessage = sessionStorage.getItem("novaAdminFlash");
if (flashMessage) {
  showToast(flashMessage, "error");
  sessionStorage.removeItem("novaAdminFlash");
}

hasActiveSession().then((active) => {
  if (active) redirectToDashboard();
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector(".submit-button");
  const credentials = Object.fromEntries(new FormData(loginForm).entries());

  if (!loginForm.reportValidity()) {
    setStatus(loginStatus, "Please enter your admin credentials.", "error");
    showToast("Please enter your admin credentials.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";
  setStatus(loginStatus, "Checking your credentials...", "loading");

  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Invalid username or password.");
    if (!(await hasActiveSession())) {
      throw new Error("The server did not establish a session cookie.");
    }
    loginForm.reset();
    setStatus(loginStatus, "", "");
    showToast(result.message || "Signed in successfully.", "success");
    window.setTimeout(redirectToDashboard, 250);
  } catch (error) {
    const message = isLocalFrontend() && error instanceof TypeError
      ? "The admin sign-in page is ready, but the backend must be running on localhost:5000."
      : error.message;
    setStatus(loginStatus, message, "error");
    showToast(message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});
