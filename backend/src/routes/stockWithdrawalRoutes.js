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

  return { packs, units };
}

function sendError(res, error, fallbackMessage) {
  console.error("[Stock Withdrawals]", error.message);

  return res.status(error.status || 500).json({
    message: error.status ? error.message : fallbackMessage,
  });
}

function makeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getActiveTeller(client, businessId, tellerId) {
  const result = await client.query(
    `SELECT id, name, "businessId", "isActive"
     FROM "Teller"
     WHERE id = $1
       AND "businessId" = $2`,
    [tellerId, businessId]
  );

  if (result.rows.length === 0) {
    throw makeError("Teller not found for this business.", 404);
  }

  if (!result.rows[0].isActive) {
    throw makeError("This teller account is suspended.", 403);
  }

  return result.rows[0];
}

async function validateOptionalTeller(client, businessId, tellerId) {
  if (
    tellerId === undefined ||
    tellerId === null ||
    tellerId === ""
  ) {
    return null;
  }

  const parsedId = Number(tellerId);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw makeError("Invalid teller ID.");
  }

  return getActiveTeller(client, businessId, parsedId);
}

function validateWithdrawalInput({
  businessId,
  tellerId,
  productId,
  packsWithdrawn,
  unitsWithdrawn,
  reason,
}) {
  if (
    !businessId ||
    !Number.isInteger(Number(tellerId)) ||
    Number(tellerId) <= 0 ||
    !Number.isInteger(Number(productId)) ||
    Number(productId) <= 0 ||
    !validNonNegativeNumber(packsWithdrawn) ||
    !validNonNegativeNumber(unitsWithdrawn) ||
    (Number(packsWithdrawn) === 0 &&
      Number(unitsWithdrawn) === 0) ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    throw makeError(
      "Enter a valid teller, product, withdrawal quantity, and reason."
    );
  }
}

// Locks products in ascending ID order to reduce deadlock risk.
async function lockProducts(client, businessId, productIds) {
  const ids = [...new Set(productIds.map(Number))].sort(
    (a, b) => a - b
  );

  const products = new Map();

  for (const productId of ids) {
    const result = await client.query(
      `SELECT *
       FROM "Product"
       WHERE id = $1
         AND "businessId" = $2
       FOR UPDATE`,
      [productId, businessId]
    );

    if (result.rows.length === 0) {
      throw makeError(
        `Product ${productId} was not found for this business.`,
        404
      );
    }

    const product = result.rows[0];
    const unitsPerPack = Number(product.unitsPerPack);

    if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
      throw makeError(
        `Invalid units-per-pack setting for ${product.stockName}.`
      );
    }

    const totalUnits =
      Number(product.stockPacks || 0) * unitsPerPack +
      Number(product.stockUnits || 0);

    if (!Number.isFinite(totalUnits) || totalUnits < 0) {
      throw makeError(
        `Invalid current stock balance for ${product.stockName}.`
      );
    }

    products.set(productId, {
      ...product,
      unitsPerPack,
      totalUnits,
    });
  }

  return products;
}

async function saveProductStock(
  client,
  businessId,
  product,
  totalUnits
) {
  if (totalUnits < -1e-8) {
    throw makeError(
      `Insufficient stock for ${product.stockName}.`
    );
  }

  const stock = normaliseStock(
    Math.max(0, totalUnits),
    product.unitsPerPack
  );

  await client.query(
    `UPDATE "Product"
     SET "stockPacks" = $1,
         "stockUnits" = $2,
         "updatedAt" = NOW()
     WHERE id = $3
       AND "businessId" = $4`,
    [stock.packs, stock.units, product.id, businessId]
  );

  return stock;
}

