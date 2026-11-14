
import { useCallback, useEffect, useState } from "react";

const API_URL = "https://stoka-of78.onrender.com";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const number = (value) => Number(value || 0);

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
};

export default function AddStock({ business, managerToken }) {
  const businessId = business?.id;

  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProducts, setShowProducts] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    packsAdded: "",
    unitsAdded: "",
    purchasePricePerPack: "",
  });

  // =========================================
  // API REQUEST
  // =========================================

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(managerToken
          ? { Authorization: `Bearer ${managerToken}` }
          : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Request failed."
      );
    }

    return data;
  };

  // =========================================
  // LOAD PRODUCTS AND PURCHASE HISTORY
  // =========================================

  const loadData = useCallback(async () => {
    if (!businessId) {
      setError("Business information is missing.");
      setLoading(false);
      return;
    }

    if (!managerToken) {
      setError("Manager session is missing. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

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

      const loadedProducts = Array.isArray(productData)
        ? productData
        : productData.products || [];

      const loadedPurchases = Array.isArray(purchaseData)
        ? purchaseData
        : purchaseData.purchases || [];

      setProducts(loadedProducts);
      setPurchases(loadedPurchases);
    } catch (err) {
      setError(err.message || "Failed to load stock purchases.");
    } finally {
      setLoading(false);
    }
  }, [businessId, managerToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =========================================
  // FORM HELPERS
  // =========================================

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      packsAdded: "",
      unitsAdded: "",
      purchasePricePerPack: "",
    });

    setSelectedProduct(null);
    setSearch("");
    setEditingId(null);
    setShowProducts(false);
  };

  // =========================================
  // PRODUCT SEARCH
  // =========================================

  const filteredProducts = products.filter((product) =>
    String(product.stockName || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setSearch(product.stockName);
    setShowProducts(false);
  };

  // =========================================
  // GET PURCHASE PRODUCT NAME
  // =========================================

  const getPurchaseProductName = (purchase) => {
    if (purchase.stockName) {
      return purchase.stockName;
    }

    if (purchase.product?.stockName) {
      return purchase.product.stockName;
    }

    const productId =
      purchase.productId ??
      purchase.product_id ??
      purchase.product?.id;

    const product = products.find(
      (item) => String(item.id) === String(productId)
    );

    return product?.stockName || "Unknown product";
  };

  // =========================================
  // CALCULATIONS
  // =========================================

  const unitsPerPack =
    number(selectedProduct?.unitsPerPack) || 1;

  const packs = number(form.packsAdded);
  const looseUnits = number(form.unitsAdded);
  const pricePerPack = number(form.purchasePricePerPack);

  const totalUnits =
    packs * unitsPerPack + looseUnits;

  const estimatedCost =
    packs * pricePerPack;

  // =========================================
  // SAVE PURCHASE
  // =========================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!managerToken) {
      setError("Manager session is missing. Please log in again.");
      return;
    }

    if (!selectedProduct) {
      setError("Please select a stock item.");
      return;
    }

    if (packs < 0 || looseUnits < 0 || pricePerPack < 0) {
      setError("Values cannot be negative.");
      return;
    }

    if (
      !Number.isInteger(packs) ||
      !Number.isInteger(looseUnits)
    ) {
      setError("Packs and loose units must be whole numbers.");
      return;
    }

    if (packs === 0 && looseUnits === 0) {
      setError("Enter the number of packs or loose units.");
      return;
    }

    if (pricePerPack <= 0 && packs > 0) {
      setError("Enter a valid purchase price per pack.");
      return;
    }

    const payload = {
      businessId,
      productId: selectedProduct.id,
      packsAdded: packs,
      unitsAdded: looseUnits,
      purchasePricePerPack: pricePerPack,
    };

    try {
      setSaving(true);

      if (editingId) {
        await request(
          `${API_URL}/api/stock/purchases/${editingId}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        setSuccess("Purchase updated successfully.");
      } else {
        await request(
          `${API_URL}/api/stock/purchases`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        setSuccess("Stock purchase recorded successfully.");
      }

      resetForm();

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save purchase.");
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // EDIT PURCHASE
  // =========================================

  const handleEdit = (purchase) => {
    const productId =
      purchase.productId ??
      purchase.product_id ??
      purchase.product?.id;

    const product = products.find(
      (item) => String(item.id) === String(productId)
    );

    if (!product) {
      setError("The product for this purchase could not be found.");
      return;
    }

    setError("");
    setSuccess("");

    setSelectedProduct(product);
    setSearch(product.stockName);

    setForm({
      packsAdded: String(purchase.packsAdded ?? 0),
      unitsAdded: String(purchase.unitsAdded ?? 0),
      purchasePricePerPack: String(
        purchase.purchasePricePerPack ?? 0
      ),
    });

    setEditingId(purchase.id);
    setShowProducts(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================
  // DELETE PURCHASE
  // =========================================

  const handleDelete = async (purchase) => {
    if (
      !window.confirm(
        `Delete this purchase of ${
          getPurchaseProductName(purchase)
        }?`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await request(
        `${API_URL}/api/stock/purchases/${
          purchase.id
        }?businessId=${encodeURIComponent(businessId)}`,
        {
          method: "DELETE",
        }
      );

      setSuccess("Purchase deleted successfully.");

      if (String(editingId) === String(purchase.id)) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete purchase.");
    }
  };

  // =========================================
  // PAGE
  // =========================================

  return (
    <div className="add-stock-page">
      <style>{`

        .add-stock-page,
        .add-stock-page * {
          box-sizing: border-box;
        }

        .add-stock-page {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 20px;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          color: #182230;
          font-family: "DM Sans", "Manrope", sans-serif;
        }

        .as-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          min-width: 0;
        }

        .as-heading h2 {
          margin: 0 0 5px;
          color: #12372c;
          font-size: 23px;
          font-weight: 800;
        }

        .as-muted {
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .as-card {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 20px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          box-shadow: 0 3px 12px rgba(15, 23, 42, .04);
        }

        .as-card h3 {
          margin: 0 0 17px;
          color: #183d30;
          font-size: 17px;
          font-weight: 800;
        }

        .as-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
          min-width: 0;
        }

        .as-field {
          display: grid;
          gap: 7px;
          position: relative;
          width: 100%;
          min-width: 0;
        }

        .as-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .as-field input {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 44px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          padding: 11px 12px;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #182230;
        }

        .as-field input:focus {
          border-color: #087f5b;
          box-shadow: 0 0 0 3px rgba(8, 127, 91, .1);
        }

        .as-field input::placeholder {
          color: #94a3b8;
        }

        .as-full {
          grid-column: 1 / -1;
        }

        .as-product-results {
          position: absolute;
          z-index: 50;
          top: calc(100% + 2px);
          left: 0;
          right: 0;
          width: 100%;
          max-width: 100%;
          max-height: 220px;
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid #dbe3eb;
          border-radius: 9px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, .12);
        }

        .as-product-option {
          display: block;
          width: 100%;
          padding: 12px;
          border: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          color: #183d30;
        }

        .as-product-option:hover {
          background: #e6f5ee;
        }

        .as-selected {
          padding: 11px 12px;
          border-radius: 9px;
          background: #e6f5ee;
          color: #065c43;
          font-size: 13px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .as-preview {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          padding: 14px;
          border-radius: 11px;
          background: #f8fafc;
          margin-top: 16px;
          min-width: 0;
        }

        .as-preview div {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .as-preview span {
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
        }

        .as-preview strong {
          font-size: 15px;
          color: #183d30;
          overflow-wrap: anywhere;
        }

        .as-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .as-button {
          border: 0;
          border-radius: 9px;
          padding: 11px 17px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .as-primary {
          background: #087f5b;
          color: #ffffff;
        }

        .as-primary:hover {
          background: #065c43;
        }

        .as-secondary {
          background: #f1f5f9;
          color: #334155;
        }

        .as-secondary:hover {
          background: #e2e8f0;
        }

        .as-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .as-message {
          padding: 12px 14px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .as-error {
          color: #991b1b;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .as-success {
          color: #065f46;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
        }

        .as-table-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .as-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
          font-size: 13px;
          background: #ffffff;
        }

        .as-table th,
        .as-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          white-space: nowrap;
        }

        .as-table th {
          color: #64748b;
          background: #f8fafc;
          font-size: 12px;
          font-weight: 800;
        }

        .as-table td {
          color: #334155;
        }

        .as-table tbody tr:last-child td {
          border-bottom: none;
        }

        .as-table tbody tr:hover {
          background: #fbfdfb;
        }

        .as-row-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .as-small-button {
          border: 0;
          border-radius: 7px;
          padding: 7px 10px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 700;
          font-size: 12px;
        }

        .as-edit {
          color: #075985;
          background: #e0f2fe;
        }

        .as-edit:hover {
          background: #bae6fd;
        }

        .as-delete {
          color: #991b1b;
          background: #fee2e2;
        }

        .as-delete:hover {
          background: #fecaca;
        }

        .as-empty {
          text-align: center !important;
          padding: 25px !important;
          color: #64748b !important;
        }

        @media (max-width: 800px) {
          .add-stock-page {
            gap: 16px;
          }

          .as-card {
            padding: 17px;
          }

          .as-form-grid {
            gap: 13px;
          }
        }

        @media (max-width: 600px) {
          .add-stock-page {
            width: 100%;
            min-width: 0;
            gap: 14px;
          }

          .as-heading {
            align-items: flex-start;
          }

          .as-heading h2 {
            font-size: 20px;
          }

          .as-muted {
            font-size: 12px;
          }

          .as-card {
            width: 100%;
            padding: 13px;
            border-radius: 12px;
          }

          .as-card h3 {
            font-size: 16px;
            margin-bottom: 14px;
          }

          .as-form-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 13px;
          }

          .as-full {
            grid-column: auto;
          }

          .as-field input {
            min-height: 46px;
            font-size: 16px;
          }

          .as-preview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            padding: 12px;
          }

          .as-preview div:last-child {
            grid-column: 1 / -1;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
          }

          .as-preview span {
            font-size: 11px;
          }

          .as-preview strong {
            font-size: 14px;
          }

          .as-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 9px;
          }

          .as-button {
            width: 100%;
            min-height: 45px;
          }

          .as-table-wrap {
            border-radius: 9px;
          }

          .as-table {
            min-width: 850px;
          }

          .as-table th,
          .as-table td {
            padding: 11px 9px;
            font-size: 12px;
          }

          .as-small-button {
            min-height: 34px;
            padding: 8px 10px;
          }
        }

        @media (max-width: 360px) {
          .as-card {
            padding: 11px;
          }

          .as-preview {
            gap: 9px;
            padding: 10px;
          }

          .as-preview strong {
            font-size: 13px;
          }

          .as-heading h2 {
            font-size: 19px;
          }
        }

      `}</style>

      {/* PAGE HEADING */}

      

      {/* MESSAGES */}

      {error && (
        <div className="as-message as-error">
          {error}
        </div>
      )}

      {success && (
        <div className="as-message as-success">
          {success}
        </div>
      )}

      {/* PURCHASE FORM */}

      <section className="as-card">
        <h3>
          {editingId ? "Edit Purchase" : "Record New Purchase"}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="as-form-grid">

            {/* PRODUCT SEARCH */}

            <div className="as-field as-full">
              

              <input
                type="text"
                value={search}
                placeholder="Search for a stock item..."
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSelectedProduct(null);
                  setShowProducts(true);
                }}
                onFocus={() => setShowProducts(true)}
                autoComplete="off"
              />

              {showProducts &&
                search.trim() &&
                !selectedProduct && (
                  <div className="as-product-results">
                    {filteredProducts.length ? (
                      filteredProducts.map((product) => (
                        <button
                          type="button"
                          className="as-product-option"
                          key={product.id}
                          onClick={() => selectProduct(product)}
                        >
                          <strong>{product.stockName}</strong>

                          <span className="as-muted">
                            {" "}— {product.packName || "Pack"} contains{" "}
                            {product.unitsPerPack || 1}{" "}
                            {product.unitName || "units"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="as-product-option">
                        No matching stock items found.
                      </div>
                    )}
                  </div>
                )}

              {selectedProduct && (
                <div className="as-selected">
                  Selected: {selectedProduct.stockName}
                </div>
              )}
            </div>

            {/* PACKS */}

            <div className="as-field">
              <label>
                Packs Added ({selectedProduct?.packName || "Packs"})
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={form.packsAdded}
                onChange={(event) =>
                  updateForm("packsAdded", event.target.value)
                }
                placeholder="0"
              />
            </div>

            {/* LOOSE UNITS */}

            <div className="as-field">
              <label>
                Loose Units ({selectedProduct?.unitName || "Units"})
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={form.unitsAdded}
                onChange={(event) =>
                  updateForm("unitsAdded", event.target.value)
                }
                placeholder="0"
              />
            </div>

            {/* PURCHASE PRICE */}

            <div className="as-field as-full">
              <label>Purchase Price Per Pack</label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePricePerPack}
                onChange={(event) =>
                  updateForm(
                    "purchasePricePerPack",
                    event.target.value
                  )
                }
                placeholder="0.00"
              />
            </div>

          </div>

          {/* CALCULATIONS */}

          <div className="as-preview">
            <div>
              <span>Total Units Added</span>
              <strong>{totalUnits.toLocaleString()}</strong>
            </div>

            <div>
              <span>Units Per Pack</span>
              <strong>{unitsPerPack.toLocaleString()}</strong>
            </div>

            <div>
              <span>Estimated Purchase Cost</span>
              <strong>{money(estimatedCost)}</strong>
            </div>
          </div>

          {/* FORM ACTIONS */}

          <div className="as-actions">
            <button
              type="submit"
              className="as-button as-primary"
              disabled={saving || loading}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Purchase"
                  : "Save Purchase"}
            </button>

            {editingId && (
              <button
                type="button"
                className="as-button as-secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* PURCHASE HISTORY */}

      <section className="as-card">
        <h3>Purchase History</h3>

        {loading ? (
          <p className="as-muted">
            Loading purchase history...
          </p>
        ) : (
          <div className="as-table-wrap">
            <table className="as-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Packs</th>
                  <th>Loose Units</th>
                  <th>Price / Pack</th>
                  <th>Total Cost</th>
                  <th>Edited By</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="as-empty">
                      No purchases recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>
                        {formatDate(
                          purchase.createdAt ?? purchase.created_at
                        )}
                      </td>

                      <td>
                        {getPurchaseProductName(purchase)}
                      </td>

                      <td>
                        {number(purchase.packsAdded).toLocaleString()}
                      </td>

                      <td>
                        {number(purchase.unitsAdded).toLocaleString()}
                      </td>

                      <td>
                        {money(purchase.purchasePricePerPack)}
                      </td>

                      <td>
                        {money(purchase.totalCost)}
                      </td>

                      <td>
                        {purchase.editedBy || "Not recorded"}
                      </td>

                      <td>
                        <div className="as-row-actions">
                          <button
                            type="button"
                            className="as-small-button as-edit"
                            onClick={() => handleEdit(purchase)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="as-small-button as-delete"
                            onClick={() => handleDelete(purchase)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
