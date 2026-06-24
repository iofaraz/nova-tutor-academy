const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [faculty] = await pool.execute(
      `SELECT id, name, qualification, experience_years, subjects, city, profile_note
       FROM faculty_members
       WHERE is_active = 1
       ORDER BY display_order ASC, experience_years DESC, name ASC`
    );

    return res.json({ faculty });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