// GET /api/withdrawals?businessId=B60001
// GET /api/withdrawals?businessId=B60001&tellerId=1
router.get("/", async (req, res) => {
  const { businessId, tellerId } = req.query;

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  let client;

  try {
    client = await pool.connect();

    const teller = await validateOptionalTeller(
      client,
      businessId,
      tellerId
    );

    const result = await client.query(
      `SELECT
         w.id,
         w."businessId",
         w."tellerId",
         t.name AS "tellerName",
         w."productId",
         w."productName",
         w."packsWithdrawn",
         w."unitsWithdrawn",
         w."totalUnits",
         w.reason,
         w."createdAt"
       FROM "StockWithdrawal" w
       LEFT JOIN "Teller" t
         ON t.id = w."tellerId"
       WHERE w."businessId" = $1
         AND ($2::INTEGER IS NULL OR w."tellerId" = $2)
       ORDER BY w."createdAt" DESC, w.id DESC`,
      [businessId, teller ? teller.id : null]
    );

    return res.json({
      withdrawals: result.rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load stock withdrawal history."
    );
  } finally {
    if (client) client.release();
  }
});

// POST /api/withdrawals
router.post("/", async (req, res) => {
  const {
    businessId,
    tellerId,
    productId,
    packsWithdrawn,
    unitsWithdrawn,
    reason,
  } = req.body;

  let client;

  try {
    validateWithdrawalInput({
      businessId,
      tellerId,
      productId,
      packsWithdrawn,
      unitsWithdrawn,
      reason,
    });

    client = await pool.connect();
    await client.query("BEGIN");

    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const products = await lockProducts(
      client,
      businessId,
      [Number(productId)]
    );

    const product = products.get(Number(productId));
    const packs = Number(packsWithdrawn);
    const units = Number(unitsWithdrawn);
    const totalUnits = packs * product.unitsPerPack + units;

    if (totalUnits > product.totalUnits + 1e-8) {
      throw makeError(
        `Insufficient stock for ${product.stockName}. ` +
        `Available: ${Math.max(0, product.totalUnits)} ${product.unitName}.`
      );
    }

    const withdrawalResult = await client.query(
      `INSERT INTO "StockWithdrawal"
         ("businessId", "tellerId", "productId", "productName",
          "packsWithdrawn", "unitsWithdrawn", "totalUnits", reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        businessId,
        teller.id,
        product.id,
        product.stockName,
        packs,
        units,
        totalUnits,
        reason.trim(),
      ]
    );

    const stock = await saveProductStock(
      client,
      businessId,
      product,
      product.totalUnits - totalUnits
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Stock withdrawal recorded successfully.",
      withdrawal: {
        ...withdrawalResult.rows[0],
        tellerName: teller.name,
      },
      stock,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Stock Withdrawals] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to record stock withdrawal. No changes were saved."
    );
  } finally {
    if (client) client.release();
  }
});

// PATCH /api/withdrawals/:id
// Body: { businessId, tellerId, productId, packsWithdrawn,
//         unitsWithdrawn, reason }
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    businessId,
    tellerId,
    productId,
    packsWithdrawn,
    unitsWithdrawn,
    reason,
  } = req.body;

  let client;

  try {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw makeError("Invalid withdrawal ID.");
    }

    validateWithdrawalInput({
      businessId,
      tellerId,
      productId,
      packsWithdrawn,
      unitsWithdrawn,
      reason,
    });

    client = await pool.connect();
    await client.query("BEGIN");

    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const withdrawalResult = await client.query(
      `SELECT *
       FROM "StockWithdrawal"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [Number(id), businessId, teller.id]
    );

    if (withdrawalResult.rows.length === 0) {
      throw makeError(
        "Stock withdrawal not found for this teller.",
        404
      );
    }

    const oldWithdrawal = withdrawalResult.rows[0];
    const oldProductId = Number(oldWithdrawal.productId);
    const newProductId = Number(productId);

    const products = await lockProducts(
      client,
      businessId,
      [oldProductId, newProductId]
    );

    const oldProduct = products.get(oldProductId);
    const newProduct = products.get(newProductId);

    const oldTotalUnits = Number(oldWithdrawal.totalUnits);

    if (!Number.isFinite(oldTotalUnits) || oldTotalUnits < 0) {
      throw makeError(
        "The existing withdrawal has an invalid stock quantity."
      );
    }

    // Reverse the old withdrawal before calculating the replacement.
    const availableAfterReversal = new Map();

    for (const [productKey, product] of products.entries()) {
      availableAfterReversal.set(productKey, product.totalUnits);
    }

    availableAfterReversal.set(
      oldProductId,
      oldProduct.totalUnits + oldTotalUnits
    );

    const packs = Number(packsWithdrawn);
    const units = Number(unitsWithdrawn);
    const newTotalUnits =
      packs * newProduct.unitsPerPack + units;
    const newAvailable = availableAfterReversal.get(newProductId);

    if (newTotalUnits > newAvailable + 1e-8) {
      throw makeError(
        `Insufficient stock for ${newProduct.stockName}. ` +
        `Available after reversing the previous withdrawal: ${Math.max(0, newAvailable)} ` +
        `${newProduct.unitName}.`
      );
    }

    // Calculate each affected product's final stock balance.
    const finalTotals = new Map(availableAfterReversal);

    finalTotals.set(
      newProductId,
      newAvailable - newTotalUnits
    );

    // If both IDs are the same, the final value correctly represents
    // current stock + old withdrawal - new withdrawal.
    for (const [productKey, product] of products.entries()) {
      await saveProductStock(
        client,
        businessId,
        product,
        finalTotals.get(productKey)
      );
    }

    const updatedResult = await client.query(
      `UPDATE "StockWithdrawal"
       SET "productId" = $1,
           "productName" = $2,
           "packsWithdrawn" = $3,
           "unitsWithdrawn" = $4,
           "totalUnits" = $5,
           reason = $6
       WHERE id = $7
         AND "businessId" = $8
         AND "tellerId" = $9
       RETURNING *`,
      [
        newProduct.id,
        newProduct.stockName,
        packs,
        units,
        newTotalUnits,
        reason.trim(),
        oldWithdrawal.id,
        businessId,
        teller.id,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Stock withdrawal updated and stock adjusted successfully.",
      withdrawal: {
        ...updatedResult.rows[0],
        tellerName: teller.name,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Stock Withdrawals] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to update stock withdrawal. No changes were saved."
    );
  } finally {
    if (client) client.release();
  }
});

// DELETE /api/withdrawals/:id
// Body: { businessId, tellerId }
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { businessId, tellerId } = req.body;

  let client;

  try {
    if (
      !Number.isInteger(Number(id)) ||
      Number(id) <= 0 ||
      !businessId ||
      !Number.isInteger(Number(tellerId)) ||
      Number(tellerId) <= 0
    ) {
      throw makeError(
        "A valid withdrawal ID, business ID, and teller ID are required."
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const withdrawalResult = await client.query(
      `SELECT *
       FROM "StockWithdrawal"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [Number(id), businessId, teller.id]
    );

    if (withdrawalResult.rows.length === 0) {
      throw makeError(
        "Stock withdrawal not found for this teller.",
        404
      );
    }

    const withdrawal = withdrawalResult.rows[0];
    const productId = Number(withdrawal.productId);

    const products = await lockProducts(
      client,
      businessId,
      [productId]
    );

    const product = products.get(productId);
    const oldTotalUnits = Number(withdrawal.totalUnits);

    if (!Number.isFinite(oldTotalUnits) || oldTotalUnits < 0) {
      throw makeError(
        "The existing withdrawal has an invalid stock quantity."
      );
    }

    // A withdrawal removed stock, so deleting it adds that stock back.
    const stock = await saveProductStock(
      client,
      businessId,
      product,
      product.totalUnits + oldTotalUnits
    );

    await client.query(
      `DELETE FROM "StockWithdrawal"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3`,
      [withdrawal.id, businessId, teller.id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Stock withdrawal deleted and stock restored successfully.",
      id: withdrawal.id,
      stock,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Stock Withdrawals] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to delete stock withdrawal. No changes were saved."
    );
  } finally {
    if (client) client.release();
  }
});

export default router;