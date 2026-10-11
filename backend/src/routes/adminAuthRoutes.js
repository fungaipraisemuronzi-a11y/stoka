
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Enter your admin username and password.",
      });
    }

    if (!process.env.ADMIN_JWT_SECRET) {
      console.error("ADMIN_JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Admin authentication is not configured.",
      });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, is_active
       FROM admin_users
       WHERE username = $1
       LIMIT 1`,
      [username.trim()]
    );

    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        sub: String(admin.id),
        role: "admin",
      },
      process.env.ADMIN_JWT_SECRET,
      {
        expiresIn: "8h",
        issuer: "stoka-admin",
        audience: "stoka-admin-website",
      }
    );

    return res.json({
      message: "Admin login successful.",
      token,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error.message);

    return res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});

export default router;
