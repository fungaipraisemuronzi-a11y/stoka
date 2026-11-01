import { useCallback, useEffect, useState } from "react";

const API_URL = "https://stoka-of78.onrender.com";

const emptyForm = {
  productId: "",
  productSearch: "",
  packsAdded: "",
  unitsAdded: "",
  purchasePricePerPack: "",
};

export default function AddStock({ business }) {
  const businessId = business?.id || business?.businessId || "";

  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedProduct = products.find(
    (product) => String(product.id) === String(form.productId)
  );

  const packs = Number(form.packsAdded) || 0;
  const units = Number(form.unitsAdded) || 0;
  const price = Number(form.purchasePricePerPack) || 0;
  const unitsPerPack = Number(selectedProduct?.unitsPerPack) || 1;

  const estimatedCost =
    packs * price + units * (price / unitsPerPack);

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "The request failed.");
    }

    return data;
  };

  const loadData = useCallback(async () => {
    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [productData, purchaseData] = await Promise.all([
        request(
          `${API_URL}/api/products?businessId=${encodeURIComponent(
            businessId
          )}`
        ),
        request(
          `${API_URL}/api/stock/purchases?businessId=${encodeURIComponent(
            businessId
          )}`
        ),
      ]);

      setProducts(
        Array.isArray(productData)
          ? productData
          : productData.products || []
      );

      setPurchases(
        Array.isArray(purchaseData)
          ? purchaseData
          : purchaseData.purchases || []
      );
    } catch (err) {
      setError(err.message || "Failed to load stock and purchase history.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleProductSearch(value) {
    const match = products.find(
      (product) =>
        product.stockName?.toLowerCase() === value.trim().toLowerCase()
    );

    setForm((current) => ({
      ...current,
      productSearch: value,
      productId: match ? String(match.id) : "",
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
  }

  function startEditing(purchase) {
    setEditingId(purchase.id);
    setError("");
    setMessage("");

    setForm({
      productId: String(purchase.productId),
      productSearch: purchase.productName || "",
      packsAdded: String(purchase.packsAdded),
      unitsAdded: String(purchase.unitsAdded),
      purchasePricePerPack: String(purchase.purchasePricePerPack),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!form.productId || !selectedProduct) {
      setError("Select a valid product from the product list.");
      return;
    }

    if (
      !Number.isFinite(packs) ||
      !Number.isFinite(units) ||
      !Number.isFinite(price) ||
      packs < 0 ||
      units < 0 ||
      price < 0
    ) {
      setError("Quantities and purchase price must be valid non-negative numbers.");
      return;
    }

    if (packs === 0 && units === 0) {
      setError("Enter at least one pack or one loose unit.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        businessId,
        productId: Number(form.productId),
        packsAdded: packs,
        unitsAdded: units,
        purchasePricePerPack: price,
      };

      const url = editingId
        ? `${API_URL}/api/stock/purchases/${editingId}`
        : `${API_URL}/api/stock/purchases`;

      await request(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setMessage(
        editingId
          ? "Purchase updated successfully."
          : "Purchase recorded successfully."
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save the purchase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(purchase) {
    const confirmed = window.confirm(
      `Delete this purchase of "${purchase.productName}"?\n\nThe stock added by this purchase will be reversed.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingId(purchase.id);

    try {
      const result = await request(
        `${API_URL}/api/stock/purchases/${purchase.id}?businessId=${encodeURIComponent(
          businessId
        )}`,
        { method: "DELETE" }
      );

      if (editingId === purchase.id) {
        resetForm();
      }

      setMessage(result.message || "Purchase deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete the purchase.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  return (
    <div className="add-stock-page">
      <style>{`
        .add-stock-page {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding: 16px;
          color: #172033;
          font-family: Arial, Helvetica, sans-serif;
        }

        .add-stock-page *,
        .add-stock-page *::before,
        .add-stock-page *::after {
          box-sizing: border-box;
        }

        .add-stock-page .as-panel {
          width: 100%;
          margin: 0 0 22px;
          padding: 22px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        }

        .add-stock-page .as-title {
          margin: 0 0 20px;
          color: #111827;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.35;
        }

        .add-stock-page label {
          display: block;
          margin: 0 0 7px;
          color: #334155;
          font-size: 14px;
          font-weight: 600;
        }

        .add-stock-page input {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 44px;
          padding: 11px 12px;
          color: #111827 !important;
          background-color: #ffffff !important;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .add-stock-page input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .add-stock-page input:disabled {
          color: #64748b !important;
          background: #f1f5f9 !important;
          cursor: not-allowed;
        }

        .add-stock-page input::placeholder {
          color: #94a3b8;
        }

        .add-stock-page .as-form-group {
          min-width: 0;
        }

        .add-stock-page .as-product-field {
          margin-bottom: 18px;
        }

        .add-stock-page .as-small {
          display: block;
          margin-top: 7px;
          color: #64748b;
          font-size: 12px;
        }

        .add-stock-page .as-product-summary {
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin: 14px 0 20px;
          padding: 14px 16px;
          background: #f0f7ff;
          border: 1px solid #dbeafe;
          border-left: 4px solid #2563eb;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .add-stock-page .as-product-summary strong {
          color: #1d4ed8;
          font-size: 15px;
        }

        .add-stock-page .as-product-summary span {
          color: #334155;
        }

        .add-stock-page .as-form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 8px;
        }

        .add-stock-page .as-cost-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 20px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .add-stock-page .as-cost-preview span {
          color: #475569;
          font-size: 14px;
        }

        .add-stock-page .as-cost-preview strong {
          color: #166534;
          font-size: 21px;
          font-weight: 700;
          overflow-wrap: anywhere;
          text-align: right;
        }

        .add-stock-page .as-form-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .add-stock-page button {
          min-height: 40px;
          padding: 10px 16px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .add-stock-page button:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .add-stock-page button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .add-stock-page .as-secondary-button {
          color: #334155;
          background: #ffffff;
          border-color: #cbd5e1;
        }

        .add-stock-page .as-secondary-button:hover:not(:disabled) {
          color: #0f172a;
          background: #f1f5f9;
        }

        .add-stock-page .as-delete-button {
          background: #dc2626;
        }

        .add-stock-page .as-delete-button:hover:not(:disabled) {
          background: #b91c1c;
        }

        .add-stock-page .as-message {
          margin: 0 0 16px;
          padding: 12px 14px;
          border: 1px solid;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .add-stock-page .as-error {
          color: #991b1b;
          background: #fef2f2;
          border-color: #fecaca;
        }

        .add-stock-page .as-success {
          color: #166534;
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .add-stock-page .as-empty-state {
          padding: 22px 12px;
          color: #64748b;
          font-size: 14px;
          text-align: center;
        }

        .add-stock-page .as-table-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
        }

        .add-stock-page .as-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          background: #ffffff;
          font-size: 13px;
        }

        .add-stock-page .as-table th {
          padding: 13px 12px;
          color: #334155;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        .add-stock-page .as-table td {
          padding: 12px;
          color: #334155;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }

        .add-stock-page .as-table tbody tr:last-child td {
          border-bottom: none;
        }

        .add-stock-page .as-table tbody tr:hover {
          background: #f8fafc;
        }

        .add-stock-page .as-row-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .add-stock-page .as-row-actions button {
          min-height: 34px;
          padding: 7px 11px;
          font-size: 12px;
        }

        @media (max-width: 760px) {
          .add-stock-page {
            padding: 10px;
          }

          .add-stock-page .as-panel {
            padding: 16px;
            margin-bottom: 16px;
            border-radius: 11px;
          }

          .add-stock-page .as-title {
            font-size: 19px;
            margin-bottom: 17px;
          }

          .add-stock-page .as-form-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .add-stock-page .as-cost-preview {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .add-stock-page .as-cost-preview strong {
            text-align: left;
          }

          .add-stock-page .as-form-actions {
            flex-direction: column;
          }

          .add-stock-page .as-form-actions button {
            width: 100%;
          }

          .add-stock-page .as-table {
            min-width: 800px;
          }
        }

        @media (max-width: 380px) {
          .add-stock-page {
            padding: 6px;
          }

          .add-stock-page .as-panel {
            padding: 12px;
          }

          .add-stock-page .as-title {
            font-size: 17px;
          }

          .add-stock-page input {
            font-size: 13px;
          }
        }
      `}</style>

      <section className="as-panel">
        <h2 className="as-title">
          {editingId ? "Edit Purchase" : "Record Purchase"}
        </h2>

        {error && (
          <div className="as-message as-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="as-message as-success" role="status">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="as-product-field">
            <label htmlFor="purchase-product">Product</label>

            <input
              id="purchase-product"
              list="stoka-product-list"
              value={form.productSearch}
              onChange={(event) => handleProductSearch(event.target.value)}
              placeholder="Search or select a product"
              autoComplete="off"
              required
              disabled={Boolean(editingId)}
            />

            <datalist id="stoka-product-list">
              {products.map((product) => (
                <option key={product.id} value={product.stockName} />
              ))}
            </datalist>

            {editingId && (
              <small className="as-small">
                The product cannot be changed while editing a purchase.
              </small>
            )}
          </div>

          {selectedProduct && (
            <div className="as-product-summary">
              <strong>{selectedProduct.stockName}</strong>

              <span>
                1 {selectedProduct.packName || "pack"} ={" "}
                {selectedProduct.unitsPerPack}{" "}
                {selectedProduct.unitName || "units"}
              </span>

              <span>
                Current stock: {selectedProduct.stockPacks || 0}{" "}
                {selectedProduct.packName || "packs"} and{" "}
                {selectedProduct.stockUnits || 0}{" "}
                {selectedProduct.unitName || "units"}
              </span>
            </div>
          )}

          <div className="as-form-grid">
            <div className="as-form-group">
              <label htmlFor="purchase-packs">Packaging received</label>
              <input
                id="purchase-packs"
                type="number"
                min="0"
                step="any"
                value={form.packsAdded}
                onChange={(event) =>
                  setForm({ ...form, packsAdded: event.target.value })
                }
                placeholder="0"
                required
              />
            </div>

            <div className="as-form-group">
              <label htmlFor="purchase-units">Loose units received</label>
              <input
                id="purchase-units"
                type="number"
                min="0"
                step="any"
                value={form.unitsAdded}
                onChange={(event) =>
                  setForm({ ...form, unitsAdded: event.target.value })
                }
                placeholder="0"
                required
              />
            </div>

            <div className="as-form-group">
              <label htmlFor="purchase-price">Purchase price per packaging</label>
              <input
                id="purchase-price"
                type="number"
                min="0"
                step="any"
                value={form.purchasePricePerPack}
                onChange={(event) =>
                  setForm({
                    ...form,
                    purchasePricePerPack: event.target.value,
                  })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="as-cost-preview">
            <span>Estimated purchase cost</span>
            <strong>{formatMoney(estimatedCost)}</strong>
          </div>

          <div className="as-form-actions">
            <button type="submit" disabled={saving || loading}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Record Purchase"}
            </button>

            {editingId && (
              <button
                type="button"
                className="as-secondary-button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="as-panel">
        <h2 className="as-title">Purchase History</h2>

        {loading ? (
          <div className="as-empty-state">Loading purchase history...</div>
        ) : purchases.length === 0 ? (
          <div className="as-empty-state">
            No purchases have been recorded yet.
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Packs</th>
                  <th>Loose Units</th>
                  <th>Price / Pack</th>
                  <th>Total Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{formatDate(purchase.createdAt)}</td>
                    <td>{purchase.productName}</td>
                    <td>{purchase.packsAdded}</td>
                    <td>{purchase.unitsAdded}</td>
                    <td>
                      {formatMoney(purchase.purchasePricePerPack)}
                    </td>
                    <td>{formatMoney(purchase.totalCost)}</td>
                    <td>
                      <div className="as-row-actions">
                        <button
                          type="button"
                          onClick={() => startEditing(purchase)}
                          disabled={saving || deletingId !== null}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="as-delete-button"
                          onClick={() => handleDelete(purchase)}
                          disabled={saving || deletingId !== null}
                        >
                          {deletingId === purchase.id
                            ? "Deleting..."
                            : "Delete"}
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