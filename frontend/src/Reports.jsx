
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const number = (value) => Number(value || 0);

// Quantities: no thousands separators and no unnecessary decimal zeros.
const quantity = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 2,
  });

const getList = (data, ...keys) => {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
};

const getDate = (item) =>
  new Date(
    item?.createdAt ||
      item?.transactionDate ||
      item?.date ||
      item?.created_at ||
      0
  );

const getId = (item) =>
  String(item?.productId ?? item?.product?.id ?? "");

const getQuantity = (item) => number(item?.quantity);

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthStart = (value) => new Date(`${value}-01T00:00:00`);

const nextMonthStart = (value) => {
  const date = monthStart(value);
  date.setMonth(date.getMonth() + 1);
  return date;
};

const dateLabel = (date) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const styles = {
  page: {
    padding: 20,
    maxWidth: 1200,
    margin: "0 auto",
    color: "#172033",
  },
  heading: {
    fontSize: 25,
    margin: "0 0 8px",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  buttons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    margin: "22px 0",
  },
  button: {
    border: "1px solid #dbe2ea",
    background: "#fff",
    color: "#243047",
    borderRadius: 8,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },
  activeButton: {
    background: "#173f35",
    color: "#fff",
    borderColor: "#173f35",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 18,
    marginTop: 14,
  },
  field: {
    padding: 9,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    fontSize: 14,
  },
  tableWrap: {
    overflowX: "auto",
    marginTop: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: 11,
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe2ea",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 11,
    borderBottom: "1px solid #e2e8f0",
  },
  right: {
    textAlign: "right",
  },
  total: {
    fontWeight: 700,
    background: "#f8fafc",
  },
  error: {
    color: "#b91c1c",
    background: "#fef2f2",
    padding: 12,
    borderRadius: 7,
    marginTop: 12,
  },
  metric: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 14,
    minWidth: 145,
    flex: "1 1 145px",
  },
};

