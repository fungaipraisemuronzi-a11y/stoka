import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function validNonNegativeNumber(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );
}

function normaliseStock(totalUnits, unitsPerPack) {
  const packs = Math.floor((totalUnits + 1e-9) / unitsPerPack);
  const units = Math.max(
    0,
    Number((totalUnits - packs * unitsPerPack).toFixed(8))
  );

  return {
    packs,
    units,
  };
}

async function getBusinessAndProduct(client, businessId, productId) {
  // Verify that the business exists.
  // No isActive restriction is applied.
  const businessResult = await client.query(
    `SELECT id
     FROM "Business"
     WHERE id = $1`,
    [businessId]
  );

  if (businessResult.rows.length === 0) {
    const error = new Error("Business not found.");
    error.status = 404;
    throw error;
  }

  // Verify that the product belongs to this business.
  const productResult = await client.query(
    `SELECT *
     FROM "Product"
     WHERE id = $1 AND "businessId" = $2
     FOR UPDATE`,
    [productId, businessId]
  );

  if (productResult.rows.length === 0) {
    const error = new Error("Product not found for this business.");
    error.status = 404;
    throw error;
  }

  return productResult.rows[0];
}

function calculatePurchase(
  packsAdded,
  unitsAdded,
  pricePerPack,
  unitsPerPack
) {
  const quantity = packsAdded * unitsPerPack + unitsAdded;

  const totalCost =
    packsAdded * pricePerPack +
    unitsAdded * (pricePerPack / unitsPerPack);

  return {
    quantity,
    totalCost: Number(totalCost.toFixed(2)),
  };
}

// GET /api/stock/purchases?businessId=B60001
router.get("/purchases", async (req, res) => {
  const { businessId } = req.query;

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         sp.id,
         sp."businessId",
         sp."productId",
         p."stockName" AS "productName",
         sp."packsAdded",
         sp."unitsAdded",
         sp."purchasePricePerPack",
         sp."totalCost",
         sp."createdAt"
       FROM "StockPurchase" sp
       JOIN "Product" p ON p.id = sp."productId"
       WHERE sp."businessId" = $1
       ORDER BY sp."createdAt" DESC, sp.id DESC`,
      [businessId]
    );

    return res.json({ purchases: result.rows });
  } catch (error) {
    console.error("Load purchases error:", error.message);

    return res.status(500).json({
      message: "Failed to load purchase history.",
    });
  }
});

// POST /api/stock/purchases
router.post("/purchases", async (req, res) => {
  const {
    businessId,
    productId,
    packsAdded,
    unitsAdded,
    purchasePricePerPack,
  } = req.body;

  if (
    !businessId ||
    !productId ||
    !validNonNegativeNumber(packsAdded) ||
    !validNonNegativeNumber(unitsAdded) ||
    !validNonNegativeNumber(purchasePricePerPack) ||
    (Number(packsAdded) === 0 && Number(unitsAdded) === 0)
  ) {
    return res.status(400).json({
      message:
        "Enter a product, a valid quantity, and a valid purchase price.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const product = await getBusinessAndProduct(
      client,
      businessId,
      productId
    );

    const unitsPerPack = Number(product.unitsPerPack);

    if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
      throw new Error(
        "Product units per pack must be greater than zero."
      );
    }

    const packs = Number(packsAdded);
    const units = Number(unitsAdded);
    const price = Number(purchasePricePerPack);

    const purchase = calculatePurchase(
      packs,
      units,
      price,
      unitsPerPack
    );

    const currentTotal =
      Number(product.stockPacks) * unitsPerPack +
      Number(product.stockUnits);

    const updatedStock = normaliseStock(
      currentTotal + purchase.quantity,
      unitsPerPack
    );

    const insertResult = await client.query(
      `INSERT INTO "StockPurchase"
         ("businessId", "productId", "packsAdded", "unitsAdded",
          "purchasePricePerPack", "totalCost")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        productId,
        packs,
        units,
        price,
        purchase.totalCost,
      ]
    );

    await client.query(
      `UPDATE "Product"
       SET "stockPacks" = $1,
           "stockUnits" = $2,
           "updatedAt" = NOW()
       WHERE id = $3 AND "businessId" = $4`,
      [updatedStock.packs, updatedStock.units, productId, businessId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Purchase recorded successfully.",
      purchase: insertResult.rows[0],
      stock: updatedStock,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Record purchase error:", error.message);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Failed to record purchase.",
    });
  } finally {
    client.release();
  }
});

