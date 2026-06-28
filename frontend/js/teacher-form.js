const {
  applyFieldErrors,
  clearFieldErrors,
  collectFormData,
  getApiBase,
  isLocalFrontend,
  setFormStatus,
} = window.NovaFormUtils;

const teacherForm = document.getElementById("teacherApplicationForm");
const teacherStatus = document.getElementById("teacherFormStatus");
const TEACHER_API_BASE_URL = getApiBase("/api");

teacherForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors(teacherForm);

  if (!teacherForm.reportValidity()) {
    setFormStatus(teacherStatus, "Please correct the highlighted fields.", "error");
    return;
  }

  const submitButton = teacherForm.querySelector(".submit-button");
  const payload = collectFormData(teacherForm);
  payload.experience_years =
    payload.experience_years === "" ? "" : Number(payload.experience_years);

  submitButton.disabled = true;
  submitButton.textContent = "Sending application...";
  setFormStatus(teacherStatus, "Submitting your application...", "loading");

  try {
    const response = await fetch(`${TEACHER_API_BASE_URL}/teachers/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      applyFieldErrors(teacherForm, result.errors);
      throw new Error(
        result.message ||
          "We could not submit your application right now. Please review the form and try again."
      );
    }

    teacherForm.reset();
    setFormStatus(
      teacherStatus,
      result.message ||
        "Your application is sent and a confirmation email has been sent to your inbox.",
      "success"
    );
  } catch (error) {
    const offlineMessage = isLocalFrontend()
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message;
    setFormStatus(teacherStatus, offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Application";
  }
});
