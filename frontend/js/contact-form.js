const {
  applyFieldErrors,
  clearFieldErrors,
  collectFormData,
  getApiBase,
  isLocalFrontend,
  setFormStatus,
} = window.NovaFormUtils;

const contactForm = document.getElementById("contactForm");
const contactStatus = document.getElementById("contactFormStatus");
const CONTACT_API_BASE_URL = getApiBase("/api");

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors(contactForm);

  if (!contactForm.reportValidity()) {
    setFormStatus(contactStatus, "Please correct the highlighted fields.", "error");
    return;
  }

  const submitButton = contactForm.querySelector(".submit-button");
  const payload = collectFormData(contactForm);

  submitButton.disabled = true;
  submitButton.textContent = "Sending message...";
  setFormStatus(contactStatus, "Sending your message securely...", "loading");

  try {
    const response = await fetch(`${CONTACT_API_BASE_URL}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      applyFieldErrors(contactForm, result.errors);
      throw new Error(result.message || "We could not send your message right now.");
    }

    contactForm.reset();
    setFormStatus(
      contactStatus,
      result.message ||
        "Your message is sent and a confirmation email has been sent to your inbox.",
      "success"
    );
  } catch (error) {
    const offlineMessage = isLocalFrontend()
      ? "The form is ready, but the backend must be running on localhost:5000 to receive it."
      : error.message;
    setFormStatus(contactStatus, offlineMessage, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Message";
  }
});
