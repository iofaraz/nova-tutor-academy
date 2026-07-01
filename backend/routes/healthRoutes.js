const express = require("express");

function createHealthRouter(testConnection, mailEnabled) {
  const router = express.Router();

  router.get("/health", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await testConnection();
      return res.json({
        status: "ok",
        database: "connected",
        mail: mailEnabled ? "configured" : "not configured",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(503).json({
        status: "error",
        database: "disconnected",
        message: "The database is not available.",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

module.exports = { createHealthRouter };
