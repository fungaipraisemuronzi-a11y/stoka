
import { useEffect, useState } from "react";
import AddStock from "./AddStock";
import "./App.css";
import "./Stock.css";

const API_URL = "http://localhost:5000";

const emptyForm = {
  stockName: "",
  unitName: "",
  packName: "",
  unitsPerPack: "1",
  unitSellingPrice: "0",
};

export default function Stock({ business }) {
  const [view, setView] = useState("setup");
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const businessId = business?.id;

  async function loadProducts() {
    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/products?businessId=${encodeURIComponent(businessId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load stock items.");
      }

      setProducts(data.products || []);
    } catch (err) {
      setError(`${err.message} Make sure the backend is running.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(product) {
    setForm({
      stockName: product.stockName || "",
      unitName: product.unitName || "",
      packName: product.packName || "",
      unitsPerPack: String(product.unitsPerPack ?? 1),
      unitSellingPrice: String(product.unitSellingPrice ?? 0),
    });

    setEditingId(product.id);
    setMessage("");
    setError("");

    document
      .getElementById("stock-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/api/products/${editingId}`
          : `${API_URL}/api/products`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            stockName: form.stockName.trim(),
            unitName: form.unitName.trim(),
            packName: form.packName.trim(),
            unitsPerPack: Number(form.unitsPerPack),
            unitSellingPrice: Number(form.unitSellingPrice),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save the stock item.");
      }

      setMessage(data.message || "Stock item saved successfully.");
      resetForm();
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (
      !window.confirm(
        `Delete "${product.stockName}" from stock setup? This cannot be undone.`
      )
    ) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/products/${product.id}?businessId=${encodeURIComponent(businessId)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete the stock item.");
      }

      if (editingId === product.id) resetForm();

      setMessage(data.message || "Stock item deleted successfully.");
      await loadProducts();
    } catch (err) {
      setError(
        err.message.toLowerCase().includes("foreign key")
          ? "This product has purchase history and cannot be deleted."
          : err.message
      );
    }
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div className="stock-workspace">
      <div className="stock-page-heading">
        <div>
          <p className="eyebrow">MANAGER / STOCK</p>
          <h2>{view === "setup" ? "Stock setup" : "Add stock"}</h2>
          <p className="stock-subtitle">
            {view === "setup"
              ? "Create products and manage their selling prices."
              : "Record stock purchases and update available quantities."}
          </p>
        </div>

        {view === "setup" && (
          <button
            type="button"
            className="stock-refresh-button"
            onClick={loadProducts}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        )}
      </div>

      <div className="stock-view-tabs">
        <button
          type="button"
          className={view === "setup" ? "active" : ""}
          onClick={() => {
            setView("setup");
            setMessage("");
            setError("");
            loadProducts();
          }}
        >
          📦 Stock Setup
        </button>

        <button
          type="button"
          className={view === "purchases" ? "active" : ""}
          onClick={() => {
            setView("purchases");
            setMessage("");
            setError("");
          }}
        >
          ➕ Add Stock / Purchases
        </button>
      </div>

      {view === "purchases" ? (
        <AddStock business={business} />
      ) : (
        <>
          {message && (
            <div className="manager-notice stock-message" role="status">
              {message}
            </div>
          )}

          {error && (
            <div className="stock-error" role="alert">
              {error}
            </div>
          )}

          <section className="stock-form-card" id="stock-form">
            <div className="stock-form-heading">
              <div>
                <h3>{editingId ? "Edit stock item" : "Add stock item"}</h3>
                <p>
                  {editingId
                    ? "Update the product details below."
                    : "Register a product before recording purchases."}
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  className="stock-cancel-button"
                  onClick={resetForm}
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="stock-form">
              <div className="stock-field">
                <label htmlFor="stockName">Stock name</label>
                <input
                  id="stockName"
                  name="stockName"
                  value={form.stockName}
                  onChange={handleChange}
                  placeholder="e.g. Cooking oil"
                  maxLength={150}
                  required
                />
              </div>

              <div className="stock-field">
                <label htmlFor="unitName">Unit name</label>
                <input
                  id="unitName"
                  name="unitName"
                  value={form.unitName}
                  onChange={handleChange}
                  placeholder="e.g. Bottle"
                  maxLength={50}
                  required
                />
              </div>

              <div className="stock-field">
                <label htmlFor="packName">Pack name</label>
                <input
                  id="packName"
                  name="packName"
                  value={form.packName}
                  onChange={handleChange}
                  placeholder="e.g. Box"
                  maxLength={50}
                  required
                />
              </div>

              <div className="stock-field">
                <label htmlFor="unitsPerPack">Units per pack</label>
                <input
                  id="unitsPerPack"
                  name="unitsPerPack"
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.unitsPerPack}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="stock-field">
                <label htmlFor="unitSellingPrice">Unit selling price</label>
                <input
                  id="unitSellingPrice"
                  name="unitSellingPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={form.unitSellingPrice}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="stock-form-actions">
                <button
                  className="stock-save-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Add stock item"}
                </button>
              </div>
            </form>
          </section>

          <section className="stock-list-card">
            <div className="stock-list-heading">
              <div>
                <h3>Stock items</h3>
                <p>Products registered for this business.</p>
              </div>

              <span className="stock-count">
                {products.length} {products.length === 1 ? "item" : "items"}
              </span>
            </div>

            {loading ? (
              <div className="stock-empty-state">Loading stock items...</div>
            ) : products.length === 0 ? (
              <div className="stock-empty-state">
                <span className="stock-empty-icon">📦</span>
                <h4>No stock items yet</h4>
                <p>Add your first item using the form above.</p>
              </div>
            ) : (
              <div className="stock-table-wrapper">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Stock name</th>
                      <th>Unit</th>
                      <th>Pack</th>
                      <th>Units per pack</th>
                      <th>Selling price / unit</th>
                      <th>Current quantity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td><strong>{product.stockName}</strong></td>
                        <td>{product.unitName}</td>
                        <td>{product.packName}</td>
                        <td>{Number(product.unitsPerPack)}</td>
                        <td>{formatMoney(product.unitSellingPrice)}</td>
                        <td>
                          {Number(product.stockPacks || 0)} {product.packName}
                          {" + "}
                          {Number(product.stockUnits || 0)} {product.unitName}
                        </td>
                        <td>
                          <div className="stock-row-actions">
                            <button
                              type="button"
                              className="stock-edit-button"
                              onClick={() => startEditing(product)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="stock-delete-button"
                              onClick={() => deleteProduct(product)}
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
        </>
      )}
    </div>
  );
}
