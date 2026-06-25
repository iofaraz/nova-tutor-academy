function errorHandler(error, req, res, next) {
  console.error(error);

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

  return res.status(500).json({
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong on the server.",
  });
}

module.exports = errorHandler;