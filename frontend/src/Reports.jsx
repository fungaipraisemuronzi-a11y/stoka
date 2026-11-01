
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "https://stoka-of78.onrender.com";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const number = (value) => Number(value || 0);

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

// Use the accounting date first for I&E entries.
const getDate = (item) =>
  new Date(
    item?.transactionDate ||
      item?.createdAt ||
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

/*
 * Combine repeated income or expense entries with the same item name.
 * This combines their amounts in the report display only.
 */
const combineEntries = (entries) => {
  const grouped = new Map();

  entries.forEach((item) => {
    const name = String(item.itemName || "Other").trim();
    const key = name.toLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        itemName: name,
        amount: 0,
      });
    }

    grouped.get(key).amount += number(item.amount);
  });

  return [...grouped.values()];
};

const styles = {
  page: {
    padding: "16px",
    maxWidth: 1200,
    margin: "0 auto",
    color: "#172033",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  buttons: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    margin: "12px 0 18px",
    width: "100%",
  },
  button: {
    border: "1px solid #dbe2ea",
    background: "#fff",
    color: "#243047",
    borderRadius: 8,
    padding: "11px 7px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  activeButton: {
    background: "#173f35",
    color: "#fff",
    borderColor: "#173f35",
  },
  panel: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    minWidth: 0,
  },
  field: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    background: "#fff",
    color: "#172033",
    boxSizing: "border-box",
    minWidth: 0,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 9,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: 11,
    background: "#f1f5f9",
    borderBottom: "1px solid #dbe2ea",
    whiteSpace: "nowrap",
    color: "#334155",
    fontWeight: 700,
  },
  td: {
    padding: 11,
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left",
    verticalAlign: "middle",
  },
  right: {
    textAlign: "right",
    whiteSpace: "nowrap",
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
    borderRadius: 9,
    padding: 13,
    minWidth: 0,
    flex: "1 1 145px",
    background: "#fff",
  },
};

