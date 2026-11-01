
import { useCallback, useEffect, useMemo, useState } from "react";
import "./IE.css";

const API_URL = "https://stoka-of78.onrender.com";

const CATEGORY_OPTIONS = {
  purchase_cost: [
    "Transport for stock",
    "Loading/offloading",
    "Other purchase costs",
  ],
  operating_expense: [
    "Rent",
    "Electricity and water",
    "Salaries and wages",
    "Internet and airtime",
    "Licences and fees",
    "Repairs and maintenance",
    "Stationery",
    "Other operating expenses",
  ],
  income: ["Delivery income", "Service income", "Other income"],
};

const CATEGORY_LABELS = {
  purchase_cost: "Cost on Purchases",
  operating_expense: "Operating Expenses",
  income: "Incomes",
};

const EMPTY_FORM = {
  category: "purchase_cost",
  itemName: "Transport for stock",
  amount: "",
  notes: "",
  transactionDate: new Date().toISOString().slice(0, 10),
};

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.00";

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function currentMonthYear() {
  const now = new Date();

  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

export default function IE({ business }) {
  const initialPeriod = useMemo(() => currentMonthYear(), []);

  const [month, setMonth] = useState(initialPeriod.month);
  const [year, setYear] = useState(initialPeriod.year);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const businessId = business?.id;
  const options = CATEGORY_OPTIONS[form.category] || [];

  const loadData = useCallback(async () => {
    if (!businessId) {
      setError(
        "Business information is missing. Please return to Home and open Manager again."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        businessId: String(businessId),
        month,
        year,
      });

      const response = await fetch(
        `${API_URL}/api/ie?${query.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load I&E records."
        );
      }

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setSummary(data.summary || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [businessId, month, year]);

  // Automatically load records when the selected month or year changes.
  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      transactionDate: `${year}-${month.padStart(2, "0")}-01`,
    });

    setEditingId(null);
  }

  function changeCategory(category) {
    setForm((current) => ({
      ...current,
      category,
      itemName: CATEGORY_OPTIONS[category]?.[0] || "",
    }));
  }

  function startEdit(entry) {
    setEditingId(entry.id);

    setForm({
      category: entry.category,
      itemName: entry.itemName || "",
      amount: String(entry.amount ?? ""),
      notes: entry.notes || "",
      transactionDate: String(
        entry.transactionDate || ""
      ).slice(0, 10),
    });

    setNotice("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!businessId) {
      setError("Business information is missing.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      businessId,
      category: form.category,
      itemName: form.itemName,
      amount: Number(form.amount),
      notes: form.notes.trim(),
      transactionDate: form.transactionDate,
    };

    try {
      const url = editingId
        ? `${API_URL}/api/ie/${editingId}`
        : `${API_URL}/api/ie`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not save this entry."
        );
      }

      setNotice(
        editingId
          ? "Entry updated successfully."
          : "Entry added successfully."
      );

      resetForm();

      // Reload the selected month's records automatically.
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry) {
    const confirmed = window.confirm(
      `Delete “${entry.itemName}” dated ${String(
        entry.transactionDate
      ).slice(0, 10)}?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const query = new URLSearchParams({
        businessId: String(businessId),
      });

      const response = await fetch(
        `${API_URL}/api/ie/${entry.id}?${query.toString()}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not delete this entry."
        );
      }

      setNotice("Entry deleted successfully.");

      if (editingId === entry.id) {
        resetForm();
      }

      // Reload the selected month's records automatically.
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const monthName = new Date(
    Number(year),
    Number(month) - 1,
    1
  ).toLocaleString(undefined, {
    month: "long",
  });

  const stockPurchases = Number(summary?.stockPurchases || 0);

  const additionalPurchaseCosts = Number(
    summary?.additionalPurchaseCosts || 0
  );

  const totalPurchaseCosts = Number(
    summary?.totalPurchaseCosts ??
      stockPurchases + additionalPurchaseCosts
  );

  const operatingExpenses = Number(
    summary?.operatingExpenses || 0
  );

  const otherIncome = Number(summary?.otherIncome || 0);

  return (
    <div className="ie-workspace">
      <style>{`
        /* Keep the three summary cards on one line, including phones. */
        .ie-workspace .ie-summary-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100%;
          min-width: 0;
        }

        .ie-workspace .ie-summary-card {
          min-width: 0 !important;
          padding: 12px 9px !important;
          box-sizing: border-box;
          overflow-wrap: anywhere;
        }

        .ie-workspace .ie-summary-card span {
          display: block;
          font-size: 12px;
          line-height: 1.3;
        }

        .ie-workspace .ie-summary-card strong {
          display: block;
          font-size: clamp(12px, 3.2vw, 19px);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .ie-workspace .ie-summary-card small {
          display: block;
          font-size: 10px;
          line-height: 1.3;
        }

        @media (max-width: 480px) {
          .ie-workspace .ie-summary-grid {
            gap: 5px !important;
          }

          .ie-workspace .ie-summary-card {
            padding: 10px 6px !important;
          }

          .ie-workspace .ie-summary-card span {
            font-size: 10px;
          }

          .ie-workspace .ie-summary-card strong {
            font-size: 12px;
          }

          .ie-workspace .ie-summary-card small {
            font-size: 9px;
          }
        }

        @media (max-width: 350px) {
          .ie-workspace .ie-summary-card span {
            font-size: 9px;
          }

          .ie-workspace .ie-summary-card strong {
            font-size: 11px;
          }

          .ie-workspace .ie-summary-card small {
            font-size: 8px;
          }
        }
      `}</style>

      <div className="ie-page-heading">
        <div className="ie-period-picker">
          <label>
            Month
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => ({
                value: String(index + 1),
                label: new Date(2026, index, 1).toLocaleString(
                  undefined,
                  { month: "long" }
                ),
              })).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {Array.from({ length: 11 }, (_, index) =>
                String(new Date().getFullYear() - 5 + index)
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p className="ie-alert ie-alert-error" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className="ie-alert ie-alert-success" role="status">
          {notice}
        </p>
      )}

      <div className="ie-summary-grid">
        <article className="ie-summary-card ie-purchases-card">
          <span>Cost on Purchases</span>
          <strong>{money(totalPurchaseCosts)}</strong>
          <small>Stock purchases + additional costs</small>
        </article>

        <article className="ie-summary-card ie-expenses-card">
          <span>Operating Expenses</span>
          <strong>{money(operatingExpenses)}</strong>
          <small>Monthly expense entries</small>
        </article>

        <article className="ie-summary-card ie-income-card">
          <span>Other Income</span>
          <strong>{money(otherIncome)}</strong>
          <small>Delivery, service and other income</small>
        </article>
      </div>

      <section className="ie-panel">
        <div className="ie-panel-heading">
          <div>
            <p className="ie-eyebrow">
              {editingId ? "UPDATE RECORD" : "NEW RECORD"}
            </p>

            <h3>
              {editingId
                ? "Edit I&E entry"
                : "Add an income or expense"}
            </h3>
          </div>

          {editingId && (
            <button
              type="button"
              className="ie-secondary-button"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          )}
        </div>

        <form className="ie-form" onSubmit={handleSubmit}>
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                changeCategory(event.target.value)
              }
            >
              {Object.entries(CATEGORY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Item
            <select
              value={form.itemName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  itemName: event.target.value,
                }))
              }
              required
            >
              {options.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}

              {form.itemName &&
                !options.includes(form.itemName) && (
                  <option value={form.itemName}>
                    {form.itemName}
                  </option>
                )}
            </select>
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              placeholder="Enter amount"
              required
            />
          </label>

          <label>
            Transaction date
            <input
              type="date"
              value={form.transactionDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  transactionDate: event.target.value,
                }))
              }
              required
            />
          </label>

          <label className="ie-notes-field">
            Notes (optional)
            <input
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Add a note or reference"
              maxLength={1000}
            />
          </label>

          <div className="ie-form-actions">
            <button
              className="ie-primary-button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Add entry"}
            </button>
          </div>
        </form>

        <p className="ie-form-footnote">
          Stock purchases, Sales Income and Discount Allowed are not
          manually entered here to avoid double counting.
        </p>
      </section>

      <section className="ie-panel">
        <div className="ie-panel-heading">
          <div>
            <p className="ie-eyebrow">MONTHLY REGISTER</p>
            <h3>
              {monthName} {year} records
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="ie-empty-state">
            Loading monthly records...
          </div>
        ) : entries.length === 0 ? (
          <div className="ie-empty-state">
            <span className="ie-empty-icon">▤</span>
            <strong>No manual entries for this month yet</strong>
            <p>
              Add an expense or income above. Stock purchases are
              included separately from Purchase History.
            </p>
          </div>
        ) : (
          <div className="ie-table-wrap">
            <table className="ie-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Notes</th>
                  <th className="ie-amount-column">Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {String(entry.transactionDate || "").slice(
                        0,
                        10
                      )}
                    </td>

                    <td>
                      <span
                        className={`ie-category-tag ${entry.category}`}
                      >
                        {CATEGORY_LABELS[entry.category] ||
                          entry.category}
                      </span>
                    </td>

                    <td className="ie-item-cell">
                      {entry.itemName}
                    </td>

                    <td className="ie-notes-cell">
                      {entry.notes || "—"}
                    </td>

                    <td className="ie-amount-column">
                      {money(entry.amount)}
                    </td>

                    <td>
                      <div className="ie-row-actions">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="ie-delete-button"
                          onClick={() => deleteEntry(entry)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
