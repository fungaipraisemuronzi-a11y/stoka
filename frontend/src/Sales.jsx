import { useCallback, useEffect, useMemo, useState } from "react";
import "./Sales.css";

const API_URL = "http://localhost:5000";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const number = (value) => Number(value || 0);

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "The request failed.");
  }

  return data;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function availableUnits(product) {
  return (
    number(product.stockPacks) * number(product.unitsPerPack) +
    number(product.stockUnits)
  );
}

export default function Sales({
  business,
  tellerId,
  tellerName,
  onBack,
  onChangePassword,
}) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [returnableSales, setReturnableSales] = useState([]);

  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("sale");

  // Returns
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [editingReturnId, setEditingReturnId] = useState(null);

  // Withdrawals
  const [withdrawalProductId, setWithdrawalProductId] = useState("");
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalQuantity, setWithdrawalQuantity] = useState("");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [editingWithdrawalId, setEditingWithdrawalId] = useState(null);

  const businessId = business?.id;

  const notify = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;

    setLoadingProducts(true);

    try {
      const data = await apiRequest(
        `/api/products?businessId=${encodeURIComponent(businessId)}`
      );

      setProducts(data.products || []);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoadingProducts(false);
    }
  }, [businessId, notify]);

  const loadSales = useCallback(async () => {
    if (!businessId || !tellerId) return;

    setLoadingSales(true);

    try {
      const data = await apiRequest(
        `/api/sales?businessId=${encodeURIComponent(
          businessId
        )}&tellerId=${encodeURIComponent(tellerId)}`
      );

      setSales(data.sales || []);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoadingSales(false);
    }
  }, [businessId, tellerId, notify]);

  const loadReturns = useCallback(async () => {
    if (!businessId || !tellerId) return;

    setLoadingReturns(true);

    try {
      const data = await apiRequest(
        `/api/returns?businessId=${encodeURIComponent(
          businessId
        )}&tellerId=${encodeURIComponent(tellerId)}`
      );

      setReturns(data.returns || []);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoadingReturns(false);
    }
  }, [businessId, tellerId, notify]);

  const loadReturnableSales = useCallback(async () => {
    if (!businessId || !tellerId) return;

    try {
      const data = await apiRequest(
        `/api/returns/sales?businessId=${encodeURIComponent(
          businessId
        )}&tellerId=${encodeURIComponent(tellerId)}`
      );

      setReturnableSales(data.sales || []);
    } catch (error) {
      notify(error.message, "error");
    }
  }, [businessId, tellerId, notify]);

  const loadWithdrawals = useCallback(async () => {
    if (!businessId || !tellerId) return;

    setLoadingWithdrawals(true);

    try {
      const data = await apiRequest(
        `/api/withdrawals?businessId=${encodeURIComponent(
          businessId
        )}&tellerId=${encodeURIComponent(tellerId)}`
      );

      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoadingWithdrawals(false);
    }
  }, [businessId, tellerId, notify]);

  useEffect(() => {
    if (!businessId || !tellerId) return;

    loadProducts();
    loadSales();
    loadReturns();
    loadReturnableSales();
    loadWithdrawals();
  }, [
    businessId,
    tellerId,
    loadProducts,
    loadSales,
    loadReturns,
    loadReturnableSales,
    loadWithdrawals,
  ]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) =>
      String(product.stockName || "").toLowerCase().includes(term)
    );
  }, [products, search]);

  const filteredWithdrawalProducts = useMemo(() => {
    const term = withdrawalSearch.trim().toLowerCase();

    if (!term) return [];

    return products
      .filter((product) =>
        String(product.stockName || "").toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [products, withdrawalSearch]);

  const selectedWithdrawalProduct = useMemo(
    () =>
      products.find(
        (product) =>
          String(product.id) === String(withdrawalProductId)
      ),
    [products, withdrawalProductId]
  );

  const selectedReturnSale = useMemo(
    () =>
      returnableSales.find(
        (sale) => String(sale.id) === String(selectedSaleId)
      ),
    [returnableSales, selectedSaleId]
  );

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + item.quantity * item.unitSellingPrice,
      0
    );

    const discountTotal = cart.reduce(
      (sum, item) => sum + number(item.discountAmount),
      0
    );

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      total: Math.round((subtotal - discountTotal) * 100) / 100,
    };
  }, [cart]);

  const cartUnits = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + number(item.quantity),
        0
      ),
    [cart]
  );

  const estimatedRefund = useMemo(() => {
    if (!selectedReturnSale) return 0;

    const existingReturn = editingReturnId
      ? returns.find(
          (item) => String(item.id) === String(editingReturnId)
        )
      : null;

    return (selectedReturnSale.items || []).reduce(
      (sum, item) => {
        const quantity = number(returnQuantities[item.id]);
        const sold = number(item.quantity);

        const previouslyReturned = number(
          existingReturn?.items?.find(
            (returnedItem) =>
              Number(returnedItem.saleItemId) === Number(item.id)
          )?.quantity
        );

        const returnable =
          number(item.returnableQuantity ?? item.returnable) +
          previouslyReturned;

        if (quantity <= 0 || sold <= 0 || quantity > returnable) {
          return sum;
        }

        const itemTotal = number(item.lineTotal);

        const unitRefund =
          itemTotal > 0
            ? itemTotal / sold
            : number(item.unitSellingPrice);

        return sum + quantity * unitRefund;
      },
      0
    );
  }, [selectedReturnSale, returnQuantities, editingReturnId, returns]);

  // ---------------- SALES ----------------

  function addToCart(product) {
    setMessage("");

    const available = availableUnits(product);

    if (available <= 0) {
      notify(`${product.stockName} is out of stock.`, "error");
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => String(item.productId) === String(product.id)
      );

      if (existing) {
        if (existing.quantity + 1 > existing.available) {
          notify(`Not enough stock for ${product.stockName}.`, "error");
          return current;
        }

        return current.map((item) =>
          String(item.productId) === String(product.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          stockName: product.stockName,
          unitName: product.unitName,
          quantity: 1,
          unitSellingPrice: number(product.unitSellingPrice),
          discountAmount: 0,
          available,
        },
      ];
    });
  }

  function changeCartQuantity(productId, change) {
    setMessage("");

    setCart((current) =>
      current.map((item) => {
        if (String(item.productId) !== String(productId)) {
          return item;
        }

        const quantity = Math.max(
          1,
          Math.min(item.available, item.quantity + change)
        );

        return {
          ...item,
          quantity,
          discountAmount: Math.min(
            number(item.discountAmount),
            quantity * item.unitSellingPrice
          ),
        };
      })
    );
  }

  function updateCartItem(productId, field, value) {
    if (field !== "discountAmount") return;

    setMessage("");

    setCart((current) =>
      current.map((item) => {
        if (String(item.productId) !== String(productId)) {
          return item;
        }

        if (value === "") {
          return { ...item, discountAmount: 0 };
        }

        const amount = Number(value);
        const maximum = item.quantity * item.unitSellingPrice;

        if (
          !Number.isFinite(amount) ||
          amount < 0 ||
          amount > maximum
        ) {
          return item;
        }

        return { ...item, discountAmount: amount };
      })
    );
  }

  function removeFromCart(productId) {
    setCart((current) =>
      current.filter(
        (item) => String(item.productId) !== String(productId)
      )
    );
  }

  async function checkout() {
    if (!tellerId) {
      notify("No logged-in teller was found. Please log in again.", "error");
      return;
    }

    if (!cart.length) {
      notify("Add at least one product to the cart.", "error");
      return;
    }

    if (
      cart.some(
        (item) =>
          item.quantity <= 0 ||
          item.quantity > item.available ||
          item.discountAmount < 0 ||
          item.discountAmount > item.quantity * item.unitSellingPrice
      )
    ) {
      notify("Check the quantities and discounts in your cart.", "error");
      return;
    }

    if (
      !window.confirm(
        `Complete this cash sale for ${money(cartTotals.total)}?`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const data = await apiRequest("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          tellerId,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            discountAmount: item.discountAmount,
          })),
        }),
      });

      setCart([]);
      notify(`Sale completed! Receipt: ${data.sale.receiptNumber}`);

      await Promise.all([loadProducts(), loadSales()]);
      setActiveTab("history");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- RETURNS ----------------

  function selectSaleForReturn(saleId) {
    setSelectedSaleId(saleId);
    setReturnQuantities({});
    setReturnReason("");
  }

  function setReturnQuantity(itemId, value) {
    if (value === "") {
      setReturnQuantities((current) => ({
        ...current,
        [itemId]: "",
      }));
      return;
    }

    const quantity = Number(value);

    if (!Number.isFinite(quantity) || quantity < 0) return;

    setReturnQuantities((current) => ({
      ...current,
      [itemId]: quantity,
    }));
  }

  function startEditReturn(item) {
    const sale = returnableSales.find(
      (entry) => String(entry.id) === String(item.saleId)
    );

    if (!sale) {
      notify(
        "The original sale could not be loaded. Refresh the return history and try again.",
        "error"
      );
      return;
    }

    setEditingReturnId(item.id);
    setSelectedSaleId(String(item.saleId));
    setReturnReason(item.reason || "");

    const quantities = {};

    for (const returnedItem of item.items || []) {
      quantities[returnedItem.saleItemId] = number(returnedItem.quantity);
    }

    setReturnQuantities(quantities);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditReturn() {
    setEditingReturnId(null);
    setSelectedSaleId("");
    setReturnReason("");
    setReturnQuantities({});
  }

  async function submitReturn(event) {
    event.preventDefault();

    if (!tellerId) {
      notify("No logged-in teller was found. Please log in again.", "error");
      return;
    }

    if (!selectedReturnSale) {
      notify("Select a sale first.", "error");
      return;
    }

    if (!returnReason.trim()) {
      notify("Select a reason for the return.", "error");
      return;
    }

    const existingReturn = editingReturnId
      ? returns.find(
          (item) => String(item.id) === String(editingReturnId)
        )
      : null;

    const items = (selectedReturnSale.items || [])
      .map((item) => {
        const previouslyReturned = number(
          existingReturn?.items?.find(
            (returnedItem) =>
              Number(returnedItem.saleItemId) === Number(item.id)
          )?.quantity
        );

        return {
          saleItemId: item.id,
          quantity: number(returnQuantities[item.id]),
          maximum:
            number(item.returnableQuantity ?? item.returnable) +
            previouslyReturned,
        };
      })
      .filter((item) => item.quantity > 0);

    if (!items.length) {
      notify("Enter a quantity for at least one returned item.", "error");
      return;
    }

    if (items.some((item) => item.quantity > item.maximum)) {
      notify("A return quantity exceeds the quantity available to return.", "error");
      return;
    }

    const confirmation = editingReturnId
      ? `Save changes to this return? Estimated refund: ${money(estimatedRefund)}`
      : `Record this return? Estimated refund: ${money(estimatedRefund)}`;

    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setMessage("");

    try {
      const data = await apiRequest(
        editingReturnId
          ? `/api/returns/${editingReturnId}`
          : "/api/returns",
        {
          method: editingReturnId ? "PATCH" : "POST",
          body: JSON.stringify({
            businessId,
            tellerId,
            saleId: selectedReturnSale.id,
            reason: returnReason.trim(),
            items: items.map(({ saleItemId, quantity }) => ({
              saleItemId,
              quantity,
            })),
          }),
        }
      );

      if (editingReturnId) {
        notify("Return updated and stock adjusted.");
      } else {
        notify(
          `Return recorded. Refund: ${money(
            data.return?.totalRefund ?? data.totalRefund
          )}`
        );
      }

      cancelEditReturn();

      await Promise.all([
        loadProducts(),
        loadReturns(),
        loadReturnableSales(),
        loadSales(),
      ]);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReturn(item) {
    if (
      !window.confirm(
        `Delete return ${item.returnNumber || `RET-${item.id}`}? Stock will be adjusted.`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await apiRequest(`/api/returns/${item.id}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId, tellerId }),
      });

      if (String(editingReturnId) === String(item.id)) {
        cancelEditReturn();
      }

      notify("Return deleted and stock adjusted.");

      await Promise.all([
        loadProducts(),
        loadReturns(),
        loadReturnableSales(),
        loadSales(),
      ]);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- WITHDRAWALS ----------------

  function startEditWithdrawal(item) {
    const product = products.find(
      (entry) => String(entry.id) === String(item.productId)
    );

    const unitsPerPack = Math.max(1, number(product?.unitsPerPack));

    const totalUnits =
      number(item.packsWithdrawn) * unitsPerPack +
      number(item.unitsWithdrawn);

    setEditingWithdrawalId(item.id);
    setWithdrawalProductId(String(item.productId));
    setWithdrawalSearch(
      item.productName || item.stockName || product?.stockName || ""
    );
    setWithdrawalQuantity(String(totalUnits));
    setWithdrawalReason(item.reason || "");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditWithdrawal() {
    setEditingWithdrawalId(null);
    setWithdrawalProductId("");
    setWithdrawalSearch("");
    setWithdrawalQuantity("");
    setWithdrawalReason("");
  }

  async function submitWithdrawal(event) {
    event.preventDefault();

    if (!tellerId) {
      notify("No logged-in teller was found. Please log in again.", "error");
      return;
    }

    if (!withdrawalProductId || !selectedWithdrawalProduct) {
      notify("Select a product first.", "error");
      return;
    }

    const totalUnits = Number(withdrawalQuantity);

    if (
      !Number.isFinite(totalUnits) ||
      !Number.isInteger(totalUnits) ||
      totalUnits <= 0
    ) {
      notify("Enter a valid whole-number quantity.", "error");
      return;
    }

    if (!withdrawalReason.trim()) {
      notify("Select a reason for the withdrawal.", "error");
      return;
    }

    const existingWithdrawal = editingWithdrawalId
      ? withdrawals.find(
          (item) => String(item.id) === String(editingWithdrawalId)
        )
      : null;

    const unitsPerPack = Math.max(
      1,
      number(selectedWithdrawalProduct.unitsPerPack)
    );

    const previousUnits = existingWithdrawal
      ? number(existingWithdrawal.totalUnits) ||
        number(existingWithdrawal.packsWithdrawn) * unitsPerPack +
          number(existingWithdrawal.unitsWithdrawn)
      : 0;

    const sameProduct =
      existingWithdrawal &&
      String(existingWithdrawal.productId) ===
        String(selectedWithdrawalProduct.id);

    const maximumAvailable =
      availableUnits(selectedWithdrawalProduct) +
      (sameProduct ? previousUnits : 0);

    if (totalUnits > maximumAvailable) {
      notify("The withdrawal quantity exceeds available stock.", "error");
      return;
    }

    const confirmation = editingWithdrawalId
      ? `Save withdrawal changes for ${selectedWithdrawalProduct.stockName}?`
      : `Withdraw ${totalUnits} unit(s) of ${selectedWithdrawalProduct.stockName}?`;

    if (!window.confirm(confirmation)) return;

    const packs = Math.floor(totalUnits / unitsPerPack);
    const units = totalUnits % unitsPerPack;

    setSaving(true);
    setMessage("");

    try {
      await apiRequest(
        editingWithdrawalId
          ? `/api/withdrawals/${editingWithdrawalId}`
          : "/api/withdrawals",
        {
          method: editingWithdrawalId ? "PATCH" : "POST",
          body: JSON.stringify({
            businessId,
            tellerId,
            productId: selectedWithdrawalProduct.id,
            packsWithdrawn: packs,
            unitsWithdrawn: units,
            reason: withdrawalReason.trim(),
          }),
        }
      );

      notify(
        editingWithdrawalId
          ? "Withdrawal updated and stock adjusted."
          : "Withdrawal recorded successfully."
      );

      cancelEditWithdrawal();

      await Promise.all([loadProducts(), loadWithdrawals()]);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWithdrawal(item) {
    if (
      !window.confirm(
        `Delete the withdrawal for ${
          item.productName || item.stockName
        }? Stock will be restored.`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await apiRequest(`/api/withdrawals/${item.id}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId, tellerId }),
      });

      if (String(editingWithdrawalId) === String(item.id)) {
        cancelEditWithdrawal();
      }

      notify("Withdrawal deleted and stock restored.");

      await Promise.all([loadProducts(), loadWithdrawals()]);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function changeTab(tab) {
    setActiveTab(tab);
    setMessage("");

    if (tab === "returns") {
      loadReturns();
      loadReturnableSales();
    }

    if (tab === "withdrawals") {
      loadProducts();
      loadWithdrawals();
    }

    if (tab === "history") {
      loadSales();
    }
  }

  // ---------------- PAGE ----------------

  if (!businessId || !tellerId) {
    return (
      <main className="sales-page">
        <p className="sales-empty">
          {!businessId
            ? "No business was selected. Return to the home screen and select a business."
            : "No logged-in teller was found. Return to the teller login screen and log in again."}
        </p>

        <button
          type="button"
          className="sales-back-button"
          onClick={onBack}
        >
          ← Back
        </button>
      </main>
    );
  }

  return (
    <main className="sales-page">
      <header className="sales-header">
        <button
          type="button"
          className="sales-back-button"
          onClick={onBack}
        >
          ← Log out teller
        </button>

        <div className="sales-brand">
          <span className="sales-brand-icon">S</span>
          <div>
            <strong>Stoka</strong>
            <span>POINT OF SALE</span>
          </div>
        </div>

        <div className="sales-header-actions">
          <span className="sales-teller-label">
            Teller: {tellerName || "Unknown"}
          </span>

          <button
            type="button"
            className="sales-password-toggle"
            onClick={() => {
              if (typeof onChangePassword === "function") {
                onChangePassword();
              } else {
                notify(
                  "Change Password page navigation has not been connected yet.",
                  "error"
                );
              }
            }}
          >
            Change Password
          </button>
        </div>
      </header>

      <section className="sales-welcome">
        <div>
          <p className="sales-eyebrow">CASH REGISTER</p>
          <h1>{business.businessName}</h1>
          <p>Manage sales, discounts, returns and stock withdrawals.</p>
        </div>

        <div className="cash-badge">Cash only</div>
      </section>

      <nav className="sales-tabs">
        <button
          type="button"
          className={activeTab === "sale" ? "active" : ""}
          onClick={() => changeTab("sale")}
        >
          New Sale
        </button>

        <button
          type="button"
          className={activeTab === "history" ? "active" : ""}
          onClick={() => changeTab("history")}
        >
          Sales History ({sales.length})
        </button>

        <button
          type="button"
          className={activeTab === "returns" ? "active" : ""}
          onClick={() => changeTab("returns")}
        >
          Returns ({returns.length})
        </button>

        <button
          type="button"
          className={activeTab === "withdrawals" ? "active" : ""}
          onClick={() => changeTab("withdrawals")}
        >
          Withdrawals ({withdrawals.length})
        </button>
      </nav>

      {message && (
        <div
          className={`sales-message ${messageType === "error" ? "error" : ""}`}
          role="status"
        >
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* NEW SALE */}

      {activeTab === "sale" && (
        <div className="sales-layout">
          <section className="products-panel">
            <div className="sales-section-heading">
              <div>
                <p className="sales-eyebrow">PRODUCTS</p>
                <h2>New Sale</h2>
              </div>
            </div>

            <input
              className="sales-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product"
              aria-label="Search products"
            />

            {loadingProducts ? (
              <p className="sales-empty">Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="sales-empty">No matching products found.</p>
            ) : (
              <div className="sales-product-grid">
                {filteredProducts.map((product) => {
                  const available = availableUnits(product);

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

              <div className="payment-method">
                <span>Payment</span>
                <strong>Cash</strong>
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
      )}

      {/* SALES HISTORY */}

      {activeTab === "history" && (
        <section className="sales-history-panel">
          <div className="sales-section-heading">
            <h2>Sales History</h2>

            <button
              type="button"
              className="sales-refresh-button"
              onClick={loadSales}
              disabled={loadingSales}
            >
              {loadingSales ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingSales && sales.length === 0 ? (
            <p className="sales-empty">Loading sales...</p>
          ) : sales.length === 0 ? (
            <p className="sales-empty">No completed sales yet.</p>
          ) : (
            <div className="sales-table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Payment</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.receiptNumber}</td>
                      <td>{formatDate(sale.createdAt)}</td>

                      <td>
                        <details>
                          <summary>
                            {(sale.items || []).length} products
                          </summary>

                          <ul className="sale-item-details">
                            {(sale.items || []).map((item) => (
                              <li key={item.id}>
                                {item.stockName}: {item.quantity} ×{" "}
                                {money(item.unitSellingPrice)}
                                {number(item.discountAmount) > 0 &&
                                  ` (discount ${money(item.discountAmount)})`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </td>

                      <td>{money(sale.subtotal)}</td>
                      <td>{money(sale.discountTotal)}</td>
                      <td>
                        <strong>{money(sale.totalAmount)}</strong>
                      </td>
                      <td>{sale.paymentMethod || "Cash"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* RETURNS */}

      {activeTab === "returns" && (
        <div className="returns-layout">
          <section className="returns-panel">
            <div className="sales-section-heading">
              <h2>{editingReturnId ? "Edit Return" : "New Return"}</h2>
            </div>

            <form className="return-form" onSubmit={submitReturn}>
              <label>
                Original receipt
                <select
                  value={selectedSaleId}
                  onChange={(event) =>
                    selectSaleForReturn(event.target.value)
                  }
                  required
                >
                  <option value="">Select receipt...</option>

                  {returnableSales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.receiptNumber || `Sale #${sale.id}`} —{" "}
                      {formatDate(sale.createdAt)} — {money(sale.totalAmount)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedReturnSale && (
                <>
                  <h3 className="form-section-title">Items to return</h3>

                  {(selectedReturnSale.items || []).map((item) => {
                    const previousReturn = editingReturnId
                      ? returns
                          .find(
                            (entry) =>
                              String(entry.id) === String(editingReturnId)
                          )
                          ?.items?.find(
                            (returnedItem) =>
                              Number(returnedItem.saleItemId) === Number(item.id)
                          )
                      : null;

                    const remaining =
                      number(item.returnableQuantity ?? item.returnable) +
                      number(previousReturn?.quantity);

                    return (
                      <div className="return-item-row" key={item.id}>
                        <div className="return-item-info">
                          <strong>{item.stockName}</strong>
                          <span>{money(item.unitSellingPrice)} per unit</span>
                        </div>

                        <label>
                          Quantity
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="1"
                            value={returnQuantities[item.id] ?? ""}
                            disabled={remaining <= 0}
                            placeholder="0"
                            onChange={(event) =>
                              setReturnQuantity(item.id, event.target.value)
                            }
                          />
                        </label>
                      </div>
                    );
                  })}

                  <label>
                    Reason
                    <select
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                      required
                    >
                      <option value="">Select reason...</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Wrong item">Wrong item</option>
                      <option value="Customer changed mind">
                        Customer changed mind
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <div className="return-total">
                    <span>Estimated refund</span>
                    <strong>{money(estimatedRefund)}</strong>
                  </div>

                  <div className="history-actions">
                    <button
                      type="submit"
                      className="primary-action"
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : editingReturnId
                        ? "Save Changes"
                        : "Record Return"}
                    </button>

                    {editingReturnId && (
                      <button
                        type="button"
                        className="history-edit-button"
                        onClick={cancelEditReturn}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </form>

            {!selectedReturnSale && (
              <p className="sales-empty">
                {returnableSales.length === 0
                  ? "No sales with returnable items were found."
                  : "Select a receipt to continue."}
              </p>
            )}
          </section>

          <section className="returns-panel">
            <div className="sales-section-heading">
              <h2>Return History</h2>

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

            {loadingReturns && returns.length === 0 ? (
              <p className="sales-empty">Loading returns...</p>
            ) : returns.length === 0 ? (
              <p className="sales-empty">No returns recorded yet.</p>
            ) : (
              <div className="sales-table-wrapper">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Return</th>
                      <th>Receipt</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Refund</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {returns.map((item) => (
                      <tr key={item.id}>
                        <td>{item.returnNumber || `RET-${item.id}`}</td>
                        <td>{item.receiptNumber || `Sale #${item.saleId}`}</td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td className="history-reason">{item.reason}</td>
                        <td>
                          <strong>
                            {money(item.totalRefund ?? item.refundAmount)}
                          </strong>
                        </td>
                        <td>
                          <div className="history-actions">
                            <button
                              type="button"
                              className="history-edit-button"
                              onClick={() => startEditReturn(item)}
                              disabled={saving}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="history-delete-button"
                              onClick={() => deleteReturn(item)}
                              disabled={saving}
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
      )}

      {/* WITHDRAWALS */}

      {activeTab === "withdrawals" && (
        <div className="withdrawals-layout">
          <section className="withdrawals-panel">
            <div className="sales-section-heading">
              <h2>{editingWithdrawalId ? "Edit Withdrawal" : "Withdraw Stock"}</h2>
            </div>

            <form className="withdrawal-form" onSubmit={submitWithdrawal}>
              <label>
                Product
                <input
                  type="search"
                  className="sales-search"
                  value={withdrawalSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setWithdrawalSearch(value);

                    if (
                      !selectedWithdrawalProduct ||
                      String(selectedWithdrawalProduct.stockName || "")
                        .trim()
                        .toLowerCase() !== value.trim().toLowerCase()
                    ) {
                      setWithdrawalProductId("");
                    }
                  }}
                  placeholder="Search product..."
                  autoComplete="off"
                  required={!withdrawalProductId}
                />
              </label>

              {withdrawalSearch.trim() &&
                filteredWithdrawalProducts.length > 0 && (
                  <div className="withdrawal-search-results">
                    {filteredWithdrawalProducts.map((product) => (
                      <button
                        type="button"
                        key={product.id}
                        className="withdrawal-search-result"
                        onClick={() => {
                          setWithdrawalProductId(String(product.id));
                          setWithdrawalSearch(product.stockName);
                        }}
                      >
                        <strong>{product.stockName}</strong>
                        <span>Select →</span>
                      </button>
                    ))}
                  </div>
                )}

              {withdrawalSearch.trim() &&
                filteredWithdrawalProducts.length === 0 &&
                !selectedWithdrawalProduct && (
                  <p className="sales-empty">No matching products found.</p>
                )}

              {selectedWithdrawalProduct && (
                <div className="withdrawal-product-card">
                  <div className="withdrawal-product-heading">
                    <strong>{selectedWithdrawalProduct.stockName}</strong>
                  </div>

                  <label>
                    Quantity to withdraw (units)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={withdrawalQuantity}
                      onChange={(event) =>
                        setWithdrawalQuantity(event.target.value)
                      }
                      placeholder="Enter quantity"
                      required
                    />
                  </label>
                </div>
              )}

              <label>
                Reason
                <select
                  value={withdrawalReason}
                  onChange={(event) => setWithdrawalReason(event.target.value)}
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Expired">Expired</option>
                  <option value="Internal use">Internal use</option>
                  <option value="Personal use">Personal use</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <div className="history-actions">
                <button
                  type="submit"
                  className="primary-action"
                  disabled={saving || !selectedWithdrawalProduct}
                >
                  {saving
                    ? "Saving..."
                    : editingWithdrawalId
                    ? "Save Changes"
                    : "Record Withdrawal"}
                </button>

                {editingWithdrawalId && (
                  <button
                    type="button"
                    className="history-edit-button"
                    onClick={cancelEditWithdrawal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="withdrawals-panel">
            <div className="sales-section-heading">
              <h2>Withdrawal History</h2>

              <button
                type="button"
                className="sales-refresh-button"
                onClick={() => {
                  loadWithdrawals();
                  loadProducts();
                }}
                disabled={loadingWithdrawals}
              >
                {loadingWithdrawals ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loadingWithdrawals && withdrawals.length === 0 ? (
              <p className="sales-empty">Loading withdrawals...</p>
            ) : withdrawals.length === 0 ? (
              <p className="sales-empty">No withdrawals recorded yet.</p>
            ) : (
              <div className="sales-table-wrapper">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {withdrawals.map((item) => (
                      <tr key={item.id}>
                        <td>{item.productName || item.stockName}</td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td className="history-reason">{item.reason}</td>
                        <td>
                          <div className="history-actions">
                            <button
                              type="button"
                              className="history-edit-button"
                              onClick={() => startEditWithdrawal(item)}
                              disabled={saving}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="history-delete-button"
                              onClick={() => deleteWithdrawal(item)}
                              disabled={saving}
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
      )}

      <footer className="sales-footer">
        Stoka · Sales, returns and withdrawals are recorded against this
        business&apos;s stock.
      </footer>
    </main>
  );
}