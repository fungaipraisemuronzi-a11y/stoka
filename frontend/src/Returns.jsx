
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

export default function Returns({
  returnableSales = [],
  returns = [],
  loadingReturns = false,
  selectedSaleId,
  selectSaleForReturn,
  selectedReturnSale,
  editingReturnId,
  returnReason,
  setReturnReason,
  returnQuantities = {},
  setReturnQuantity,
  estimatedRefund = 0,
  saving = false,
  submitReturn,
  cancelEditReturn,
  startEditReturn,
  deleteReturn,
  loadReturns,
  loadReturnableSales,
}) {
  return (
    <div className="returns-layout">
      <section className="returns-panel">
        <div className="sales-section-heading">
          <div>
            
            <p>Select a receipt and enter the quantities being returned.</p>
          </div>
        </div>

        <form
          className="return-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitReturn();
          }}
        >
          <div className="form-group">
            <label>Select Receipt</label>

            <select
              value={selectedSaleId || ""}
              onChange={(event) => selectSaleForReturn(event.target.value)}
              disabled={Boolean(editingReturnId)}
              required
            >
              <option value="">Choose a receipt</option>

              {returnableSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  Receipt #{sale.receiptNumber || sale.receiptNo || sale.id} -{" "}
                  {formatDate(sale.createdAt || sale.date)} -{" "}
                  {money(sale.totalAmount || sale.total)}
                </option>
              ))}
            </select>
          </div>

          {selectedReturnSale && (
            <div className="return-sale-details">
              <h3>Receipt Items</h3>

              {(selectedReturnSale.items ||
                selectedReturnSale.saleItems ||
                []).map((item) => {
                const product = item.product || {};

                const productName =
                  item.stockName ||
                  item.productName ||
                  product.stockName ||
                  product.name ||
                  "Product";

                const quantity = Number(
                  item.quantity || item.soldQuantity || 0
                );

                const alreadyReturned = Number(
                  item.returnedQuantity || item.quantityReturned || 0
                );

                const remaining = Math.max(
                  0,
                  quantity - alreadyReturned
                );

                const key = item.productId || product.id;

                return (
                  <div className="return-item-row" key={key}>
                    <div className="return-item-info">
                      <strong>{productName}</strong>
                      <small>
                        Sold: {quantity} | Already returned:{" "}
                        {alreadyReturned} | Remaining: {remaining}
                      </small>
                    </div>

                    <div className="return-quantity-control">
                      <label>Return quantity</label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        step="1"
                        value={returnQuantities[key] ?? ""}
                        onChange={(event) =>
                          setReturnQuantity(key, event.target.value)
                        }
                        disabled={remaining <= 0}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="return-total">
                <span>Estimated Refund</span>
                <strong>{money(estimatedRefund)}</strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Reason for Return</label>
            <textarea
              value={returnReason || ""}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Enter reason for return"
              rows="3"
            />
          </div>

          <div className="return-form-actions">
            <button
              type="submit"
              className="primary-action"
              disabled={saving || !selectedSaleId}
            >
              {saving
                ? "Saving..."
                : editingReturnId
                ? "Update Return"
                : "Submit Return"}
            </button>

            {editingReturnId && (
              <button
                type="button"
                className="secondary-action"
                onClick={cancelEditReturn}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="returns-panel">
        <div className="sales-section-heading">
          <div>
            <span>Return History</span>
           
          </div>

          <button
            type="button"
            className="sales-refresh-button"
            onClick={() => {
              loadReturns();
              loadReturnableSales();
            }}
            disabled={loadingReturns}
          >
            {loadingReturns ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingReturns ? (
          <div className="cart-empty">Loading returns...</div>
        ) : returns.length === 0 ? (
          <div className="cart-empty">No returns recorded yet.</div>
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt No.</th>
                  <th>Items</th>
                  <th>Refund</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {returns.map((record) => {
                  const items =
                    record.items || record.returnItems || [];

                  return (
                    <tr key={record.id}>
                      <td>
                        {formatDate(record.createdAt || record.date)}
                      </td>

                      <td>
                        #
                        {record.receiptNumber ||
                          record.receiptNo ||
                          record.sale?.receiptNumber ||
                          record.saleId ||
                          "-"}
                      </td>

                      <td>
                        {items.length > 0
                          ? items
                              .map((item) => {
                                const name =
                                  item.stockName ||
                                  item.productName ||
                                  item.product?.stockName ||
                                  item.product?.name ||
                                  "Product";

                                return `${name} × ${item.quantity || 0}`;
                              })
                              .join(", ")
                          : "-"}
                      </td>

                      <td>
                        {money(
                          record.refundAmount ||
                            record.totalAmount ||
                            record.total ||
                            0
                        )}
                      </td>

                      <td className="history-reason">
                        {record.reason || "-"}
                      </td>

                      <td>
                        <div className="history-actions">
                          <button
                            type="button"
                            className="history-edit-button"
                            onClick={() => startEditReturn(record)}
                            disabled={saving}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="history-delete-button"
                            onClick={() => deleteReturn(record.id)}
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
