
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
          `${API_URL}/api/products?businessId=${encodeURIComponent(businessId)}`
        ),
        request(
          `${API_URL}/api/stock/purchases?businessId=${encodeURIComponent(businessId)}`
        ),
      ]);

      setProducts(
        Array.isArray(productData)
          ? productData
          : productData.products || []
      );

      setPurchases(purchaseData.purchases || []);
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

    if (packs < 0 || units < 0 || price < 0) {
      setError("Quantities and purchase price cannot be negative.");
      return;
    }

    if (packs === 0 && units === 0) {
      setError("Enter at least one pack or one loose unit.");
      return;
    }

    if (!Number.isFinite(price)) {
      setError("Enter a valid purchase price.");
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
        `${API_URL}/api/stock/purchases/${purchase.id}?businessId=${encodeURIComponent(businessId)}`,
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
    <div className="stock-workspace">
      <section className="stock-panel">
        <h2>{editingId ? "Edit Purchase" : "Add Stock / Record Purchase"}</h2>

        <p>
          Record stock received from a supplier. Purchase history changes will
          also adjust the product's current stock.
        </p>

        {error && <div className="stock-message stock-error">{error}</div>}
        {message && (
          <div className="stock-message stock-success">{message}</div>
        )}

        <form className="stock-form" onSubmit={handleSubmit}>
          <label htmlFor="purchase-product">Product</label>
          <input
            id="purchase-product"
            list="stoka-product-list"
            value={form.productSearch}
            onChange={(event) => handleProductSearch(event.target.value)}
            placeholder="Search or select a product"
            required
            disabled={Boolean(editingId)}
          />

          <datalist id="stoka-product-list">
            {products.map((product) => (
              <option key={product.id} value={product.stockName} />
            ))}
          </datalist>

          {editingId && (
            <small>
              The product cannot be changed while editing a purchase.
            </small>
          )}

          {selectedProduct && (
            <div className="stock-product-summary">
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

          <div className="stock-form-grid">
            <div>
              <label htmlFor="purchase-packs">Packs received</label>
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

            <div>
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

            <div>
              <label htmlFor="purchase-price">
                Purchase price per pack
              </label>
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

          <div className="stock-cost-preview">
            <span>Estimated purchase cost</span>
            <strong>{formatMoney(estimatedCost)}</strong>
          </div>

          <div className="stock-form-actions">
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
                className="stock-secondary-button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="stock-panel">
        <h2>Purchase History</h2>
        <p>Edit or delete a recorded purchase using the actions on each row.</p>

        {loading ? (
          <p>Loading purchase history...</p>
        ) : purchases.length === 0 ? (
          <p>No purchases have been recorded yet.</p>
        ) : (
          <div className="stock-table-wrapper">
            <table className="stock-table">
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
                    <td>{formatMoney(purchase.purchasePricePerPack)}</td>
                    <td>{formatMoney(purchase.totalCost)}</td>
                    <td>
                      <div className="stock-row-actions">
                        <button
                          type="button"
                          onClick={() => startEditing(purchase)}
                          disabled={saving || deletingId !== null}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="stock-delete-button"
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
