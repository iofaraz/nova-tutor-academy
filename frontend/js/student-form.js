const {
  applyFieldErrors,
  clearFieldErrors,
  collectFormData,
  getApiBase,
  isLocalFrontend,
  setFormStatus,
} = window.NovaFormUtils;

const studentForm = document.getElementById("studentRequestForm");
const studentStatus = document.getElementById("studentFormStatus");
const API_BASE_URL = getApiBase("/api");

const requestedTutorType = new URLSearchParams(window.location.search).get("tutor");
const tutorTypeSelect = document.getElementById("tutor_type");
if (requestedTutorType && tutorTypeSelect) tutorTypeSelect.value = requestedTutorType;

studentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors(studentForm);

  if (!studentForm.reportValidity()) {
    setFormStatus(studentStatus, "Please correct the highlighted fields.", "error");
    return;
  }

  const submitButton = studentForm.querySelector(".submit-button");
  const payload = collectFormData(studentForm);

  submitButton.disabled = true;
  submitButton.textContent = "Sending request...";
  setFormStatus(studentStatus, "Submitting your details securely...", "loading");

  try {
    const response = await fetch(`${API_BASE_URL}/students/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      applyFieldErrors(studentForm, result.errors);
      throw new Error(
        result.message ||
          "We could not submit your request right now. Please review the form and try again."
      );
    }

    studentForm.reset();
    const successMessage =
      result.emailStatus === "sent"
        ? "Your tutor request has been submitted successfully. We sent a confirmation email. Please check your inbox and spam or junk folder. Our team will contact you soon with the next steps."
        : result.emailStatus === "skipped"
          ? "Your tutor request has been submitted successfully. Our team will review your requirements and contact you soon with the next steps."
          : "Your tutor request has been submitted successfully. Our team will contact you soon; however, the confirmation email could not be delivered right now.";
    setFormStatus(
      studentStatus,
      successMessage,
      "success"
    );
    studentStatus.classList.add("submission-confirmation");
    window.setTimeout(
      () => studentStatus.classList.remove("submission-confirmation"),
      12000
    );
  } catch (error) {
    const offlineMessage = isLocalFrontend() && error instanceof TypeError
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message || "We could not submit your request right now.";
    setFormStatus(studentStatus, offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Tutor Request";
  }
});
