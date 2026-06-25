// const express = require("express");
// const path = require("path");

// function createFrontendRouter(frontendDirectory) {
//   const router = express.Router();

//   router.use(express.static(frontendDirectory));
//   router.use("/pages", express.static(path.join(frontendDirectory, "pages")));

//   router.get("/", (req, res) => {
//     res.sendFile(path.join(frontendDirectory, "index.html"));
//   });

//   router.get("/pages/:page", (req, res) => {
//     res.sendFile(path.join(frontendDirectory, "pages", `${req.params.page}.html`));
//   });

//   return router;
// }

// module.exports = { createFrontendRouter };