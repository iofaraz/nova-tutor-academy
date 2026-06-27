(function (global) {
  const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

  function isLocalFrontend() {
    return (
      window.location.protocol === "file:" ||
      LOCAL_HOSTNAMES.has(window.location.hostname)
    );
  }

  function getApiBase(path = "/api") {
    // Local file opens use localhost:5000; production uses same-origin /api.
    return isLocalFrontend() ? `http://localhost:5000${path}` : path;
  }

  function setFormStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `form-status ${message ? "show" : ""} ${type ? `status-${type}` : ""}`.trim();
  }

  function clearFieldErrors(form) {
    form?.querySelectorAll(".form-group.has-error").forEach((group) => {
      group.classList.remove("has-error");
    });
    form?.querySelectorAll(".form-control.error").forEach((control) => {
      control.classList.remove("error");
    });
    form?.querySelectorAll(".field-error").forEach((error) => error.remove());
  }

  function ensureFieldError(target) {
    const group = target.closest(".form-group") || target.parentElement;
    if (!group) return null;
    let error = group.querySelector(".field-error");
    if (!error) {
      error = document.createElement("span");
      error.className = "field-error";
      error.setAttribute("aria-live", "polite");
      group.appendChild(error);
    }
    group.classList.add("has-error");
    target.classList.add("error");
    return error;
  }

  function applyFieldErrors(form, errors) {
    clearFieldErrors(form);
    const normalizedErrors = Array.isArray(errors) ? errors : [];

    normalizedErrors.forEach((error) => {
      const field = error?.field;
      const message = error?.message || String(error || "Invalid value.");
      if (!field) return;
      const escapedField = window.CSS?.escape
        ? window.CSS.escape(field)
        : String(field).replace(/["\\]/g, "\\$&");
      const target = form?.querySelector(`[name="${escapedField}"]`);
      if (!target) return;
      const errorElement = ensureFieldError(target);
      if (errorElement) {
        errorElement.textContent = message;
      }
    });
  }

  function collectFormData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  global.NovaFormUtils = {
    applyFieldErrors,
    clearFieldErrors,
    collectFormData,
    getApiBase,
    isLocalFrontend,
    setFormStatus,
  };
})(window);
