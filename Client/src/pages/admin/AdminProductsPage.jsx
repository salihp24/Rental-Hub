import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import ProductsSection from "./ProductsSection";
import { cardClass } from "./ui.jsx";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadProducts = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("page", String(nextPage));
      params.set("sort", "-createdAt");
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (city.trim()) params.set("city", city.trim());

      const res = await api.get(`/admin/products?${params.toString()}`);
      setProducts(res?.data?.data?.products || []);
      setTotalPages(res?.data?.pagination?.pages || 1);
      setTotal(res?.data?.pagination?.total || 0);
      setPage(res?.data?.pagination?.page || nextPage);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts(1);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProductStatus = async (productId, status) => {
    setBusyKey(`product-status-${productId}`);
    try {
      const payload = { status, reviewNote: "Updated from admin panel" };
      if (status === "inactive") {
        payload.rejectionReason = "Temporarily hidden by administrator.";
      }
      const res = await api.patch(`/admin/products/${productId}/status`, payload);
      const updatedProduct = res?.data?.data?.product;
      if (updatedProduct?._id) {
        setProducts((prev) =>
          prev.map((product) => (product._id === updatedProduct._id ? updatedProduct : product))
        );
      }
    } finally {
      setBusyKey("");
    }
  };

  const toggleFeatured = async (productId, isFeatured) => {
    setBusyKey(`product-featured-${productId}`);
    try {
      const res = await api.patch(`/admin/products/${productId}/featured`, { isFeatured: !isFeatured });
      const updatedProduct = res?.data?.data?.product;
      if (updatedProduct?._id) {
        setProducts((prev) =>
          prev.map((product) => (product._id === updatedProduct._id ? updatedProduct : product))
        );
      }
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-5 ${cardClass}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Product Management</h1>
          <Button onClick={() => loadProducts(page)}>Refresh</Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title/description"
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          >
            <option value="">All status</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="under_review">under_review</option>
            <option value="rented">rented</option>
          </select>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter by city"
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          />
          <Button onClick={() => loadProducts(1)}>Apply Filters</Button>
        </div>
        <p className="mt-2 text-xs text-black/60">Total products: {total}</p>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className={`p-5 text-sm ${cardClass}`}>Loading products...</div>
      ) : (
        <>
          <ProductsSection
            products={products}
            busyKey={busyKey}
            onUpdateProductStatus={updateProductStatus}
            onToggleFeatured={toggleFeatured}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => loadProducts(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm font-semibold">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => loadProducts(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
