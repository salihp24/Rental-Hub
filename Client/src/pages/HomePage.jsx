import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/Products/ProductCard";
import Button from "../components/ui/Button";
import api from "../lib/api";

function ProductSection({ title, subtitle, products, loading, error, emptyText }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold text-black">{title}</div>
          <div className="text-xs font-semibold text-black/55">{subtitle}</div>
        </div>
        <Button variant="ghost" className="text-sm" as={Link} to="/products">
          View all
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-black/10 bg-white"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : products.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-5 text-sm font-semibold text-black/50">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const [featuredRes, trendingRes] = await Promise.all([
          api.get("/products", {
            params: { featured: true, sort: "featured", limit: 4, page: 1 },
          }),
          api.get("/products", {
            params: { sort: "trending", limit: 8, page: 1 },
          }),
        ]);

        if (cancelled) return;

        setFeatured(featuredRes.data?.data?.products || []);
        setTrending(trendingRes.data?.data?.products || []);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || err.message || "Could not load homepage products.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5">
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:items-center md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-black/70">
              Trusted rentals for everyday needs
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-black md:text-4xl">
              Rent quality equipment with confidence.
            </h1>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-black/60">
              Discover reliable products, compare pricing modes, search nearby inventory, and
              connect directly with owners through a clear rental flow.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to="/products">
                Browse products
              </Button>
              <Button variant="secondary" as={Link} to="/list">
                List a product
              </Button>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFC800]/40 blur-2xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
            <div className="relative rounded-3xl border border-black/10 bg-[#FFF7D1] p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Featured", value: `${featured.length} live picks` },
                  { label: "Trending", value: `${trending.length} high-interest listings` },
                  { label: "Nearby", value: "Search by map coordinates" },
                  { label: "Flexible", value: "Hourly, daily, and weekly pricing" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-black/10 bg-white p-4 text-sm font-extrabold text-black shadow-sm shadow-black/5"
                  >
                    <div className="text-xs font-semibold text-black/50">{item.label}</div>
                    <div className="mt-2">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProductSection
        title="Featured listings"
        subtitle="Curated listings that are explicitly marked for homepage visibility."
        products={featured}
        loading={loading}
        error={error}
        emptyText="No featured listings yet."
      />

      <ProductSection
        title="Trending now"
        subtitle="Listings rising to the top based on rental activity and product quality signals."
        products={trending}
        loading={loading}
        error={error}
        emptyText="No trending listings yet."
      />
    </div>
  );
}