// PUT /api/stock/purchases/:id
// Edit the quantity or purchase price of an existing purchase.
router.put("/purchases/:id", async (req, res) => {
  const {
    businessId,
    packsAdded,
    unitsAdded,
    purchasePricePerPack,
  } = req.body;

  const purchaseId = Number(req.params.id);

  if (
    !businessId ||
    !Number.isInteger(purchaseId) ||
    purchaseId <= 0 ||
    !validNonNegativeNumber(packsAdded) ||
    !validNonNegativeNumber(unitsAdded) ||
    !validNonNegativeNumber(purchasePricePerPack) ||
    (Number(packsAdded) === 0 && Number(unitsAdded) === 0)
  ) {
    return res.status(400).json({
      message: "Enter valid purchase quantities and price.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchaseResult = await client.query(
      `SELECT *
       FROM "StockPurchase"
       WHERE id = $1 AND "businessId" = $2
       FOR UPDATE`,
      [purchaseId, businessId]
    );

    if (purchaseResult.rows.length === 0) {
      const error = new Error("Purchase record not found.");
      error.status = 404;
      throw error;
    }

    const oldPurchase = purchaseResult.rows[0];

    const product = await getBusinessAndProduct(
      client,
      businessId,
      oldPurchase.productId
    );

    const unitsPerPack = Number(product.unitsPerPack);

    if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
      throw new Error(
        "Product units per pack must be greater than zero."
      );
    }

    const oldQuantity =
      Number(oldPurchase.packsAdded) * unitsPerPack +
      Number(oldPurchase.unitsAdded);

    const packs = Number(packsAdded);
    const units = Number(unitsAdded);
    const price = Number(purchasePricePerPack);

    const newPurchase = calculatePurchase(
      packs,
      units,
      price,
      unitsPerPack
    );

    const currentTotal =
      Number(product.stockPacks) * unitsPerPack +
      Number(product.stockUnits);

    const adjustedTotal =
      currentTotal - oldQuantity + newPurchase.quantity;

    if (adjustedTotal < -1e-8) {
      const error = new Error(
        "This edit would make stock negative. Check the current stock first."
      );
      error.status = 400;
      throw error;
    }

    const updatedStock = normaliseStock(
      Math.max(0, adjustedTotal),
      unitsPerPack
    );

    const updatedPurchase = await client.query(
      `UPDATE "StockPurchase"
       SET "packsAdded" = $1,
           "unitsAdded" = $2,
           "purchasePricePerPack" = $3,
           "totalCost" = $4
       WHERE id = $5 AND "businessId" = $6
       RETURNING *`,
      [
        packs,
        units,
        price,
        newPurchase.totalCost,
        purchaseId,
        businessId,
      ]
    );

    await client.query(
      `UPDATE "Product"
       SET "stockPacks" = $1,
           "stockUnits" = $2,
           "updatedAt" = NOW()
       WHERE id = $3 AND "businessId" = $4`,
      [updatedStock.packs, updatedStock.units, product.id, businessId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Purchase updated successfully.",
      purchase: updatedPurchase.rows[0],
      stock: updatedStock,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Edit purchase error:", error.message);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Failed to update purchase.",
    });
  } finally {
    client.release();
  }
});

// DELETE /api/stock/purchases/:id?businessId=B60001
router.delete("/purchases/:id", async (req, res) => {
  const businessId = req.query.businessId;
  const purchaseId = Number(req.params.id);

  if (
    !businessId ||
    !Number.isInteger(purchaseId) ||
    purchaseId <= 0
  ) {
    return res.status(400).json({
      message: "A valid business ID and purchase ID are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const purchaseResult = await client.query(
      `SELECT *
       FROM "StockPurchase"
       WHERE id = $1 AND "businessId" = $2
       FOR UPDATE`,
      [purchaseId, businessId]
    );

    if (purchaseResult.rows.length === 0) {
      const error = new Error("Purchase record not found.");
      error.status = 404;
      throw error;
    }

    const purchase = purchaseResult.rows[0];

    const product = await getBusinessAndProduct(
      client,
      businessId,
      purchase.productId
    );

    const unitsPerPack = Number(product.unitsPerPack);

    if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
      throw new Error(
        "Product units per pack must be greater than zero."
      );
    }

    const quantityToRemove =
      Number(purchase.packsAdded) * unitsPerPack +
      Number(purchase.unitsAdded);

    const currentTotal =
      Number(product.stockPacks) * unitsPerPack +
      Number(product.stockUnits);

    const adjustedTotal = currentTotal - quantityToRemove;

    if (adjustedTotal < -1e-8) {
      const error = new Error(
        "Cannot delete this purchase because some of its stock has already been sold, withdrawn, or otherwise used. Stock must be reconciled first."
      );
      error.status = 400;
      throw error;
    }

    const updatedStock = normaliseStock(
      Math.max(0, adjustedTotal),
      unitsPerPack
    );

    await client.query(
      `UPDATE "Product"
       SET "stockPacks" = $1,
           "stockUnits" = $2,
           "updatedAt" = NOW()
       WHERE id = $3 AND "businessId" = $4`,
      [updatedStock.packs, updatedStock.units, product.id, businessId]
    );

    await client.query(
      `DELETE FROM "StockPurchase"
       WHERE id = $1 AND "businessId" = $2`,
      [purchaseId, businessId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Purchase deleted and stock adjusted successfully.",
      stock: updatedStock,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Delete purchase error:", error.message);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Failed to delete purchase.",
    });
  } finally {
    client.release();
  }
});

export default router;