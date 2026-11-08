
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "https://stoka-of78.onrender.com";

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    minWidth: 0,
    color: "#1f2937",
  },
  muted: {
    color: "#6b7280",
    fontSize: "13px",
    marginTop: "2px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    alignItems: "end",
    padding: "15px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "13px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#4b5563",
  },
  input: {
    width: "100%",
    minWidth: 0,
    height: "42px",
    boxSizing: "border-box",
    padding: "9px 10px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    fontSize: "13px",
    outlineColor: "#16794b",
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    width: "100%",
  },
  tab: {
    minWidth: 0,
    padding: "11px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    background: "#fff",
    color: "#4b5563",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#fff",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
    fontSize: "13px",
  },
  th: {
    background: "#f3f6f4",
    padding: "12px",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontWeight: 750,
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #f0f1f3",
    verticalAlign: "top",
  },
  error: {
    padding: "12px 14px",
    border: "1px solid #fecaca",
    borderRadius: "9px",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: "13px",
  },
  empty: {
    padding: "35px 15px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "13px",
  },
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getDateValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
};

const quantity = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });

// FETCH DATA WITH MANAGER AUTHORIZATION
async function fetchJson(url, managerToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${managerToken}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Failed to load history.");
  }

  return data;
}

export default function TellerHistory({ businessId, managerToken }) {
  const [activeHistory, setActiveHistory] = useState("Sales");

  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tellers, setTellers] = useState([]);

  const [selectedTeller, setSelectedTeller] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!businessId) {
      setError("Business ID is missing. Please reopen the Manager dashboard.");
      return;
    }

    if (!managerToken) {
      setError("Manager login is required. Please log in again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const encodedBusinessId = encodeURIComponent(businessId);

      const [salesData, returnsData, withdrawalsData, tellersData] =
        await Promise.all([
          fetchJson(
            `${API_URL}/api/sales?businessId=${encodedBusinessId}`,
            managerToken
          ),

          fetchJson(
            `${API_URL}/api/returns?businessId=${encodedBusinessId}`,
            managerToken
          ),

          fetchJson(
            `${API_URL}/api/withdrawals?businessId=${encodedBusinessId}`,
            managerToken
          ),

          fetchJson(
            `${API_URL}/api/tellers/business/${encodedBusinessId}`,
            managerToken
          ),
        ]);

      setSales(
        Array.isArray(salesData.sales) ? salesData.sales : []
      );

      setReturns(
        Array.isArray(returnsData.returns) ? returnsData.returns : []
      );

      setWithdrawals(
        Array.isArray(withdrawalsData.withdrawals)
          ? withdrawalsData.withdrawals
          : []
      );

      const tellerList = Array.isArray(tellersData)
        ? tellersData
        : Array.isArray(tellersData.tellers)
          ? tellersData.tellers
          : [];

      setTellers(tellerList);
    } catch (err) {
      setError(err.message || "Failed to load teller history.");
    } finally {
      setLoading(false);
    }
  }, [businessId, managerToken]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (
          selectedTeller !== "all" &&
          String(sale.tellerId) !== selectedTeller
        ) {
          return false;
        }

        const date = getDateValue(sale.createdAt);

        if (dateFrom && (!date || date < dateFrom)) return false;
        if (dateTo && (!date || date > dateTo)) return false;

        return true;
      }),
    [sales, selectedTeller, dateFrom, dateTo]
  );

  const filteredReturns = useMemo(
    () =>
      returns.filter((record) => {
        if (
          selectedTeller !== "all" &&
          String(record.tellerId) !== selectedTeller
        ) {
          return false;
        }

        const date = getDateValue(record.createdAt);

        if (dateFrom && (!date || date < dateFrom)) return false;
        if (dateTo && (!date || date > dateTo)) return false;

        return true;
      }),
    [returns, selectedTeller, dateFrom, dateTo]
  );

  const filteredWithdrawals = useMemo(
    () =>
      withdrawals.filter((record) => {
        if (
          selectedTeller !== "all" &&
          String(record.tellerId) !== selectedTeller
        ) {
          return false;
        }

        const date = getDateValue(record.createdAt);

        if (dateFrom && (!date || date < dateFrom)) return false;
        if (dateTo && (!date || date > dateTo)) return false;

        return true;
      }),
    [withdrawals, selectedTeller, dateFrom, dateTo]
  );

  const currentRecords =
    activeHistory === "Sales"
      ? filteredSales
      : activeHistory === "Returns"
        ? filteredReturns
        : filteredWithdrawals;

  const salesTotal = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount || 0),
    0
  );

  const refundsTotal = filteredReturns.reduce(
    (sum, record) => sum + Number(record.totalRefund || 0),
    0
  );

  const tabStyle = (tab) => ({
    ...styles.tab,
    background: activeHistory === tab ? "#16794b" : "#fff",
    color: activeHistory === tab ? "#fff" : "#4b5563",
    borderColor: activeHistory === tab ? "#16794b" : "#e5e7eb",
    boxShadow:
      activeHistory === tab
        ? "0 2px 6px rgba(22, 121, 75, 0.18)"
        : "none",
  });

  return (
    <div style={styles.page}>
      <style>
        {`
          @media (max-width: 600px) {
            .teller-history-filters {
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
              gap: 10px !important;
              padding: 12px !important;
            }

            .teller-history-teller {
              grid-column: 1 / -1;
            }

            .teller-history-tabs button {
              padding: 11px 3px !important;
              font-size: 12px !important;
            }
          }

          @media (max-width: 350px) {
            .teller-history-tabs button {
              font-size: 11px !important;
              padding: 10px 2px !important;
            }
          }
        `}
      </style>

      {error && <div style={styles.error}>{error}</div>}

      <div
        className="teller-history-filters"
        style={styles.filters}
      >
        <div
          className="teller-history-teller"
          style={styles.field}
        >
          <label style={styles.label}>Teller</label>

          <select
            style={styles.input}
            value={selectedTeller}
            onChange={(event) => setSelectedTeller(event.target.value)}
          >
            <option value="all">All tellers</option>

            {tellers.map((teller) => (
              <option key={teller.id} value={String(teller.id)}>
                {teller.name}
                {teller.isActive === false ? " (Suspended)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>From date</label>

          <input
            style={styles.input}
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>To date</label>

          <input
            style={styles.input}
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      <div
        className="teller-history-tabs"
        style={styles.tabs}
      >
        {["Sales", "Returns", "Withdrawals"].map((tab) => (
          <button
            type="button"
            key={tab}
            style={tabStyle(tab)}
            onClick={() => setActiveHistory(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeHistory === "Sales" && (
        <div style={styles.muted}>
          Sales value for the selected filters:{" "}
          <strong>{money(salesTotal)}</strong>
        </div>
      )}

      {activeHistory === "Returns" && (
        <div style={styles.muted}>
          Refund value for the selected filters:{" "}
          <strong>{money(refundsTotal)}</strong>
        </div>
      )}

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.empty}>Loading history...</div>
        ) : currentRecords.length === 0 ? (
          <div style={styles.empty}>
            No {activeHistory.toLowerCase()} records match the selected filters.
          </div>
        ) : (
          <table style={styles.table}>
            {activeHistory === "Sales" && (
              <>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Receipt</th>
                    <th style={styles.th}>Teller</th>
                    <th style={styles.th}>Items</th>
                    <th style={styles.th}>Subtotal</th>
                    <th style={styles.th}>Discount</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Payment</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={styles.td}>{formatDate(sale.createdAt)}</td>

                      <td style={styles.td}>
                        {sale.receiptNumber || `Sale #${sale.id}`}
                      </td>

                      <td style={styles.td}>
                        {sale.tellerName || "Unknown teller"}
                      </td>

                      <td style={styles.td}>
                        {Array.isArray(sale.items)
                          ? sale.items
                              .map(
                                (item) =>
                                  `${item.stockName || item.productName || "Item"} × ${quantity(item.quantity)}`
                              )
                              .join(", ")
                          : "—"}
                      </td>

                      <td style={styles.td}>{money(sale.subtotal)}</td>
                      <td style={styles.td}>{money(sale.discountTotal)}</td>

                      <td style={styles.td}>
                        <strong>{money(sale.totalAmount)}</strong>
                      </td>

                      <td style={styles.td}>
                        {sale.paymentMethod || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeHistory === "Returns" && (
              <>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Return No.</th>
                    <th style={styles.th}>Original Receipt</th>
                    <th style={styles.th}>Teller</th>
                    <th style={styles.th}>Items</th>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Refund</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReturns.map((record) => (
                    <tr key={record.id}>
                      <td style={styles.td}>{formatDate(record.createdAt)}</td>

                      <td style={styles.td}>
                        {record.returnNumber || `Return #${record.id}`}
                      </td>

                      <td style={styles.td}>
                        {record.receiptNumber ||
                          record.originalReceiptNumber ||
                          "—"}
                      </td>

                      <td style={styles.td}>
                        {record.tellerName || "Unknown teller"}
                      </td>

                      <td style={styles.td}>
                        {Array.isArray(record.items)
                          ? record.items
                              .map(
                                (item) =>
                                  `${item.stockName || item.productName || "Item"} × ${quantity(item.quantity)}`
                              )
                              .join(", ")
                          : "—"}
                      </td>

                      <td style={styles.td}>{record.reason || "—"}</td>

                      <td style={styles.td}>
                        <strong>{money(record.totalRefund)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeHistory === "Withdrawals" && (
              <>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Teller</th>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Packs</th>
                    <th style={styles.th}>Loose units</th>
                    <th style={styles.th}>Total units</th>
                    <th style={styles.th}>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWithdrawals.map((record) => (
                    <tr key={record.id}>
                      <td style={styles.td}>{formatDate(record.createdAt)}</td>

                      <td style={styles.td}>
                        {record.tellerName || "Unknown teller"}
                      </td>

                      <td style={styles.td}>
                        {record.productName || "—"}
                      </td>

                      <td style={styles.td}>
                        {quantity(record.packsWithdrawn)}
                      </td>

                      <td style={styles.td}>
                        {quantity(record.unitsWithdrawn)}
                      </td>

                      <td style={styles.td}>
                        <strong>{quantity(record.totalUnits)}</strong>
                      </td>

                      <td style={styles.td}>{record.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
