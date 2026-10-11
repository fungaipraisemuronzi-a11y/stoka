
import bcrypt from "bcryptjs";
import pool from "../src/config/database.js";

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Set ADMIN_USERNAME and ADMIN_PASSWORD before running this script."
    );
  }

  if (password.length < 12) {
    throw new Error(
      "Use an admin password with at least 12 characters."
    );
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM admin_users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      throw new Error(
        "That admin username already exists. No changes were made."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO admin_users (username, password_hash, is_active)
       VALUES ($1, $2, TRUE)`,
      [username, passwordHash]
    );

    console.log(`Admin account "${username}" created successfully.`);
    console.log("The password was stored as a hash.");
  } finally {
    await pool.end();
  }
}

createAdmin().catch((error) => {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
});
