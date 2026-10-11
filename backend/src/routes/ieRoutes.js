
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

const VALID_CATEGORIES = [
  "purchase_cost",
  "operating_expense",
  "income",
];

const SYSTEM_ITEMS = [
  "stock purchases",
  "sales income",
  "discount allowed",
];

function validAmount(value) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getMonthRange(month, year) {
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    !Number.isInteger(yearNumber) ||
    yearNumber < 2000 ||
    yearNumber > 2200
  ) {
    return null;
  }

  const start = `${yearNumber}-${String(monthNumber).padStart(2, "0")}-01`;

  const nextYear =
    monthNumber === 12 ? yearNumber + 1 : yearNumber;

  const nextMonth =
    monthNumber === 12 ? 1 : monthNumber + 1;

  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { start, end };
}

function validateEntry({ category, itemName, amount, transactionDate }) {
  if (!VALID_CATEGORIES.includes(category)) {
    return "Select a valid I&E category.";
  }

  if (!itemName || !String(itemName).trim()) {
    return "An item name is required.";
  }

  if (String(itemName).trim().length > 150) {
    return "The item name cannot exceed 150 characters.";
  }

  if (
    SYSTEM_ITEMS.includes(String(itemName).trim().toLowerCase())
  ) {
    return `"${itemName}" is calculated automatically and cannot be entered manually.`;
  }

  if (!validAmount(amount)) {
    return "Amount must be greater than zero.";
  }

  if (!validDate(transactionDate)) {
    return "Enter a valid transaction date in YYYY-MM-DD format.";
  }

  return null;
}

async function verifyBusiness(businessId) {
  const result = await pool.query(
    `SELECT id, "isActive"
     FROM "Business"
     WHERE id = $1`,
    [businessId]
  );

  if (!result.rows.length) {
    return { error: "Business not found.", status: 404 };
  }

  if (!result.rows[0].isActive) {
    return {
      error: "This business account is suspended.",
      status: 403,
    };
  }

  return { business: result.rows[0] };
}

// GET /api/ie?businessId=B60001&month=10&year=2026
router.get("/", async (req, res) => {
  const { businessId } = req.query;

  const now = new Date();
  const month = req.query.month ?? now.getMonth() + 1;
  const year = req.query.year ?? now.getFullYear();

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  const range = getMonthRange(month, year);

  if (!range) {
    return res.status(400).json({
      message: "Select a valid month and year.",
    });
  }

  try {
    const businessCheck = await verifyBusiness(businessId);

    if (businessCheck.error) {
      return res.status(businessCheck.status).json({
        message: businessCheck.error,
      });
    }

    const entriesResult = await pool.query(
      `SELECT
         id,
         "businessId",
         category,
         "itemName",
         amount,
         notes,
         "transactionDate",
         "createdAt",
         "updatedAt"
       FROM "IEEntry"
       WHERE "businessId" = $1
         AND "transactionDate" >= $2::date
         AND "transactionDate" < $3::date
       ORDER BY "transactionDate" DESC, id DESC`,
      [businessId, range.start, range.end]
    );

    const purchaseResult = await pool.query(
      `SELECT
         COALESCE(SUM("totalCost"), 0) AS total
       FROM "StockPurchase"
       WHERE "businessId" = $1
         AND "createdAt" >= $2::date
         AND "createdAt" < $3::date`,
      [businessId, range.start, range.end]
    );

    const totalsResult = await pool.query(
      `SELECT
         COALESCE(
           SUM(amount) FILTER (
             WHERE category = 'purchase_cost'
           ), 0
         ) AS "additionalPurchaseCosts",

         COALESCE(
           SUM(amount) FILTER (
             WHERE category = 'operating_expense'
           ), 0
         ) AS "operatingExpenses",

         COALESCE(
           SUM(amount) FILTER (
             WHERE category = 'income'
           ), 0
         ) AS "otherIncome"
       FROM "IEEntry"
       WHERE "businessId" = $1
         AND "transactionDate" >= $2::date
         AND "transactionDate" < $3::date`,
      [businessId, range.start, range.end]
    );

    const totals = totalsResult.rows[0];

    const stockPurchases = Number(purchaseResult.rows[0].total);
    const additionalPurchaseCosts = Number(
      totals.additionalPurchaseCosts
    );
    const operatingExpenses = Number(totals.operatingExpenses);
    const otherIncome = Number(totals.otherIncome);

    return res.json({
      month: Number(month),
      year: Number(year),
      entries: entriesResult.rows,
      summary: {
        stockPurchases,
        additionalPurchaseCosts,
        totalPurchaseCosts:
          stockPurchases + additionalPurchaseCosts,
        operatingExpenses,
        otherIncome,
        salesIncome: null,
        discountAllowed: null,
        netBeforeOtherAccountingItems: null,
        automaticSalesAndDiscountsPending: true,
      },
    });
  } catch (error) {
    console.error("Load I&E error:", error.message);

    return res.status(500).json({
      message: "Failed to load monthly I&E records.",
    });
  }
});

