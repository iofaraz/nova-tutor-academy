const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

router.get("/", async (req, res, next) => {
  const limit = Number(req.query.limit || 0);
  const random = String(req.query.random || "").toLowerCase() === "true" || req.query.random === "1";

  try {
    const clauses = [
      "SELECT id, name, qualification, experience_years, subjects, city, profile_note, image_path",
      "FROM faculty_members",
      "WHERE is_active = 1",
    ];

    if (random && limit > 0) {
      const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 12);
      clauses.push("ORDER BY display_order ASC, experience_years DESC, name ASC");
      clauses.push("LIMIT 24");

      const [faculty] = await pool.execute(clauses.join("\n"));
      return res.json({ faculty: shuffle(faculty).slice(0, safeLimit) });
    } else {
      clauses.push("ORDER BY display_order ASC, experience_years DESC, name ASC");
    }

    const [faculty] = await pool.execute(clauses.join("\n"));

    return res.json({ faculty });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
