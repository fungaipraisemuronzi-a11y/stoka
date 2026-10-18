import { useCallback, useEffect, useMemo, useState } from "react";
import "./Sales.css";

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

    // Hide all New Sale products until the teller searches.
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