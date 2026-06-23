const API_BASE_URL =
  window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api";
const studentForm = document.getElementById("studentRequestForm");

const requestedTutorType = new URLSearchParams(window.location.search).get("tutor");
const tutorTypeSelect = document.getElementById("tutor_type");
if (requestedTutorType && tutorTypeSelect) tutorTypeSelect.value = requestedTutorType;

function showStudentStatus(message, type) {
  const status = document.getElementById("studentFormStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `form-status show ${type}`;
}

studentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = studentForm.querySelector(".submit-button");
  const formData = new FormData(studentForm);
  const payload = Object.fromEntries(formData.entries());

  submitButton.disabled = true;
  submitButton.textContent = "Sending request…";
  showStudentStatus("Submitting your details securely…", "info");

  try {
    const response = await fetch(`${API_BASE_URL}/students/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "We could not submit your request.");

    studentForm.reset();
    showStudentStatus("Your request has been received. Our team will contact you shortly.", "success");
  } catch (error) {
    const offlineMessage = window.location.protocol === "file:"
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message;
    showStudentStatus(offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit tutor request";
  }
});
