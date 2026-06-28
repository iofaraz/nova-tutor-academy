function cleanText(value, maxLength, { allowEmpty = false, lowercase = false } = {}) {
  if (value === undefined || value === null) return "";

  let text = String(value).trim();
  if (lowercase) text = text.toLowerCase();
  if (maxLength) text = text.slice(0, maxLength);

  if (!allowEmpty && !text) return "";
  return text;
}

function normalizeEmail(value) {
  return cleanText(value, 150, { lowercase: true });
}

function isValidEmail(email) {
  return Boolean(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return Boolean(phone) && /^[+()\d\s-]{7,20}$/.test(phone);
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return Number.NaN;
  return parsed;
}

function addFieldError(errors, field, message) {
  errors.push({ field, message });
}

module.exports = {
  addFieldError,
  cleanText,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  parseOptionalInteger,
};
