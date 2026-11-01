
import React, { useState } from "react";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString();
};

const getReceiptNumber = (sale) =>
  sale.receiptNumber || sale.receiptNo || sale.id;

export default function SalesHistory({
  sales = [],
  loadingSales = false,
  loadSales,
}) {
  const [expandedSale, setExpandedSale] = useState(null);

  const toggleSale = (saleId) => {
    setExpandedSale((current) =>
      current === saleId ? null : saleId
    );
  };

  return (
    <div className="sales-history-panel">
      <div className="sales-section-heading">
        <div>
          <span>Sales History</span>
         
        </div>

        <button
          type="button"
          className="sales-refresh-button"
          onClick={loadSales}
          disabled={loadingSales}
        >
          {loadingSales ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loadingSales ? (
        <div className="cart-empty">Loading sales...</div>
      ) : sales.length === 0 ? (
        <div className="cart-empty">No sales recorded yet.</div>
      ) : (
        <div className="sales-table-wrapper">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt No.</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Total</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale) => {
                const items =
                  sale.items || sale.saleItems || [];

                const subtotal = Number(
                  sale.subtotal ||
                    sale.subTotal ||
                    sale.totalBeforeDiscount ||
                    0
                );

                const discount = Number(
                  sale.discountAmount ||
                    sale.totalDiscount ||
                    0
                );

                const total = Number(
                  sale.totalAmount ||
                    sale.total ||
                    sale.grandTotal ||
                    0
                );

                const isExpanded = expandedSale === sale.id;
                const receiptNumber = getReceiptNumber(sale);

                return (
                  <React.Fragment key={sale.id}>
                    <tr>
                      <td>{formatDate(sale.createdAt || sale.date)}</td>

                      <td>
                        <strong>#{receiptNumber}</strong>
                      </td>

                      <td>{items.length}</td>

                      <td>{money(subtotal || total + discount)}</td>

                      <td>{money(discount)}</td>

                      <td>
                        <strong>{money(total)}</strong>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="history-edit-button"
                          onClick={() => toggleSale(sale.id)}
                        >
                          {isExpanded ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="sale-details-row">
                        <td colSpan="7">
                          <div className="sale-item-details">
                            <h4>
                              Receipt #{receiptNumber} Items
                            </h4>

                            {items.length === 0 ? (
                              <p>No item details available.</p>
                            ) : (
                              <div className="sales-table-wrapper">
                                <table className="sales-table">
                                  <thead>
                                    <tr>
                                      <th>Product</th>
                                      <th>Quantity</th>
                                      <th>Unit Price</th>
                                      <th>Discount</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {items.map((item, index) => {
                                      const product =
                                        item.product || {};

                                      const name =
                                        item.stockName ||
                                        item.productName ||
                                        product.stockName ||
                                        product.name ||
                                        "Product";

                                      const quantity = Number(
                                        item.quantity || 0
                                      );

                                      const unitPrice = Number(
                                        item.unitSellingPrice ||
                                          item.sellingPrice ||
                                          item.unitPrice ||
                                          product.unitSellingPrice ||
                                          0
                                      );

                                      const itemDiscount = Number(
                                        item.discountAmount || 0
                                      );

                                      const lineTotal = Number(
                                        item.totalAmount ??
                                          item.lineTotal ??
                                          quantity * unitPrice -
                                            itemDiscount
                                      );

                                      return (
                                        <tr
                                          key={
                                            item.id ||
                                            `${sale.id}-${index}`
                                          }
                                        >
                                          <td>{name}</td>
                                          <td>{quantity}</td>
                                          <td>{money(unitPrice)}</td>
                                          <td>{money(itemDiscount)}</td>
                                          <td>{money(lineTotal)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="sale-details-summary">
                              <span>
                                Subtotal:{" "}
                                {money(subtotal || total + discount)}
                              </span>

                              <span>
                                Discount: {money(discount)}
                              </span>

                              <strong>
                                Total: {money(total)}
                              </strong>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
