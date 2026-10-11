import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function validPositiveNumber(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
}

function validNonNegativeNumber(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
  );
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normaliseStock(totalUnits, unitsPerPack) {
  const packs = Math.floor((totalUnits + 1e-9) / unitsPerPack);

  const units = Math.max(
    0,
    Number((totalUnits - packs * unitsPerPack).toFixed(8))
  );

  return { packs, units };
}

// Check that the business exists.
// Inactive businesses are allowed to make sales.
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

async function getActiveTeller(client, businessId, tellerId) {
  const result = await client.query(
    `SELECT id, "businessId", name, "isActive"
     FROM "Teller"
     WHERE id = $1 AND "businessId" = $2`,
    [tellerId, businessId]
  );

  if (result.rows.length === 0) {
    const error = new Error(
      "Teller not found for this business."
    );
    error.status = 404;
    throw error;
  }

  if (!result.rows[0].isActive) {
    const error = new Error(
      "This teller account has been suspended."
    );
    error.status = 403;
    throw error;
  }

  return result.rows[0];
}

// POST /api/sales
//
// Body:
// {
//   businessId: "B60001",
//   tellerId: 1,
//   items: [
//     { productId: 1, quantity: 2, discountAmount: 1.50 }
//   ]
// }
//
// Quantity is measured in loose units.
// Discount is the total discount for each line.