function Table({
  columns,
  rows,
  emptyMessage = "No records found.",
}) {
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
                  textAlign: column.right ? "right" : "left",
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
                style={{
                  ...styles.td,
                  textAlign: "center",
                  padding: 25,
                  color: "#64748b",
                }}
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
                      textAlign: column.right ? "right" : "left",
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
      // Split the selected month into the values expected by /api/ie.
      const [selectedYear, selectedMonth] = month.split("-");

      const ieQuery = new URLSearchParams({
        businessId: String(businessId),
        month: selectedMonth,
        year: selectedYear,
      });

      const endpoints = [
        `/api/products?businessId=${encodeURIComponent(businessId)}`,
        `/api/sales?businessId=${encodeURIComponent(businessId)}`,
        `/api/returns?businessId=${encodeURIComponent(businessId)}`,
        `/api/stock/purchases?businessId=${encodeURIComponent(businessId)}`,
        `/api/withdrawals?businessId=${encodeURIComponent(businessId)}`,
        `/api/ie?${ieQuery.toString()}`,
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

      // The backend returns { entries, summary }.
      setIEEntries(getList(responses[5], "entries"));
    } catch (err) {
      setError(
        err.message ||
          "Could not load reports. Contact Stoka team if you need assistance."
      );
    } finally {
      setLoading(false);
    }
  }, [businessId, month]);

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

    // I&E entries have already been fetched for the selected month.
    // Filter again to ensure only matching transaction dates are used.
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

    // Additional costs entered manually in I&E.
    const purchaseCosts = monthIE
      .filter((item) => item.category === "purchase_cost")
      .reduce((sum, item) => sum + number(item.amount), 0);

    const incomes = monthIE.filter(
      (item) => item.category === "income"
    );

    const expenses = monthIE.filter(
      (item) => item.category === "operating_expense"
    );

    // Use the full recorded amounts. No proration.
    const otherIncome = incomes.reduce(
      (sum, item) => sum + number(item.amount),
      0
    );

    const operatingExpenses = expenses.reduce(
      (sum, item) => sum + number(item.amount),
      0
    );

    const openingStock = stockLedger.valueBefore(start);
    const closingStock = stockLedger.valueBefore(end);

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

  const combinedIncomes = useMemo(
    () => combineEntries(report.incomes),
    [report.incomes]
  );

  const combinedExpenses = useMemo(
    () => combineEntries(report.expenses),
    [report.expenses]
  );

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
    { name: "Stock purchases", amount: report.stockPurchases },
    {
      name: "Additional cost on purchases",
      amount: report.purchaseCosts,
    },
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

    ...combinedIncomes.map((item) => ({
      id: `income-${item.id}`,
      name: `Income: ${item.itemName}`,
      amount: item.amount,
    })),

    {
      name: "Total other income",
      amount: report.otherIncome,
      bold: true,
    },

    ...combinedExpenses.map((item) => ({
      id: `expense-${item.id}`,
      name: `Expense: ${item.itemName}`,
      amount: -item.amount,
    })),

    {
      name: "Total operating expenses",
      amount: -report.operatingExpenses,
      bold: true,
    },

    {
      name: "PROFIT / LOSS",
      amount: report.profit,
      bold: true,
    },
  ];

  const reportTabs = [
    ["profit", "Profit and Loss"],
    ["demand", "Goods on Demand"],
    ["stock", "Other Details"],
  ];

  return (
    <div style={styles.page}>
      <style>{`
        .stoka-report-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .stoka-report-tabs button {
          min-width: 0;
          white-space: nowrap;
        }

        .stoka-demand-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .stoka-demand-controls input {
          flex: 1 1 0;
          min-width: 0;
        }

        .stoka-demand-ranking {
          display: flex;
          gap: 6px;
          flex: 1 1 0;
          min-width: 0;
        }

        .stoka-demand-ranking button {
          flex: 1 1 0;
          min-width: 0;
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .stoka-report-tabs {
            gap: 5px;
          }

          .stoka-report-tabs button {
            padding: 10px 3px !important;
            font-size: 11px !important;
          }

          .stoka-demand-controls {
            gap: 5px;
          }

          .stoka-demand-controls input {
            width: 0;
            font-size: 11px !important;
            padding: 9px 4px !important;
          }

          .stoka-demand-ranking {
            gap: 4px;
          }

          .stoka-demand-ranking button {
            padding: 9px 3px !important;
            font-size: 10px !important;
          }

          .stoka-report-panel {
            padding: 12px !important;
          }

          .stoka-report-metrics {
            gap: 8px !important;
          }

          .stoka-report-metrics > div {
            flex: 1 1 calc(50% - 8px) !important;
          }
        }

        @media (max-width: 350px) {
          .stoka-report-tabs button {
            font-size: 10px !important;
          }

          .stoka-demand-ranking button {
            font-size: 9px !important;
          }
        }
      `}</style>

      <div className="stoka-report-tabs" style={styles.buttons}>
        {reportTabs.map(([value, label]) => (
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
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading && (
        <p style={styles.muted}>Loading report data...</p>
      )}

      {activeReport === "profit" && (
        <section className="stoka-report-panel" style={styles.panel}>
          <div style={styles.controls}>
            <label
              htmlFor="profit-month"
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              Select month
            </label>

            <input
              id="profit-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={styles.field}
            />
          </div>

          <p style={{ ...styles.muted, marginTop: 10 }}>
            Period: {dateLabel(monthStart(month))} to{" "}
            {dateLabel(
              new Date(nextMonthStart(month).getTime() - 86400000)
            )}
          </p>

          <div
            className="stoka-report-metrics"
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
              {
                key: "name",
                label: "Description",
              },
              {
                key: "amount",
                label: "Amount ($)",
                right: true,
                render: (row) => money(row.amount),
              },
            ]}
            rows={pnlRows}
          />

          
        </section>
      )}

      {activeReport === "demand" && (
        <section className="stoka-report-panel" style={styles.panel}>
          <div className="stoka-demand-controls">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              style={styles.field}
              aria-label="Select month"
            />

            <div className="stoka-demand-ranking">
              <button
                type="button"
                onClick={() => setRanking("most")}
                style={{
                  ...styles.button,
                  ...(ranking === "most" ? styles.activeButton : {}),
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
          </div>

          <p style={{ ...styles.muted, marginTop: 14 }}>
            Based on completed sales for the selected month. Every current
            product is included, including products with zero sales.
            "Times sold" counts how often a product appears as a line in
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
        <section className="stoka-report-panel" style={styles.panel}>
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

          <p style={{ ...styles.muted, marginTop: 14 }}>
            Stock value is an estimate based on recorded purchase costs,
            not selling prices.
          </p>
        </section>
      )}
    </div>
  );
}
