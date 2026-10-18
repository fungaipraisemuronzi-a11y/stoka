import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export default async function adminAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Admin authentication required.",
    });
  }

  const token = authorization.slice(7).trim();

  if (!process.env.ADMIN_JWT_SECRET) {
    console.error("ADMIN_JWT_SECRET is not configured.");

    return res.status(500).json({
      message: "Admin authentication is not configured.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ADMIN_JWT_SECRET,
      {
        issuer: "stoka-admin",
        audience: "stoka-admin-website",
      }
    );

    if (decoded.role !== "admin" || !decoded.sub) {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const result = await pool.query(
      `SELECT id, username
       FROM admin_users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [decoded.sub]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "Unexpected error, please contact Stoka team",
      });
    }

    req.admin = result.rows[0];

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Your admin session is invalid or has expired. Please log in again.",
      });
    }

    console.error("Admin authentication error:", error.message);

    return res.status(500).json({
      message: "Unable to verify admin access.",
    });
  }
}