router.post("/", async (req, res) => {
  const { businessId, tellerId, items } = req.body;

  if (
    !businessId ||
    !Number.isInteger(Number(tellerId)) ||
    Number(tellerId) <= 0 ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      message:
        "Business ID, valid teller ID and at least one sale item are required.",
    });
  }

  if (
    items.length > 100 ||
    items.some(
      (item) =>
        !item ||
        !Number.isInteger(Number(item.productId)) ||
        Number(item.productId) <= 0 ||
        !validPositiveNumber(item.quantity) ||
        !validNonNegativeNumber(item.discountAmount ?? 0)
    )
  ) {
    return res.status(400).json({
      message:
        "One or more sale items contain invalid quantities or discounts.",
    });
  }

  const combined = new Map();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const discountAmount = Number(item.discountAmount ?? 0);

    const existing = combined.get(productId) || {
      productId,
      quantity: 0,
      discountAmount: 0,
    };

    existing.quantity += quantity;
    existing.discountAmount += discountAmount;

    combined.set(productId, existing);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify the business exists without checking isActive.
    await getActiveBusiness(client, businessId);

    // Suspended tellers remain blocked.
    const teller = await getActiveTeller(
      client,
      businessId,
      Number(tellerId)
    );

    const saleItems = [];

    let subtotal = 0;
    let discountTotal = 0;
    let totalAmount = 0;

    const sortedItems = [...combined.values()].sort(
      (a, b) => a.productId - b.productId
    );

    for (const item of sortedItems) {
      const productResult = await client.query(
        `SELECT *
         FROM "Product"
         WHERE id = $1 AND "businessId" = $2
         FOR UPDATE`,
        [item.productId, businessId]
      );

      if (productResult.rows.length === 0) {
        const error = new Error(
          `Product ${item.productId} was not found for this business.`
        );
        error.status = 404;
        throw error;
      }

      const product = productResult.rows[0];

      const unitsPerPack = Number(product.unitsPerPack);

      const unitPrice = roundMoney(
        Number(product.unitSellingPrice)
      );

      const quantity = item.quantity;
      const discountAmount = roundMoney(item.discountAmount);

      if (
        !Number.isFinite(unitsPerPack) ||
        unitsPerPack <= 0
      ) {
        const error = new Error(
          `Invalid units-per-pack setting for ${product.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const lineSubtotal = roundMoney(quantity * unitPrice);

      if (discountAmount > lineSubtotal) {
        const error = new Error(
          `Discount cannot exceed the subtotal for ${product.stockName}.`
        );
        error.status = 400;
        throw error;
      }

      const lineTotal = roundMoney(
        lineSubtotal - discountAmount
      );

      const currentTotalUnits =
        Number(product.stockPacks) * unitsPerPack +
        Number(product.stockUnits);

      if (quantity > currentTotalUnits + 1e-8) {
        const error = new Error(
          `Insufficient stock for ${product.stockName}. Available: ${Math.max(
            0,
            currentTotalUnits
          )} ${product.unitName}.`
        );
        error.status = 400;
        throw error;
      }

      const updatedStock = normaliseStock(
        Math.max(0, currentTotalUnits - quantity),
        unitsPerPack
      );

      await client.query(
        `UPDATE "Product"
         SET "stockPacks" = $1,
             "stockUnits" = $2,
             "updatedAt" = NOW()
         WHERE id = $3 AND "businessId" = $4`,
        [
          updatedStock.packs,
          updatedStock.units,
          product.id,
          businessId,
        ]
      );

      saleItems.push({
        productId: product.id,
        stockName: product.stockName,
        quantity,
        unitSellingPrice: unitPrice,
        discountAmount,
        lineTotal,
      });

      subtotal = roundMoney(subtotal + lineSubtotal);

      discountTotal = roundMoney(
        discountTotal + discountAmount
      );

      totalAmount = roundMoney(totalAmount + lineTotal);
    }

    const receiptNumber =
      `STK-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const saleResult = await client.query(
      `INSERT INTO "Sale"
         ("businessId", "tellerId", "receiptNumber",
          "subtotal", "discountTotal", "totalAmount",
          "paymentMethod")
       VALUES ($1, $2, $3, $4, $5, $6, 'cash')
       RETURNING *`,
      [
        businessId,
        teller.id,
        receiptNumber,
        subtotal,
        discountTotal,
        totalAmount,
      ]
    );

    const sale = saleResult.rows[0];
    const savedItems = [];

    for (const item of saleItems) {
      const result = await client.query(
        `INSERT INTO "SaleItem"
           ("saleId", "productId", "stockName", "quantity",
            "unitSellingPrice", "discountAmount", "lineTotal")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          sale.id,
          item.productId,
          item.stockName,
          item.quantity,
          item.unitSellingPrice,
          item.discountAmount,
          item.lineTotal,
        ]
      );

      savedItems.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Sale completed successfully.",
      sale: {
        ...sale,
        tellerName: teller.name,
      },
      items: savedItems,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create sale error:", error.message);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Failed to complete sale. No sale or stock changes were saved.",
    });
  } finally {
    client.release();
  }
});

// GET /api/sales?businessId=B60001
// Optional teller filter:
// GET /api/sales?businessId=B60001&tellerId=1

router.get("/", async (req, res) => {
  const { businessId, tellerId } = req.query;

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  if (
    tellerId !== undefined &&
    (!/^\d+$/.test(String(tellerId)) ||
      Number(tellerId) <= 0)
  ) {
    return res.status(400).json({
      message: "A valid teller ID is required.",
    });
  }

  try {
    // Only verify that the business exists.
    // Inactive businesses can view their sales history.
    const businessResult = await pool.query(
      `SELECT id
       FROM "Business"
       WHERE id = $1`,
      [businessId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        message: "Business not found.",
      });
    }

    if (tellerId !== undefined) {
      const tellerResult = await pool.query(
        `SELECT id
         FROM "Teller"
         WHERE id = $1 AND "businessId" = $2`,
        [Number(tellerId), businessId]
      );

      if (tellerResult.rows.length === 0) {
        return res.status(404).json({
          message: "Teller not found for this business.",
        });
      }
    }

    const result = await pool.query(
      `SELECT
         s.id,
         s."businessId",
         s."tellerId",
         t.name AS "tellerName",
         s."receiptNumber",
         s."subtotal",
         s."discountTotal",
         s."totalAmount",
         s."paymentMethod",
         s."createdAt",
         COALESCE(
           json_agg(
             json_build_object(
               'id', si.id,
               'productId', si."productId",
               'stockName', si."stockName",
               'quantity', si.quantity,
               'unitSellingPrice', si."unitSellingPrice",
               'discountAmount', si."discountAmount",
               'lineTotal', si."lineTotal"
             )
             ORDER BY si.id
           ) FILTER (WHERE si.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM "Sale" s
       LEFT JOIN "Teller" t ON t.id = s."tellerId"
       LEFT JOIN "SaleItem" si ON si."saleId" = s.id
       WHERE s."businessId" = $1
         AND ($2::integer IS NULL OR s."tellerId" = $2)
       GROUP BY s.id, t.name
       ORDER BY s."createdAt" DESC, s.id DESC`,
      [
        businessId,
        tellerId === undefined ? null : Number(tellerId),
      ]
    );

    return res.json({ sales: result.rows });
  } catch (error) {
    console.error("Load sales error:", error.message);

    return res.status(500).json({
      message: "Failed to load sales history.",
    });
  }
});

export default router;