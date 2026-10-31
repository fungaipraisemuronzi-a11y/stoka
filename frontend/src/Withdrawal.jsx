
import React from "react";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString();
};

export default function Withdrawal({
  products = [],
  withdrawals = [],
  loadingWithdrawals = false,
  withdrawalSearch,
  setWithdrawalSearch,
  selectedWithdrawalProduct,
  selectWithdrawalProduct,
  withdrawalQuantity,
  setWithdrawalQuantity,
  withdrawalReason,
  setWithdrawalReason,
  withdrawalPacks,
  withdrawalUnits,
  editingWithdrawalId,
  saving = false,
  submitWithdrawal,
  startEditWithdrawal,
  cancelEditWithdrawal,
  deleteWithdrawal,
  loadWithdrawals,
}) {
  const search = (withdrawalSearch || "").trim().toLowerCase();

  const filteredProducts = search
    ? products.filter((product) =>
        String(product.stockName || product.name || "")
          .toLowerCase()
          .includes(search)
      )
    : [];

  const unitsPerPack = Number(
    selectedWithdrawalProduct?.unitsPerPack || 1
  );

  return (
    <div className="withdrawals-layout">
      <section className="withdrawals-panel">
        <div className="sales-section-heading">
          <div>
            <h2>
              {editingWithdrawalId ? "Edit Withdrawal" : "New Withdrawal"}
            </h2>
            <p>Search for a product and enter the quantity withdrawn.</p>
          </div>
        </div>

        <form
          className="withdrawal-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitWithdrawal();
          }}
        >
          <div className="form-group">
            <label>Search Product</label>

            <input
              type="text"
              value={withdrawalSearch || ""}
              onChange={(event) => setWithdrawalSearch(event.target.value)}
              placeholder="Search stock name..."
              autoComplete="off"
            />
          </div>

          {search && !selectedWithdrawalProduct && (
            <div className="withdrawal-search-results">
              {filteredProducts.length === 0 ? (
                <p>No matching products found.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className="withdrawal-search-result"
                    onClick={() => selectWithdrawalProduct(product)}
                  >
                    <span>
                      <strong>
                        {product.stockName || product.name}
                      </strong>
                      <small>
                        {product.packName || "Pack"}:{" "}
                        {product.stockPacks || 0} |{" "}
                        {product.unitName || "Units"}:{" "}
                        {product.stockUnits || 0}
                      </small>
                    </span>

                    <span>Select</span>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedWithdrawalProduct && (
            <div className="withdrawal-product-card">
              <div className="withdrawal-product-heading">
                <div>
                  <h3>
                    {selectedWithdrawalProduct.stockName ||
                      selectedWithdrawalProduct.name}
                  </h3>

                  <p>
                    {selectedWithdrawalProduct.packName || "Pack"}:{" "}
                    {selectedWithdrawalProduct.stockPacks || 0} available
                    {" · "}
                    {selectedWithdrawalProduct.unitName || "Units"}:{" "}
                    {selectedWithdrawalProduct.stockUnits || 0} available
                  </p>
                </div>

                <button
                  type="button"
                  className="history-delete-button"
                  onClick={() => selectWithdrawalProduct(null)}
                >
                  Change
                </button>
              </div>

              <div className="form-group">
                <label>Withdrawal Quantity (whole units)</label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={withdrawalQuantity ?? ""}
                  onChange={(event) =>
                    setWithdrawalQuantity(event.target.value)
                  }
                  placeholder="Enter quantity"
                  required
                />
              </div>

              <div className="withdrawal-quantity-preview">
                <span>
                  Packs: <strong>{withdrawalPacks || 0}</strong>
                </span>

                <span>
                  Loose units: <strong>{withdrawalUnits || 0}</strong>
                </span>

                <small>
                  {unitsPerPack} {selectedWithdrawalProduct.unitName || "units"}{" "}
                  per pack
                </small>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Reason for Withdrawal</label>

            <textarea
              value={withdrawalReason || ""}
              onChange={(event) => setWithdrawalReason(event.target.value)}
              placeholder="Enter reason for withdrawal"
              rows="3"
            />
          </div>

          <div className="withdrawal-form-actions">
            <button
              type="submit"
              className="primary-action"
              disabled={
                saving ||
                !selectedWithdrawalProduct ||
                Number(withdrawalQuantity) <= 0
              }
            >
              {saving
                ? "Saving..."
                : editingWithdrawalId
                ? "Update Withdrawal"
                : "Record Withdrawal"}
            </button>

            {editingWithdrawalId && (
              <button
                type="button"
                className="secondary-action"
                onClick={cancelEditWithdrawal}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="withdrawals-panel">
        <div className="sales-section-heading">
          <div>
            <h2>Withdrawal History</h2>
            <p>Withdrawals recorded by this teller.</p>
          </div>

          <button
            type="button"
            className="sales-refresh-button"
            onClick={loadWithdrawals}
            disabled={loadingWithdrawals}
          >
            {loadingWithdrawals ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingWithdrawals ? (
          <div className="cart-empty">Loading withdrawals...</div>
        ) : withdrawals.length === 0 ? (
          <div className="cart-empty">No withdrawals recorded yet.</div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Packs</th>
                  <th>Loose Units</th>
                  <th>Total Units</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {withdrawals.map((record) => {
                  const product = record.product || {};

                  const productName =
                    record.stockName ||
                    record.productName ||
                    product.stockName ||
                    product.name ||
                    "Product";

                  const packs = Number(
                    record.packsWithdrawn || record.packs || 0
                  );

                  const units = Number(
                    record.unitsWithdrawn || record.units || 0
                  );

                  const recordUnitsPerPack = Number(
                    record.unitsPerPack || product.unitsPerPack || 1
                  );

                  const totalUnits =
                    record.totalUnits ||
                    packs * recordUnitsPerPack + units;

                  return (
                    <tr key={record.id}>
                      <td>
                        {formatDate(record.createdAt || record.date)}
                      </td>

                      <td>{productName}</td>
                      <td>{packs}</td>
                      <td>{units}</td>
                      <td>{totalUnits}</td>

                      <td className="history-reason">
                        {record.reason || "-"}
                      </td>

                      <td>
                        <div className="history-actions">
                          <button
                            type="button"
                            className="history-edit-button"
                            onClick={() => startEditWithdrawal(record)}
                            disabled={saving}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="history-delete-button"
                            onClick={() => deleteWithdrawal(record.id)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
