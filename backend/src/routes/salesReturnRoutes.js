import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function positiveNumber(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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
  console.error(`[Sales Returns] ${error.message}`);

  return res.status(error.status || 500).json({
    message: error.status ? error.message : fallbackMessage,
  });
}

// Check only whether the business exists.
// Businesses are allowed to use returns regardless of isActive.
async function getActiveBusiness(client, businessId) {
  const result = await client.query(
    `SELECT id
     FROM "Business"
     WHERE id = $1`,
    [businessId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Business not found.");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

// Check only whether the teller belongs to the business.
// Inactive tellers are also allowed.
async function getActiveTeller(client, businessId, tellerId) {
  const result = await client.query(
    `SELECT id, name, "businessId"
     FROM "Teller"
     WHERE id = $1
       AND "businessId" = $2`,
    [tellerId, businessId]
  );

  if (result.rows.length === 0) {
    const error = new Error(
      "Teller not found for this business."
    );
    error.status = 404;
    throw error;
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
    const error = new Error("Invalid teller ID.");
    error.status = 400;
    throw error;
  }

  return getActiveTeller(client, businessId, parsedId);
}

// GET /api/returns/sales?businessId=B60001&tellerId=1
// Without tellerId, returns sales from the whole business.
router.get("/sales", async (req, res) => {
  const { businessId, tellerId } = req.query;

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await getActiveBusiness(client, businessId);

    const teller = await validateOptionalTeller(
      client,
      businessId,
      tellerId
    );

    const result = await client.query(
      `SELECT
         s.id AS id,
         s.id AS "saleId",
         s."tellerId",
         t.name AS "tellerName",
         s."receiptNumber",
         s."totalAmount",
         s."createdAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', si.id,
               'saleItemId', si.id,
               'productId', si."productId",
               'stockName', si."stockName",
               'quantity', si.quantity,
               'quantitySold', si.quantity,
               'unitSellingPrice', si."unitSellingPrice",
               'discountAmount', si."discountAmount",
               'lineTotal', si."lineTotal",
               'quantityReturned',
                 COALESCE(ri.returned_quantity, 0),
               'returnableQuantity',
                 GREATEST(
                   0,
                   si.quantity - COALESCE(ri.returned_quantity, 0)
                 ),
               'quantityReturnable',
                 GREATEST(
                   0,
                   si.quantity - COALESCE(ri.returned_quantity, 0)
                 )
             )
             ORDER BY si.id
           ) FILTER (WHERE si.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "Sale" s
       LEFT JOIN "Teller" t
         ON t.id = s."tellerId"
       LEFT JOIN "SaleItem" si
         ON si."saleId" = s.id
       LEFT JOIN (
         SELECT
           sri."saleItemId",
           SUM(sri.quantity) AS returned_quantity
         FROM "SaleReturnItem" sri
         JOIN "SaleReturn" sr
           ON sr.id = sri."returnId"
         WHERE sr."businessId" = $1
         GROUP BY sri."saleItemId"
       ) ri
         ON ri."saleItemId" = si.id
       WHERE s."businessId" = $1
         AND ($2::INTEGER IS NULL OR s."tellerId" = $2)
       GROUP BY s.id, t.name
       ORDER BY s."createdAt" DESC, s.id DESC`,
      [businessId, teller ? teller.id : null]
    );

    return res.json({
      sales: result.rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load sales for returns."
    );
  } finally {
    if (client) client.release();
  }
});

// GET /api/returns?businessId=B60001&tellerId=1
// Without tellerId, returns the complete business return history.
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

    await getActiveBusiness(client, businessId);

    const teller = await validateOptionalTeller(
      client,
      businessId,
      tellerId
    );

    const result = await client.query(
      `SELECT
         sr.id,
         sr."businessId",
         sr."tellerId",
         t.name AS "tellerName",
         sr."saleId",
         s."receiptNumber",
         sr."returnNumber",
         sr.reason,
         sr."totalRefund",
         sr."createdAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', sri.id,
               'saleItemId', sri."saleItemId",
               'productId', sri."productId",
               'stockName', sri."stockName",
               'quantity', sri.quantity,
               'unitSellingPrice', sri."unitSellingPrice",
               'refundAmount', sri."refundAmount"
             )
             ORDER BY sri.id
           ) FILTER (WHERE sri.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "SaleReturn" sr
       JOIN "Sale" s
         ON s.id = sr."saleId"
       LEFT JOIN "Teller" t
         ON t.id = sr."tellerId"
       LEFT JOIN "SaleReturnItem" sri
         ON sri."returnId" = sr.id
       WHERE sr."businessId" = $1
         AND ($2::INTEGER IS NULL OR sr."tellerId" = $2)
       GROUP BY sr.id, s."receiptNumber", t.name
       ORDER BY sr."createdAt" DESC, sr.id DESC`,
      [businessId, teller ? teller.id : null]
    );

    return res.json({
      returns: result.rows,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load sales returns history."
    );
  } finally {
    if (client) client.release();
  }
});

// POST /api/returns
router.post("/", async (req, res) => {
  const {
    businessId,
    tellerId,
    saleId,
    reason,
    items,
  } = req.body;

  if (
    !businessId ||
    !Number.isInteger(Number(tellerId)) ||
    Number(tellerId) <= 0 ||
    !Number.isInteger(Number(saleId)) ||
    Number(saleId) <= 0 ||
    typeof reason !== "string" ||
    !reason.trim() ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100
  ) {
    return res.status(400).json({
      message:
        "Business, teller, sale, return reason, and return items are required.",
    });
  }

  if (
    items.some(
      (item) =>
        !item ||
        !Number.isInteger(Number(item.saleItemId)) ||
        Number(item.saleItemId) <= 0 ||
        !positiveNumber(item.quantity)
    )
  ) {
    return res.status(400).json({
      message: "One or more return items have invalid quantities.",
    });
  }

  const parsedTellerId = Number(tellerId);
  const parsedSaleId = Number(saleId);

  // Combine repeated entries for the same sale item.
  const combined = new Map();

  for (const item of items) {
    const saleItemId = Number(item.saleItemId);
    const quantity = Number(item.quantity);

    combined.set(
      saleItemId,
      (combined.get(saleItemId) || 0) + quantity
    );
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    await getActiveBusiness(client, businessId);

    const teller = await getActiveTeller(
      client,
      businessId,
      parsedTellerId
    );

    // A teller can only return a sale recorded by that teller.
    const saleResult = await client.query(
      `SELECT *
       FROM "Sale"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [parsedSaleId, businessId, teller.id]
    );

    if (saleResult.rows.length === 0) {
      const error = new Error(
        "Sale not found for this business and teller."
      );
      error.status = 404;
      throw error;
    }

    const sale = saleResult.rows[0];
    const returnItems = [];
    let totalRefund = 0;

    const sortedItems = [...combined.entries()].sort(
      (a, b) => a[0] - b[0]
    );

    for (const [saleItemId, quantity] of sortedItems) {
      const itemResult = await client.query(
        `SELECT si.*
         FROM "SaleItem" si
         JOIN "Sale" s
           ON s.id = si."saleId"
         WHERE si.id = $1
           AND si."saleId" = $2
           AND s."businessId" = $3
           AND s."tellerId" = $4
         FOR UPDATE OF si`,
        [saleItemId, sale.id, businessId, teller.id]
      );

      if (itemResult.rows.length === 0) {
        const error = new Error(
          `Sale item ${saleItemId} was not found on this teller's receipt.`
        );
        error.status = 404;
        throw error;
      }

      const saleItem = itemResult.rows[0];

      const returnedResult = await client.query(
        `SELECT COALESCE(SUM(sri.quantity), 0) AS quantity
         FROM "SaleReturnItem" sri
         JOIN "SaleReturn" sr
           ON sr.id = sri."returnId"
         WHERE sri."saleItemId" = $1
           AND sr."businessId" = $2`,
        [saleItemId, businessId]
      );

      const alreadyReturned = Number(
        returnedResult.rows[0].quantity
      );
      const quantitySold = Number(saleItem.quantity);
      const remainingReturnable = quantitySold - alreadyReturned;

      if (
        !Number.isFinite(quantitySold) ||
        quantitySold <= 0 ||
        quantity > remainingReturnable + 1e-8
      ) {
        const error = new Error(
          `Cannot return ${quantity} of ${saleItem.stockName}. ` +
          `Only ${Math.max(0, remainingReturnable)} can still be returned.`
        );
        error.status = 400;
        throw error;
      }

      const productResult = await client.query(
        `SELECT *
         FROM "Product"
         WHERE id = $1
           AND "businessId" = $2
         FOR UPDATE`,
        [saleItem.productId, businessId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(
          `Product ${saleItem.stockName} no longer exists for this business.`
        );
        error.status = 404;
        throw error;
      }

      const product = productResult.rows[0];
      const unitsPerPack = Number(product.unitsPerPack);

      if (
        !Number.isFinite(unitsPerPack) ||
        unitsPerPack <= 0
      ) {
        const error = new Error(
          `Invalid units-per-pack setting for ${saleItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      // Refund uses the original line total, including its discount.
      const originalLineTotal = Number(saleItem.lineTotal);

      if (!Number.isFinite(originalLineTotal)) {
        const error = new Error(
          `Invalid original sale total for ${saleItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const effectiveUnitPrice =
        originalLineTotal / quantitySold;

      const refundAmount = roundMoney(
        quantity * effectiveUnitPrice
      );

      // Return quantity is treated as individual stock units.
      const currentTotalUnits =
        Number(product.stockPacks || 0) * unitsPerPack +
        Number(product.stockUnits || 0);

      const updatedStock = normaliseStock(
        currentTotalUnits + quantity,
        unitsPerPack
      );

      await client.query(
        `UPDATE "Product"
         SET "stockPacks" = $1,
             "stockUnits" = $2,
             "updatedAt" = NOW()
         WHERE id = $3
           AND "businessId" = $4`,
        [
          updatedStock.packs,
          updatedStock.units,
          product.id,
          businessId,
        ]
      );

      returnItems.push({
        saleItemId,
        productId: product.id,
        stockName: saleItem.stockName,
        quantity,
        unitSellingPrice: Number(saleItem.unitSellingPrice),
        refundAmount,
      });

      totalRefund = roundMoney(totalRefund + refundAmount);
    }

    const returnNumber =
      `RET-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const returnResult = await client.query(
      `INSERT INTO "SaleReturn"
         ("businessId", "tellerId", "saleId", "returnNumber",
          reason, "totalRefund")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        teller.id,
        sale.id,
        returnNumber,
        reason.trim(),
        totalRefund,
      ]
    );

    const savedReturn = returnResult.rows[0];
    const savedItems = [];

    for (const item of returnItems) {
      const result = await client.query(
        `INSERT INTO "SaleReturnItem"
           ("returnId", "saleItemId", "productId", "stockName",
            quantity, "unitSellingPrice", "refundAmount")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          savedReturn.id,
          item.saleItemId,
          item.productId,
          item.stockName,
          item.quantity,
          item.unitSellingPrice,
          item.refundAmount,
        ]
      );

      savedItems.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Sales return recorded successfully.",
      return: {
        ...savedReturn,
        tellerName: teller.name,
      },
      items: savedItems,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Sales Returns] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to record sales return. No return or stock changes were saved."
    );
  } finally {
    if (client) {
      client.release();
    }
  }
});

/* =========================================================
   PATCH /api/returns/:id
   Edit a return's reason and returned quantities.
   Body: { businessId, tellerId, reason, items: [{ saleItemId, quantity }] }
========================================================= */
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { businessId, tellerId, reason, items } = req.body;

  if (
    !Number.isInteger(Number(id)) ||
    Number(id) <= 0 ||
    !businessId ||
    !Number.isInteger(Number(tellerId)) ||
    Number(tellerId) <= 0 ||
    typeof reason !== "string" ||
    !reason.trim() ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100 ||
    items.some(
      (item) =>
        !item ||
        !Number.isInteger(Number(item.saleItemId)) ||
        Number(item.saleItemId) <= 0 ||
        !positiveNumber(item.quantity)
    )
  ) {
    return res.status(400).json({
      message: "Enter a valid return, reason, and return quantities.",
    });
  }

  const combined = new Map();

  for (const item of items) {
    const saleItemId = Number(item.saleItemId);
    combined.set(
      saleItemId,
      (combined.get(saleItemId) || 0) + Number(item.quantity)
    );
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    await getActiveBusiness(client, businessId);

    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const returnResult = await client.query(
      `SELECT *
       FROM "SaleReturn"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [Number(id), businessId, teller.id]
    );

    if (returnResult.rows.length === 0) {
      const error = new Error("Sales return not found for this teller.");
      error.status = 404;
      throw error;
    }

    const savedReturn = returnResult.rows[0];

    const saleResult = await client.query(
      `SELECT *
       FROM "Sale"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [savedReturn.saleId, businessId, teller.id]
    );

    if (saleResult.rows.length === 0) {
      const error = new Error("The original sale could not be found.");
      error.status = 404;
      throw error;
    }

    // Lock and read the existing return items.
    const oldItemsResult = await client.query(
      `SELECT *
       FROM "SaleReturnItem"
       WHERE "returnId" = $1
       ORDER BY "productId", id
       FOR UPDATE`,
      [savedReturn.id]
    );

    // Reverse the stock increase caused by the original return.
    for (const oldItem of oldItemsResult.rows) {
      const productResult = await client.query(
        `SELECT *
         FROM "Product"
         WHERE id = $1
           AND "businessId" = $2
         FOR UPDATE`,
        [oldItem.productId, businessId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(
          `Product ${oldItem.stockName} no longer exists.`
        );
        error.status = 400;
        throw error;
      }

      const product = productResult.rows[0];
      const unitsPerPack = Number(product.unitsPerPack);

      if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
        const error = new Error(
          `Invalid units-per-pack setting for ${oldItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const currentTotal =
        Number(product.stockPacks || 0) * unitsPerPack +
        Number(product.stockUnits || 0);

      const quantityToReverse = Number(oldItem.quantity);

      if (currentTotal + 1e-8 < quantityToReverse) {
        const error = new Error(
          `Cannot edit this return because there is not enough stock to reverse ` +
          `the previous return of ${oldItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const stock = normaliseStock(
        Math.max(0, currentTotal - quantityToReverse),
        unitsPerPack
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
    }

    const updatedItems = [];
    let totalRefund = 0;

    const sortedItems = [...combined.entries()].sort(
      (a, b) => a[0] - b[0]
    );

    for (const [saleItemId, quantity] of sortedItems) {
      const saleItemResult = await client.query(
        `SELECT si.*
         FROM "SaleItem" si
         JOIN "Sale" s ON s.id = si."saleId"
         WHERE si.id = $1
           AND si."saleId" = $2
           AND s."businessId" = $3
           AND s."tellerId" = $4
         FOR UPDATE OF si`,
        [
          saleItemId,
          savedReturn.saleId,
          businessId,
          teller.id,
        ]
      );

      if (saleItemResult.rows.length === 0) {
        const error = new Error(
          `Sale item ${saleItemId} was not found on the original receipt.`
        );
        error.status = 404;
        throw error;
      }

      const saleItem = saleItemResult.rows[0];

      // Exclude the current return when checking quantities already returned.
      const returnedResult = await client.query(
        `SELECT COALESCE(SUM(sri.quantity), 0) AS quantity
         FROM "SaleReturnItem" sri
         JOIN "SaleReturn" sr ON sr.id = sri."returnId"
         WHERE sri."saleItemId" = $1
           AND sr."businessId" = $2
           AND sr.id <> $3`,
        [saleItemId, businessId, savedReturn.id]
      );

      const quantitySold = Number(saleItem.quantity);
      const alreadyReturned = Number(returnedResult.rows[0].quantity);
      const remaining = quantitySold - alreadyReturned;

      if (
        !Number.isFinite(quantitySold) ||
        quantitySold <= 0 ||
        quantity > remaining + 1e-8
      ) {
        const error = new Error(
          `Cannot return ${quantity} of ${saleItem.stockName}. ` +
          `Only ${Math.max(0, remaining)} can be returned, excluding this return.`
        );
        error.status = 400;
        throw error;
      }

      const productResult = await client.query(
        `SELECT *
         FROM "Product"
         WHERE id = $1
           AND "businessId" = $2
         FOR UPDATE`,
        [saleItem.productId, businessId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(
          `Product ${saleItem.stockName} no longer exists.`
        );
        error.status = 404;
        throw error;
      }

      const product = productResult.rows[0];
      const unitsPerPack = Number(product.unitsPerPack);

      if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
        const error = new Error(
          `Invalid units-per-pack setting for ${saleItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const originalLineTotal = Number(saleItem.lineTotal);

      if (
        !Number.isFinite(originalLineTotal) ||
        !Number.isFinite(quantitySold)
      ) {
        const error = new Error(
          `Invalid original sale amount for ${saleItem.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const refundAmount = roundMoney(
        quantity * (originalLineTotal / quantitySold)
      );

      const currentTotal =
        Number(product.stockPacks || 0) * unitsPerPack +
        Number(product.stockUnits || 0);

      const stock = normaliseStock(
        currentTotal + quantity,
        unitsPerPack
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

      updatedItems.push({
        saleItemId,
        productId: product.id,
        stockName: saleItem.stockName,
        quantity,
        unitSellingPrice: Number(saleItem.unitSellingPrice),
        refundAmount,
      });

      totalRefund = roundMoney(totalRefund + refundAmount);
    }

    await client.query(
      `DELETE FROM "SaleReturnItem"
       WHERE "returnId" = $1`,
      [savedReturn.id]
    );

    const updatedReturnResult = await client.query(
      `UPDATE "SaleReturn"
       SET reason = $1,
           "totalRefund" = $2
       WHERE id = $3
         AND "businessId" = $4
         AND "tellerId" = $5
       RETURNING *`,
      [
        reason.trim(),
        totalRefund,
        savedReturn.id,
        businessId,
        teller.id,
      ]
    );

    const newItems = [];

    for (const item of updatedItems) {
      const result = await client.query(
        `INSERT INTO "SaleReturnItem"
           ("returnId", "saleItemId", "productId", "stockName",
            quantity, "unitSellingPrice", "refundAmount")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          savedReturn.id,
          item.saleItemId,
          item.productId,
          item.stockName,
          item.quantity,
          item.unitSellingPrice,
          item.refundAmount,
        ]
      );

      newItems.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return res.json({
      message: "Sales return updated successfully.",
      return: {
        ...updatedReturnResult.rows[0],
        tellerName: teller.name,
      },
      items: newItems,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Sales Returns] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to update sales return. No changes were saved."
    );
  } finally {
    if (client) client.release();
  }
});

/* =========================================================
   DELETE /api/returns/:id
   Delete a return and reverse its stock increase.
========================================================= */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { businessId, tellerId } = req.body;

  if (
    !Number.isInteger(Number(id)) ||
    Number(id) <= 0 ||
    !businessId ||
    !Number.isInteger(Number(tellerId)) ||
    Number(tellerId) <= 0
  ) {
    return res.status(400).json({
      message:
        "A valid return ID, business ID, and teller ID are required.",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    await getActiveBusiness(client, businessId);

    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const returnResult = await client.query(
      `SELECT *
       FROM "SaleReturn"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3
       FOR UPDATE`,
      [Number(id), businessId, teller.id]
    );

    if (returnResult.rows.length === 0) {
      const error = new Error("Sales return not found for this teller.");
      error.status = 404;
      throw error;
    }

    const savedReturn = returnResult.rows[0];

    const itemsResult = await client.query(
      `SELECT *
       FROM "SaleReturnItem"
       WHERE "returnId" = $1
       ORDER BY "productId", id
       FOR UPDATE`,
      [savedReturn.id]
    );

    // Remove the stock previously added by each returned item.
    for (const item of itemsResult.rows) {
      const productResult = await client.query(
        `SELECT *
         FROM "Product"
         WHERE id = $1
           AND "businessId" = $2
         FOR UPDATE`,
        [item.productId, businessId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(
          `Cannot delete this return because product ${item.stockName} no longer exists.`
        );
        error.status = 400;
        throw error;
      }

      const product = productResult.rows[0];
      const unitsPerPack = Number(product.unitsPerPack);

      if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
        const error = new Error(
          `Invalid units-per-pack setting for ${item.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const currentTotal =
        Number(product.stockPacks || 0) * unitsPerPack +
        Number(product.stockUnits || 0);

      const quantityToReverse = Number(item.quantity);

      if (currentTotal + 1e-8 < quantityToReverse) {
        const error = new Error(
          `Cannot delete this return because there is not enough stock to reverse ` +
          `the returned quantity of ${item.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const stock = normaliseStock(
        Math.max(0, currentTotal - quantityToReverse),
        unitsPerPack
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
    }

    await client.query(
      `DELETE FROM "SaleReturnItem"
       WHERE "returnId" = $1`,
      [savedReturn.id]
    );

    await client.query(
      `DELETE FROM "SaleReturn"
       WHERE id = $1
         AND "businessId" = $2
         AND "tellerId" = $3`,
      [savedReturn.id, businessId, teller.id]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Sales return deleted and stock adjusted successfully.",
      id: savedReturn.id,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "[Sales Returns] Rollback error:",
          rollbackError.message
        );
      }
    }

    return sendError(
      res,
      error,
      "Failed to delete sales return. No changes were saved."
    );
  } finally {
    if (client) client.release();
  }
});

export default router;