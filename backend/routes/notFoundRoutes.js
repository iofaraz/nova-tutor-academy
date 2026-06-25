const express = require("express");

function createNotFoundRouter() {
  const router = express.Router();

  router.use("/api", (req, res) => {
    res.status(404).json({ message: "API endpoint not found." });
  });

  return router;
}

module.exports = { createNotFoundRouter };