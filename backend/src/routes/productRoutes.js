
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function validateProduct(body) {
  const stockName = String(body.stockName ?? "").trim();
  const unitName = String(body.unitName ?? "").trim();
  const packName = String(body.packName ?? "").trim();
  const unitsPerPack = Number(body.unitsPerPack);
  const unitSellingPrice = Number(body.unitSellingPrice);

  if (!stockName || !unitName || !packName) {
    return {
      error: "Stock name, unit name, and pack name are required.",
    };
  }

  if (
    !Number.isFinite(unitsPerPack) ||
    unitsPerPack <= 0
  ) {
    return {
      error: "Units per pack must be greater than zero.",
    };
  }

  if (
    !Number.isFinite(unitSellingPrice) ||
    unitSellingPrice < 0
  ) {
    return {
      error: "Unit selling price must be zero or greater.",
    };
  }

  return {
    product: {
      stockName,
      unitName,
      packName,
      unitsPerPack,
      unitSellingPrice,
    },
  };
}


async function getBusinessId(value) {
  const businessId = String(value ?? "").trim();

  if (!businessId) {
    return null;
  }

  const result = await pool.query(
    'SELECT id FROM "Business" WHERE id = $1',
    [businessId]
  );

  return result.rows.length ? businessId : null;
}


// GET /api/products?businessId=B60001
router.get("/", async (req, res) => {
  try {
    const businessId = await getBusinessId(req.query.businessId);

    if (!businessId) {
      return res.status(400).json({
        message: "A valid active businessId is required.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         "businessId",
         "stockName",
         "unitName",
         "packName",
         "unitsPerPack",
         "unitSellingPrice",
         "stockPacks",
         "stockUnits",
         "createdAt",
         "updatedAt"
       FROM "Product"
       WHERE "businessId" = $1
       ORDER BY "stockName" ASC`,
      [businessId]
    );

    return res.json({ products: result.rows });
  } catch (error) {
    console.error("Load products error:", error.message);
    return res.status(500).json({
      message: "Could not load stock items.",
    });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  try {
    const businessId = await getBusinessId(req.body.businessId);

    if (!businessId) {
      return res.status(400).json({
        message: "A valid active businessId is required.",
      });
    }

    const validation = validateProduct(req.body);

    if (validation.error) {
      return res.status(400).json({
        message: validation.error,
      });
    }

    const {
      stockName,
      unitName,
      packName,
      unitsPerPack,
      unitSellingPrice,
    } = validation.product;

    const result = await pool.query(
      `INSERT INTO "Product" (
         "businessId",
         "stockName",
         "unitName",
         "packName",
         "unitsPerPack",
         "unitSellingPrice"
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        stockName,
        unitName,
        packName,
        unitsPerPack,
        unitSellingPrice,
      ]
    );

    return res.status(201).json({
      message: "Stock item created successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A stock item with that name already exists.",
      });
    }

    console.error("Create product error:", error.message);
    return res.status(500).json({
      message: "Could not create the stock item.",
    });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const businessId = await getBusinessId(req.body.businessId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: "Invalid stock item ID.",
      });
    }

    if (!businessId) {
      return res.status(400).json({
        message: "A valid active businessId is required.",
      });
    }

    const validation = validateProduct(req.body);

    if (validation.error) {
      return res.status(400).json({
        message: validation.error,
      });
    }

    const {
      stockName,
      unitName,
      packName,
      unitsPerPack,
      unitSellingPrice,
    } = validation.product;

    const result = await pool.query(
      `UPDATE "Product"
       SET
         "stockName" = $1,
         "unitName" = $2,
         "packName" = $3,
         "unitsPerPack" = $4,
         "unitSellingPrice" = $5,
         "updatedAt" = NOW()
       WHERE id = $6 AND "businessId" = $7
       RETURNING *`,
      [
        stockName,
        unitName,
        packName,
        unitsPerPack,
        unitSellingPrice,
        productId,
        businessId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Stock item not found.",
      });
    }

    return res.json({
      message: "Stock item updated successfully.",
      product: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A stock item with that name already exists.",
      });
    }

    console.error("Update product error:", error.message);
    return res.status(500).json({
      message: "Could not update the stock item.",
    });
  }
});

// DELETE /api/products/:id?businessId=B60001
router.delete("/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const businessId = await getBusinessId(req.query.businessId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: "Invalid stock item ID.",
      });
    }

    if (!businessId) {
      return res.status(400).json({
        message: "A valid active businessId is required.",
      });
    }

    const result = await pool.query(
      `DELETE FROM "Product"
       WHERE id = $1 AND "businessId" = $2
       RETURNING id`,
      [productId, businessId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Stock item not found.",
      });
    }

    return res.json({
      message: "Stock item deleted successfully.",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);
    return res.status(500).json({
      message: "Could not delete the stock item.",
    });
  }
});

export default router;