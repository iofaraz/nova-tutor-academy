const TEACHER_API_BASE_URL =
  window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api";
const teacherForm = document.getElementById("teacherApplicationForm");

function showTeacherStatus(message, type) {
  const status = document.getElementById("teacherFormStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `form-status show ${type}`;
}

teacherForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = teacherForm.querySelector(".submit-button");
  const formData = new FormData(teacherForm);
  const payload = Object.fromEntries(formData.entries());
  payload.experience_years = Number(payload.experience_years || 0);

  submitButton.disabled = true;
  submitButton.textContent = "Sending application…";
  showTeacherStatus("Submitting your application…", "info");

  try {
    const response = await fetch(`${TEACHER_API_BASE_URL}/teachers/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "We could not submit your application.");

    teacherForm.reset();
    showTeacherStatus("Application received. We will review your profile and get in touch.", "success");
  } catch (error) {
    const offlineMessage = window.location.protocol === "file:"
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message;
    showTeacherStatus(offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit application";
  }
});
