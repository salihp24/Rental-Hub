import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import ProductsSection from "./ProductsSection";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/products?limit=20&sort=-createdAt");
      setProducts(res?.data?.data?.products || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateProductStatus = async (productId, status) => {
    setBusyKey(`product-status-${productId}`);
    try {
      const payload = { status, reviewNote: "Updated from admin panel" };
      if (status === "inactive") {
        payload.rejectionReason = "Temporarily hidden by admin moderation";
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
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Product Management</h1>
          <Button onClick={loadProducts}>Refresh</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">Loading products...</div>
      ) : (
        <ProductsSection
          products={products}
          busyKey={busyKey}
          onUpdateProductStatus={updateProductStatus}
          onToggleFeatured={toggleFeatured}
        />
      )}
    </div>
  );
}
