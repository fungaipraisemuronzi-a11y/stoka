
import React from "react";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function NewSale({
  products,
  search,
  setSearch,
  loadingProducts,
  addToCart,
  cart,
  cartUnits,
  cartTotals,
  changeCartQuantity,
  updateCartItem,
  removeFromCart,
  checkout,
  saving,
}) {
  // Products are displayed only after the user searches.
  const filteredProducts = search.trim()
    ? products.filter((product) =>
        String(product.stockName || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
    : [];

  return (
    <div className="sales-layout">
      <section className="products-panel">
        <input
          className="sales-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product..."
          aria-label="Search products"
        />

        {loadingProducts ? (
          <p className="sales-empty">Loading products...</p>
        ) : !search.trim() ? (
          <p className="sales-empty">
            Search for a product to begin.
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="sales-empty">
            No matching products found.
          </p>
        ) : (
          <div className="sales-product-grid">
            {filteredProducts.map((product) => {
              const available =
                Number(product.stockPacks || 0) *
                  Number(product.unitsPerPack || 0) +
                Number(product.stockUnits || 0);

              return (
                <button
                  type="button"
                  className="sales-product-card"
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={available <= 0}
                >
                  <strong>{product.stockName}</strong>

                  <span className="product-price">
                    {money(product.unitSellingPrice)}
                  </span>

                  <span className="product-add">
                    {available <= 0 ? "Out of stock" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="cart-panel">
        <div className="sales-section-heading">
          <h2>Current Sale</h2>

          <span>
            {cartUnits} {cartUnits === 1 ? "unit" : "units"}
          </span>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <strong>Your sale is empty</strong>
            <p>Search and select products to begin.</p>
          </div>
        ) : (
          <div className="cart-items">
            {cart.map((item) => (
              <article
                className="cart-item cart-item-compact"
                key={item.productId}
              >
                <div className="cart-item-heading">
                  <div className="cart-product-title">
                    <strong>{item.stockName}</strong>

                    <span>
                      {money(item.unitSellingPrice)} × {item.quantity}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="remove-cart-item"
                    onClick={() => removeFromCart(item.productId)}
                    aria-label={`Remove ${item.stockName}`}
                  >
                    ×
                  </button>
                </div>

                <div className="cart-quick-controls">
                  <div className="cart-quantity-control">
                    <button
                      type="button"
                      className="quantity-step-button"
                      onClick={() =>
                        changeCartQuantity(item.productId, -1)
                      }
                      disabled={item.quantity <= 1}
                      aria-label={`Decrease ${item.stockName}`}
                    >
                      −
                    </button>

                    <strong className="cart-quantity-value">
                      {item.quantity}
                    </strong>

                    <button
                      type="button"
                      className="quantity-step-button"
                      onClick={() =>
                        changeCartQuantity(item.productId, 1)
                      }
                      disabled={item.quantity >= item.available}
                      aria-label={`Increase ${item.stockName}`}
                    >
                      +
                    </button>
                  </div>

                  <label className="cart-discount-inline">
                    <span>Discount ($)</span>

                    <input
                      type="number"
                      min="0"
                      max={item.quantity * item.unitSellingPrice}
                      step="0.01"
                      value={item.discountAmount}
                      onChange={(event) =>
                        updateCartItem(
                          item.productId,
                          "discountAmount",
                          event.target.value
                        )
                      }
                      aria-label={`Discount for ${item.stockName}`}
                    />
                  </label>
                </div>

                <div className="cart-line-total">
                  <span>Line total</span>

                  <strong>
                    {money(
                      item.quantity * item.unitSellingPrice -
                        item.discountAmount
                    )}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="cart-summary">
          <div>
            <span>Subtotal</span>
            <strong>{money(cartTotals.subtotal)}</strong>
          </div>

          <div>
            <span>Discount</span>

            <strong className="discount-value">
              − {money(cartTotals.discountTotal)}
            </strong>
          </div>

          <div className="cart-grand-total">
            <span>TOTAL</span>
            <strong>{money(cartTotals.total)}</strong>
          </div>

          <button
            type="button"
            className="checkout-button"
            onClick={checkout}
            disabled={saving || cart.length === 0}
          >
            {saving
              ? "Processing sale..."
              : `Complete Sale · ${money(cartTotals.total)}`}
          </button>
        </div>
      </section>
    </div>
  );
}
