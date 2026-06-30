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
const MAX_CV_SIZE = 3 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The selected CV could not be read."));
    reader.readAsDataURL(file);
  });
}

teacherForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors(teacherForm);

  if (!teacherForm.reportValidity()) {
    setFormStatus(teacherStatus, "Please correct the highlighted fields.", "error");
    return;
  }

  const submitButton = teacherForm.querySelector(".submit-button");
  const cvInput = teacherForm.elements.cv;
  const cvFile = cvInput?.files?.[0];
  const cvExtension = cvFile?.name.split(".").pop()?.toLowerCase();

  if (!cvFile) {
    cvInput?.setCustomValidity("Please upload your CV.");
    teacherForm.reportValidity();
    setFormStatus(teacherStatus, "A CV is required to submit your application.", "error");
    return;
  }
  if (!ALLOWED_CV_EXTENSIONS.has(cvExtension)) {
    cvInput.setCustomValidity("Upload your CV as a PDF, DOC, or DOCX file.");
    teacherForm.reportValidity();
    setFormStatus(teacherStatus, "Upload your CV as a PDF, DOC, or DOCX file.", "error");
    return;
  }
  if (cvFile.size > MAX_CV_SIZE) {
    cvInput.setCustomValidity("Your CV must be 3 MB or smaller.");
    teacherForm.reportValidity();
    setFormStatus(teacherStatus, "Your CV must be 3 MB or smaller.", "error");
    return;
  }
  cvInput.setCustomValidity("");

  const payload = collectFormData(teacherForm);
  delete payload.cv;
  payload.experience_years =
    payload.experience_years === "" ? "" : Number(payload.experience_years);

  submitButton.disabled = true;
  submitButton.textContent = "Sending application...";
  setFormStatus(teacherStatus, "Submitting your application...", "loading");

  try {
    payload.cv_name = cvFile.name;
    payload.cv_data = await readFileAsDataUrl(cvFile);

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
    const successMessage =
      result.emailStatus === "sent"
        ? "Your tutor application has been submitted successfully. We sent a confirmation email. Please check your inbox and spam or junk folder. Our team will review your application and contact you regarding the next steps."
        : result.emailStatus === "skipped"
          ? "Your tutor application has been submitted successfully. Our team will review your application and contact you regarding the next steps."
          : "Your tutor application has been submitted successfully. Our team will review it; however, the confirmation email could not be delivered right now.";
    setFormStatus(
      teacherStatus,
      successMessage,
      "success"
    );
    teacherStatus.classList.add("submission-confirmation");
    window.setTimeout(
      () => teacherStatus.classList.remove("submission-confirmation"),
      12000
    );
  } catch (error) {
    const offlineMessage = isLocalFrontend() && error instanceof TypeError
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message || "We could not submit your application right now.";
    setFormStatus(teacherStatus, offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Application";
  }
});

teacherForm?.elements.cv?.addEventListener("change", (event) => {
  event.currentTarget.setCustomValidity("");
});
