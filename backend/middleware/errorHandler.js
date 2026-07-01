function errorHandler(error, req, res, next) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const logPayload = isDevelopment
    ? error
    : {
        message: error?.message,
        code: error?.code,
      };
  /*! Production note: integrate with a logging service (Winston, Sentry, DataDog, etc.) to track errors in production. */
  console.error("Unhandled server error:", logPayload);

  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Invalid JSON request body." });
  }
  if (error.message === "This origin is not allowed by CORS.") {
    return res.status(403).json({ message: error.message });
  }

  const mysqlErrorCodes = new Set([
    "ER_DUP_ENTRY",
    "ER_DATA_TOO_LONG",
    "WARN_DATA_TRUNCATED",
    "ER_TRUNCATED_WRONG_VALUE",
    "ER_BAD_NULL_ERROR",
    "ER_WARN_DATA_OUT_OF_RANGE",
  ]);
  if (mysqlErrorCodes.has(error.code)) {
    return res.status(400).json({
      message: "The submitted data could not be saved. Please review the form and try again.",
    });
  }

  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      message: "A required service is temporarily unavailable.",
    });
  }

  return res.status(500).json({
    message: "Something went wrong on the server.",
  });
}

module.exports = errorHandler;