function Table({ columns, rows, emptyMessage = "No records found." }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  ...styles.th,
                  ...(column.right ? styles.right : {}),
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...styles.td, textAlign: "center" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id ?? `${row.name ?? "row"}-${index}`}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      ...styles.td,
                      ...(column.right ? styles.right : {}),
                      ...(row.bold ? styles.total : {}),
                    }}
                  >
                    {column.render
                      ? column.render(row)
                      : row[column.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports({
  business,
  businessId: suppliedBusinessId,
}) {
  const businessId = suppliedBusinessId || business?.id;

  const [activeReport, setActiveReport] = useState("profit");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [ranking, setRanking] = useState("most");

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [ieEntries, setIEEntries] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!businessId) {
      setError("Business information is missing.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoints = [
        `/api/products?businessId=${encodeURIComponent(businessId)}`,
        `/api/sales?businessId=${encodeURIComponent(businessId)}`,
        `/api/returns?businessId=${encodeURIComponent(businessId)}`,
        `/api/stock/purchases?businessId=${encodeURIComponent(businessId)}`,
        `/api/withdrawals?businessId=${encodeURIComponent(businessId)}`,
        `/api/ie?businessId=${encodeURIComponent(businessId)}`,
      ];

      const responses = await Promise.all(
        endpoints.map(async (endpoint) => {
          const response = await fetch(`${API_URL}${endpoint}`);
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data?.message ||
                `Could not load ${endpoint.split("?")[0]}`
            );
          }

          return data;
        })
      );

      setProducts(getList(responses[0], "products"));
      setSales(getList(responses[1], "sales"));
      setReturns(getList(responses[2], "returns"));
      setPurchases(getList(responses[3], "purchases"));
      setWithdrawals(getList(responses[4], "withdrawals"));
      setIEEntries(getList(responses[5], "entries"));
    } catch (err) {
      setError(
        err.message ||
          "Could not load reports. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  /*
   * Reconstruct stock values from recorded stock movements.
   * Initial opening stock is assumed to be zero.
   */
  const stockLedger = useMemo(() => {
    const productMap = new Map(
      products.map((product) => [String(product.id), product])
    );

    const events = [];

    purchases.forEach((purchase) => {
      const productId = getId(purchase);
      const product = productMap.get(productId);

      const unitsPerPack = number(
        product?.unitsPerPack ?? purchase?.unitsPerPack
      );

      const packs = number(purchase.packsAdded);
      const loose = number(purchase.unitsAdded);
      const units = packs * unitsPerPack + loose;
      const cost = number(purchase.totalCost);

      if (productId && units > 0) {
        events.push({
          date: getDate(purchase),
          type: "purchase",
          productId,
          units,
          cost,
        });
      }
    });

    sales.forEach((sale) => {
      getList(sale, "items", "saleItems").forEach((item) => {
        const productId = getId(item);
        const units = getQuantity(item);

        if (productId && units > 0) {
          events.push({
            date: getDate(sale),
            type: "sale",
            productId,
            units,
          });
        }
      });
    });

    returns.forEach((saleReturn) => {
      getList(saleReturn, "items", "returnItems").forEach((item) => {
        const productId = getId(item);
        const units = getQuantity(item);

        if (productId && units > 0) {
          events.push({
            date: getDate(saleReturn),
            type: "return",
            productId,
            units,
          });
        }
      });
    });

    withdrawals.forEach((withdrawal) => {
      const productId = getId(withdrawal);
      const product = productMap.get(productId);

      const units = number(
        withdrawal.totalUnits ??
          number(withdrawal.packsWithdrawn) *
            number(product?.unitsPerPack) +
            number(withdrawal.unitsWithdrawn)
      );

      if (productId && units > 0) {
        events.push({
          date: getDate(withdrawal),
          type: "withdrawal",
          productId,
          units,
        });
      }
    });

    events.sort((a, b) => a.date - b.date);

    const balances = new Map();

    const getBalance = (productId) => {
      if (!balances.has(productId)) {
        balances.set(productId, { units: 0, value: 0 });
      }

      return balances.get(productId);
    };

    const applyEvent = (event) => {
      const balance = getBalance(event.productId);

      if (event.type === "purchase") {
        balance.units += event.units;
        balance.value += event.cost;
        return;
      }

      if (event.type === "sale" || event.type === "withdrawal") {
        if (balance.units <= 0) return;

        const averageCost = balance.value / balance.units;
        const unitsRemoved = Math.min(event.units, balance.units);

        balance.units -= unitsRemoved;
        balance.value -= averageCost * unitsRemoved;

        if (balance.units <= 0.000001) {
          balance.units = 0;
          balance.value = 0;
        }

        return;
      }

      if (event.type === "return") {
        const averageCost =
          balance.units > 0 ? balance.value / balance.units : 0;

        balance.units += event.units;
        balance.value += averageCost * event.units;
      }
    };

    const snapshots = [];

    events.forEach((event) => {
      applyEvent(event);

      snapshots.push({
        date: event.date,
        totalValue: [...balances.values()].reduce(
          (sum, balance) => sum + balance.value,
          0
        ),
      });
    });

    const valueBefore = (date) => {
      let value = 0;

      for (const snapshot of snapshots) {
        if (snapshot.date < date) {
          value = snapshot.totalValue;
        } else {
          break;
        }
      }

      return value;
    };

    const currentValues = new Map();

    balances.forEach((balance, productId) => {
      currentValues.set(productId, {
        units: balance.units,
        value: balance.value,
      });
    });

    return {
      events,
      valueBefore,
      currentValues,
    };
  }, [products, purchases, sales, returns, withdrawals]);

  const report = useMemo(() => {
    const start = monthStart(month);
    const end = nextMonthStart(month);

    const inSelectedMonth = (item) => {
      const date = getDate(item);
      return date >= start && date < end;
    };

    const monthSales = sales.filter(inSelectedMonth);
    const monthReturns = returns.filter(inSelectedMonth);
    const monthPurchases = purchases.filter(inSelectedMonth);
    const monthWithdrawals = withdrawals.filter(inSelectedMonth);
    const monthIE = ieEntries.filter(inSelectedMonth);

    const totalSales = monthSales.reduce(
      (sum, sale) => sum + number(sale.totalAmount),
      0
    );

    const salesReturns = monthReturns.reduce(
      (sum, item) => sum + number(item.totalRefund),
      0
    );

    const turnover = totalSales - salesReturns;

    const stockPurchases = monthPurchases.reduce(
      (sum, item) => sum + number(item.totalCost),
      0
    );

    const purchaseCosts = monthIE
      .filter((item) => item.category === "purchase_cost")
      .reduce((sum, item) => sum + number(item.amount), 0);

    const incomes = monthIE.filter(
      (item) => item.category === "income"
    );

    const expenses = monthIE.filter(
      (item) => item.category === "operating_expense"
    );

    /*
     * Apply the same proration rule to both income and expenses.
     * Current month: day of month / 30 * recorded amount.
     * Past months: use the full recorded amount.
     */
    const now = new Date();

    const isCurrentMonth =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth();

    const daysToProrate = isCurrentMonth ? now.getDate() : 30;
    const prorationFactor = daysToProrate / 30;

    const otherIncome = incomes.reduce(
      (sum, item) =>
        sum +
        number(item.amount) *
          (isCurrentMonth ? prorationFactor : 1),
      0
    );

    const operatingExpenses = expenses.reduce(
      (sum, item) =>
        sum +
        number(item.amount) *
          (isCurrentMonth ? prorationFactor : 1),
      0
    );

    const openingStock = stockLedger.valueBefore(start);
    const closingStock = stockLedger.valueBefore(end);

    /*
     * Estimate withdrawal value using moving-average purchase cost.
     */
    const withdrawnValue = stockLedger.events
      .filter(
        (event) =>
          event.type === "withdrawal" &&
          event.date >= start &&
          event.date < end
      )
      .reduce((sum, event) => {
        const productEvents = stockLedger.events.filter(
          (item) =>
            item.productId === event.productId &&
            item.date <= event.date
        );

        let units = 0;
        let value = 0;
        let unitCostAtWithdrawal = 0;

        for (const item of productEvents) {
          if (item.type === "purchase") {
            units += item.units;
            value += item.cost;
          } else if (
            item.type === "sale" ||
            item.type === "withdrawal"
          ) {
            const average = units > 0 ? value / units : 0;
            const removed = Math.min(item.units, units);

            units -= removed;
            value -= average * removed;

            if (units <= 0.000001) {
              units = 0;
              value = 0;
            }
          } else if (item.type === "return") {
            const average = units > 0 ? value / units : 0;

            units += item.units;
            value += average * item.units;
          }

          if (item === event) {
            unitCostAtWithdrawal =
              units > 0 ? value / units : 0;
            break;
          }
        }

        return sum + unitCostAtWithdrawal * event.units;
      }, 0);

    const costOfGoodsSold =
      openingStock +
      stockPurchases +
      purchaseCosts -
      withdrawnValue -
      closingStock;

    const grossProfit = turnover - costOfGoodsSold;
    const profit = grossProfit + otherIncome - operatingExpenses;

    const profitPercentage = turnover
      ? (profit / turnover) * 100
      : 0;

    return {
      totalSales,
      salesReturns,
      turnover,
      openingStock,
      stockPurchases,
      purchaseCosts,
      withdrawnValue,
      closingStock,
      costOfGoodsSold,
      grossProfit,
      incomes,
      expenses,
      otherIncome,
      operatingExpenses,
      prorationFactor,
      isCurrentMonth,
      profit,
      profitPercentage,
      monthSales,
      monthReturns,
      monthPurchases,
      monthWithdrawals,
    };
  }, [
    month,
    sales,
    returns,
    purchases,
    withdrawals,
    ieEntries,
    stockLedger,
  ]);

  /*
   * Every current product is included, even if it had zero sales.
   */
  const goodsOnDemand = useMemo(() => {
    const start = monthStart(month);
    const end = nextMonthStart(month);
    const totals = new Map();

    products.forEach((product) => {
      const id = String(product.id);

      totals.set(id, {
        id,
        name: product.stockName || product.name || "Unknown product",
        timesSold: 0,
        unitsSold: 0,
      });
    });

    sales
      .filter((sale) => {
        const date = getDate(sale);
        return date >= start && date < end;
      })
      .forEach((sale) => {
        getList(sale, "items", "saleItems").forEach((item) => {
          const id = getId(item);
          if (!id) return;

          const existing = totals.get(id) || {
            id,
            name:
              item.stockName ||
              item.productName ||
              "Unknown product",
            timesSold: 0,
            unitsSold: 0,
          };

          existing.timesSold += 1;
          existing.unitsSold += getQuantity(item);

          totals.set(id, existing);
        });
      });

    return [...totals.values()].sort((a, b) => {
      if (ranking === "most") {
        return (
          b.timesSold - a.timesSold ||
          b.unitsSold - a.unitsSold ||
          a.name.localeCompare(b.name)
        );
      }

      return (
        a.timesSold - b.timesSold ||
        a.unitsSold - b.unitsSold ||
        a.name.localeCompare(b.name)
      );
    });
  }, [sales, products, month, ranking]);

  const remainingStock = useMemo(() => {
    return products.map((product) => {
      const id = String(product.id);
      const packs = number(product.stockPacks);
      const loose = number(product.stockUnits);
      const unitsPerPack = number(product.unitsPerPack);
      const totalUnits = packs * unitsPerPack + loose;
      const ledger = stockLedger.currentValues.get(id);

      return {
        id,
        name: product.stockName || product.name || "Unnamed product",
        packName: product.packName || "packs",
        unitName: product.unitName || "units",
        packs,
        loose,
        totalUnits,
        stockValue: ledger?.value ?? 0,
      };
    });
  }, [products, stockLedger]);

  const pnlRows = [
    { name: "Sales", amount: report.totalSales },
    { name: "Sales returns", amount: -report.salesReturns },
    { name: "Turnover", amount: report.turnover, bold: true },
    { name: "Opening stock", amount: report.openingStock },
    { name: "Purchases", amount: report.stockPurchases },
    { name: "Cost on purchases", amount: report.purchaseCosts },
    {
      name: "Withdrawals (at cost)",
      amount: -report.withdrawnValue,
    },
    { name: "Closing stock", amount: -report.closingStock },
    {
      name: "Cost of goods sold",
      amount: report.costOfGoodsSold,
      bold: true,
    },
    { name: "Gross profit", amount: report.grossProfit, bold: true },

    ...report.incomes.map((item) => ({
      id: `income-${item.id}`,
      name: `Income: ${item.itemName}`,
      amount:
        number(item.amount) *
        (report.isCurrentMonth ? report.prorationFactor : 1),
    })),

    {
      name: "Total other income (prorated)",
      amount: report.otherIncome,
      bold: true,
    },

    ...report.expenses.map((item) => ({
      id: `expense-${item.id}`,
      name: `Expense: ${item.itemName}`,
      amount:
        -number(item.amount) *
        (report.isCurrentMonth ? report.prorationFactor : 1),
    })),

    {
      name: "Total operating expenses (prorated)",
      amount: -report.operatingExpenses,
      bold: true,
    },

    {
      name: "PROFIT / LOSS",
      amount: report.profit,
      bold: true,
    },
  ];

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Reports</h2>

      <p style={styles.muted}>
        View business performance, product demand and remaining stock.
      </p>

      <div style={styles.buttons}>
        {[
          ["profit", "Profit and Loss"],
          ["demand", "Goods on Demand"],
          ["stock", "Other Details"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveReport(value)}
            style={{
              ...styles.button,
              ...(activeReport === value ? styles.activeButton : {}),
            }}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={loadReports}
          style={{ ...styles.button, marginLeft: "auto" }}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading && (
        <p style={styles.muted}>Loading report data...</p>
      )}

      {activeReport === "profit" && (
        <section style={styles.panel}>
          <h3 style={{ marginTop: 0 }}>Profit and Loss</h3>

          <label style={{ display: "block", marginBottom: 8 }}>
            Select month
          </label>

          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            style={styles.field}
          />

          <p style={styles.muted}>
            Period: {dateLabel(monthStart(month))} to{" "}
            {dateLabel(
              new Date(nextMonthStart(month).getTime() - 86400000)
            )}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              margin: "18px 0",
            }}
          >
            <div style={styles.metric}>
              <div style={styles.muted}>Turnover</div>
              <strong>${money(report.turnover)}</strong>
            </div>

            <div style={styles.metric}>
              <div style={styles.muted}>Gross profit</div>
              <strong>${money(report.grossProfit)}</strong>
            </div>

            <div style={styles.metric}>
              <div style={styles.muted}>Profit / Loss</div>
              <strong>${money(report.profit)}</strong>
            </div>

            <div style={styles.metric}>
              <div style={styles.muted}>Profit percentage</div>
              <strong>
                {number(report.profitPercentage).toFixed(2)}%
              </strong>
            </div>
          </div>

          <Table
            columns={[
              { key: "name", label: "Description" },
              {
                key: "amount",
                label: "Amount ($)",
                right: true,
                render: (row) => money(row.amount),
              },
            ]}
            rows={pnlRows}
          />

          <p style={{ ...styles.muted, marginTop: 16 }}>
            For the current month, both other income and operating expenses
            are prorated using the day of the month divided by 30. Past
            months use the full recorded amounts. This assumes both income
            and expense entries represent monthly amounts.
          </p>

          <p style={styles.muted}>
            Stock values are reconstructed from recorded movements using
            average purchase cost, starting from zero opening stock.
            Missing or unrecorded movements can make these estimates
            incomplete.
          </p>
        </section>
      )}

      {activeReport === "demand" && (
        <section style={styles.panel}>
          <h3 style={{ marginTop: 0 }}>Goods on Demand</h3>

          <label style={{ display: "block", marginBottom: 8 }}>
            Select month
          </label>

          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            style={styles.field}
          />

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setRanking("most")}
              style={{
                ...styles.button,
                ...(ranking === "most" ? styles.activeButton : {}),
                marginRight: 8,
              }}
            >
              Most demanded
            </button>

            <button
              type="button"
              onClick={() => setRanking("least")}
              style={{
                ...styles.button,
                ...(ranking === "least" ? styles.activeButton : {}),
              }}
            >
              Least demanded
            </button>
          </div>

          <p style={styles.muted}>
            Based on completed sales for the selected month. Every current
            product is included, including products with zero sales.
            “Times sold” counts how often a product appears as a line in
            a completed sale.
          </p>

          <Table
            columns={[
              { key: "name", label: "Product" },
              {
                key: "timesSold",
                label: "Times sold",
                right: true,
              },
              {
                key: "unitsSold",
                label: "Units sold",
                right: true,
                render: (row) => quantity(row.unitsSold),
              },
            ]}
            rows={goodsOnDemand}
          />
        </section>
      )}

      {activeReport === "stock" && (
        <section style={styles.panel}>
          <h3 style={{ marginTop: 0 }}>
            Other Details — Remaining Stock
          </h3>

          <p style={styles.muted}>
            Current quantities and estimated stock value using recorded
            purchase costs.
          </p>

          <Table
            columns={[
              { key: "name", label: "Product" },
              {
                key: "packs",
                label: "Packs remaining",
                right: true,
                render: (row) =>
                  `${quantity(row.packs)} ${row.packName}`,
              },
              {
                key: "loose",
                label: "Loose units",
                right: true,
                render: (row) =>
                  `${quantity(row.loose)} ${row.unitName}`,
              },
              {
                key: "totalUnits",
                label: "Total individual units",
                right: true,
                render: (row) => quantity(row.totalUnits),
              },
              {
                key: "stockValue",
                label: "Estimated value ($)",
                right: true,
                render: (row) => money(row.stockValue),
              },
            ]}
            rows={remainingStock}
          />

          <p style={{ ...styles.muted, marginTop: 16 }}>
            Stock value is an estimate based on recorded purchase costs,
            not selling prices.
          </p>
        </section>
      )}
    </div>
  );
}
