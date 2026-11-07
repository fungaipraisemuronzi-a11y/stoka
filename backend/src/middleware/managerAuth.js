
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export async function requireManager(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        message: "Manager login is required.",
      });
    }

    const secret = process.env.MANAGER_JWT_SECRET;

    if (!secret) {
      return res.status(500).json({
        message: "Manager authentication is not configured.",
      });
    }

    const decoded = jwt.verify(token, secret);

    const result = await pool.query(
      `SELECT
          m.id,
          m.business_id,
          m.manager_number,
          m.username,
          m.is_primary,
          m.status,
          m.is_active,
          b."isActive" AS business_active
       FROM manager_accounts m
       INNER JOIN "Business" b
          ON b.id = m.business_id
       WHERE m.id = $1`,
      [decoded.managerId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "Manager account not found.",
      });
    }

    const manager = result.rows[0];

    if (
      !manager.is_active ||
      manager.status !== "approved" ||
      !manager.business_active
    ) {
      return res.status(403).json({
        message: "This manager account is not authorised.",
      });
    }

    // Ensure the token belongs to the manager's actual business.
    if (
      String(decoded.businessId) !== String(manager.business_id)
    ) {
      return res.status(403).json({
        message: "Invalid manager business session.",
      });
    }

    // Prevent access to another business through request parameters.
    const requestedBusinessId =
      req.body?.businessId ??
      req.query?.businessId ??
      req.params?.businessId;

    if (
      requestedBusinessId &&
      String(requestedBusinessId) !== String(manager.business_id)
    ) {
      return res.status(403).json({
        message: "You cannot access another business.",
      });
    }

    req.manager = {
      id: manager.id,
      businessId: manager.business_id,
      managerNumber: manager.manager_number,
      username: manager.username,
      isPrimary: manager.is_primary,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Your manager session is invalid or has expired.",
      });
    }

    console.error("Manager authentication error:", error);

    return res.status(500).json({
      message: "Could not authenticate manager.",
    });
  }
}

export function requirePrimaryManager(req, res, next) {
  if (!req.manager?.isPrimary) {
    return res.status(403).json({
      message: "Only the Primary Manager can perform this action.",
    });
  }

  next();
}
