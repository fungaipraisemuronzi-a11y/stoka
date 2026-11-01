import { useCallback, useEffect, useMemo, useState } from "react";
import "./Sales.css";
import "./SalesMenu.css";
import NewSale from "./NewSale";
import Returns from "./Returns";
import SalesHistory from "./SalesHistory";
import Withdrawal from "./Withdrawal";

const API_URL = "https://stoka-of78.onrender.com";

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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // ---------------- LOAD DATA ----------------

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

  // ---------------- SEARCH AND SELECT ----------------

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    // Do not display products until the user searches.
    if (!term) return [];

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

  // ---------------- WITHDRAWAL QUANTITY CONVERSION ----------------

  const withdrawalUnitsPerPack = Math.max(
    1,
    number(selectedWithdrawalProduct?.unitsPerPack)
  );

  const withdrawalTotalUnits = Math.max(0, number(withdrawalQuantity));

  const withdrawalPacks = Math.floor(
    withdrawalTotalUnits / withdrawalUnitsPerPack
  );

  const withdrawalUnits =
    withdrawalTotalUnits % withdrawalUnitsPerPack;

  function chooseWithdrawalProduct(product) {
    setWithdrawalProductId(product ? String(product.id) : "");
    setWithdrawalSearch(product?.stockName || "");

    if (product) {
      setWithdrawalQuantity("");
    }
  }

  // ---------------- CART TOTALS ----------------

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

  // ---------------- RETURN REFUND CALCULATION ----------------

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

  // ============================================================
  // SALES
  // ============================================================

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

  // ============================================================
  // RETURNS
  // ============================================================

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

  // ============================================================
  // WITHDRAWALS
  // ============================================================

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

  // ============================================================
  // TAB NAVIGATION
  // ============================================================

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

  // ============================================================
  // PAGE
  // ============================================================

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

  const menuItems = [
    { id: "sale", label: "New Sale" },
    { id: "returns", label: "Returns" },
    { id: "history", label: "Sales History" },
    { id: "withdrawals", label: "Withdrawal" },
  ];

  function selectMenuItem(tab) {
    setMenuOpen(false);
    changeTab(tab);
  }

  return (
    <main className="sales-page">
      {/* HEADER */}

      <header className="sales-header stoka-teller-header">
        <div className="stoka-header-brand">
          

          <div className="stoka-brand-copy"
          >
           
            <span>
              {business?.businessName ||
                business?.name ||
                "Stock Management"}
            </span>
          </div>
        </div>

        <div className="stoka-header-right">
          <div className="stoka-teller-identity">
            <strong>{tellerName || "Teller"}</strong>
           
          </div>

          <div className="stoka-overflow-wrap">
            <button
              type="button"
              className="stoka-overflow-button"
              aria-label="Open workspace menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ⋮
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="stoka-menu-backdrop"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />

                <div className="stoka-overflow-menu">
                  {menuItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={activeTab === item.id ? "active" : ""}
                      onClick={() => selectMenuItem(item.id)}
                    >
                      {item.label}

                      {item.id === "history" && ` (${sales.length})`}
                      {item.id === "returns" && ` (${returns.length})`}
                      {item.id === "withdrawals" &&
                        ` (${withdrawals.length})`}
                    </button>
                  ))}

                  <div className="stoka-menu-divider" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);

                      if (typeof onChangePassword === "function") {
                        onChangePassword();
                      } else {
                        notify(
                          "Unexpected error",
                          "error"
                        );
                      }
                    }}
                  >
                    Change Password
                  </button>

                  <button
                    type="button"
                    className="stoka-menu-home"
                    onClick={onBack}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* NOTIFICATIONS */}

      {message && (
        <div
          className={`sales-message ${
            messageType === "error" ? "error" : ""
          }`}
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
        <NewSale
          products={products}
          search={search}
          setSearch={setSearch}
          loadingProducts={loadingProducts}
          addToCart={addToCart}
          cart={cart}
          cartUnits={cartUnits}
          cartTotals={cartTotals}
          changeCartQuantity={changeCartQuantity}
          updateCartItem={updateCartItem}
          removeFromCart={removeFromCart}
          checkout={checkout}
          saving={saving}
        />
      )}

      {/* RETURNS */}

      {activeTab === "returns" && (
        <Returns
          returnableSales={returnableSales}
          returns={returns}
          loadingReturns={loadingReturns}
          selectedSaleId={selectedSaleId}
          selectSaleForReturn={selectSaleForReturn}
          selectedReturnSale={selectedReturnSale}
          editingReturnId={editingReturnId}
          returnReason={returnReason}
          setReturnReason={setReturnReason}
          returnQuantities={returnQuantities}
          setReturnQuantity={setReturnQuantity}
          estimatedRefund={estimatedRefund}
          saving={saving}
          submitReturn={() =>
            submitReturn({ preventDefault() {} })
          }
          cancelEditReturn={cancelEditReturn}
          startEditReturn={startEditReturn}
          deleteReturn={(id) => {
            const item = returns.find(
              (entry) => String(entry.id) === String(id)
            );

            if (item) deleteReturn(item);
          }}
          loadReturns={loadReturns}
          loadReturnableSales={loadReturnableSales}
        />
      )}

      {/* SALES HISTORY */}

      {activeTab === "history" && (
        <SalesHistory
          sales={sales}
          loadingSales={loadingSales}
          loadSales={loadSales}
        />
      )}

      {/* WITHDRAWALS */}

      {activeTab === "withdrawals" && (
        <Withdrawal
          products={products}
          withdrawals={withdrawals}
          loadingWithdrawals={loadingWithdrawals}
          withdrawalSearch={withdrawalSearch}
          setWithdrawalSearch={(value) => {
            setWithdrawalSearch(value);

            if (
              !selectedWithdrawalProduct ||
              String(selectedWithdrawalProduct.stockName || "")
                .trim()
                .toLowerCase() !==
                String(value || "").trim().toLowerCase()
            ) {
              setWithdrawalProductId("");
            }
          }}
          selectedWithdrawalProduct={selectedWithdrawalProduct}
          selectWithdrawalProduct={chooseWithdrawalProduct}
          withdrawalQuantity={withdrawalQuantity}
          setWithdrawalQuantity={setWithdrawalQuantity}
          withdrawalReason={withdrawalReason}
          setWithdrawalReason={setWithdrawalReason}
          withdrawalPacks={withdrawalPacks}
          withdrawalUnits={withdrawalUnits}
          editingWithdrawalId={editingWithdrawalId}
          saving={saving}
          submitWithdrawal={() =>
            submitWithdrawal({ preventDefault() {} })
          }
          startEditWithdrawal={startEditWithdrawal}
          cancelEditWithdrawal={cancelEditWithdrawal}
          deleteWithdrawal={(id) => {
            const item = withdrawals.find(
              (entry) => String(entry.id) === String(id)
            );

            if (item) deleteWithdrawal(item);
          }}
          loadWithdrawals={loadWithdrawals}
          loadProducts={loadProducts}
        />
      )}

      {/* FOOTER */}

      
    </main>
  );
}