// POST /api/ie
router.post("/", async (req, res) => {
  const {
    businessId,
    category,
    itemName,
    amount,
    notes,
    transactionDate,
  } = req.body;

  if (!businessId) {
    return res.status(400).json({
      message: "Business ID is required.",
    });
  }

  const date = transactionDate || new Date().toISOString().slice(0, 10);

  const validationError = validateEntry({
    category,
    itemName,
    amount,
    transactionDate: date,
  });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const businessCheck = await verifyBusiness(businessId);

    if (businessCheck.error) {
      return res.status(businessCheck.status).json({
        message: businessCheck.error,
      });
    }

    const result = await pool.query(
      `INSERT INTO "IEEntry"
         ("businessId", category, "itemName", amount, notes,
          "transactionDate")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        category,
        String(itemName).trim(),
        Number(amount),
        notes ? String(notes).trim() : null,
        date,
      ]
    );

    return res.status(201).json({
      message: "I&E entry recorded successfully.",
      entry: result.rows[0],
    });
  } catch (error) {
    console.error("Create I&E entry error:", error.message);

    return res.status(500).json({
      message: "Failed to record I&E entry.",
    });
  }
});

// PUT /api/ie/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const {
    businessId,
    category,
    itemName,
    amount,
    notes,
    transactionDate,
  } = req.body;

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !businessId
  ) {
    return res.status(400).json({
      message: "A valid entry ID and business ID are required.",
    });
  }

  const validationError = validateEntry({
    category,
    itemName,
    amount,
    transactionDate,
  });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const businessCheck = await verifyBusiness(businessId);

    if (businessCheck.error) {
      return res.status(businessCheck.status).json({
        message: businessCheck.error,
      });
    }

    const result = await pool.query(
      `UPDATE "IEEntry"
       SET category = $1,
           "itemName" = $2,
           amount = $3,
           notes = $4,
           "transactionDate" = $5,
           "updatedAt" = NOW()
       WHERE id = $6 AND "businessId" = $7
       RETURNING *`,
      [
        category,
        String(itemName).trim(),
        Number(amount),
        notes ? String(notes).trim() : null,
        transactionDate,
        id,
        businessId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "I&E entry not found.",
      });
    }

    return res.json({
      message: "I&E entry updated successfully.",
      entry: result.rows[0],
    });
  } catch (error) {
    console.error("Update I&E entry error:", error.message);

    return res.status(500).json({
      message: "Failed to update I&E entry.",
    });
  }
});

// DELETE /api/ie/:id?businessId=B60001
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { businessId } = req.query;

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !businessId
  ) {
    return res.status(400).json({
      message: "A valid entry ID and business ID are required.",
    });
  }

  try {
    const businessCheck = await verifyBusiness(businessId);

    if (businessCheck.error) {
      return res.status(businessCheck.status).json({
        message: businessCheck.error,
      });
    }

    const result = await pool.query(
      `DELETE FROM "IEEntry"
       WHERE id = $1 AND "businessId" = $2
       RETURNING id`,
      [id, businessId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "I&E entry not found.",
      });
    }

    return res.json({
      message: "I&E entry deleted successfully.",
    });
  } catch (error) {
    console.error("Delete I&E entry error:", error.message);

    return res.status(500).json({
      message: "Failed to delete I&E entry.",
    });
  }
});

export default router;
