import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProducts } from "../store/slices/productsSlice";
import ProductCard from "../components/products/ProductCard";
import Button from "../components/ui/Button";

export default function HomePage() {
  const dispatch = useDispatch();
  const { items, status, error } = useSelector((s) => s.products);

  useEffect(() => {
    dispatch(fetchProducts({ limit: 12 }));
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5">
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:items-center md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-bold text-black/70">
              New • Rent what you need
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-black md:text-4xl">
              The new standard for renting gadgets.
            </h1>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-black/60">
              List your camera, drones, gaming gear, or rent from others nearby.
              Simple pricing, secure auth, and fast search.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => document.getElementById("grid")?.scrollIntoView({ behavior: "smooth" })}>
                Browse products
              </Button>
              <Button variant="secondary" as={Link} to="/list">
                List your first product
              </Button>
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFC800]/40 blur-2xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
            <div className="relative rounded-3xl border border-black/10 bg-[#FFF7D1] p-6">
              <div className="grid grid-cols-2 gap-4">
                {["Camera", "Drone", "Gamepad", "Laptop"].map((x) => (
                  <div
                    key={x}
                    className="rounded-2xl border border-black/10 bg-white p-4 text-sm font-extrabold text-black shadow-sm shadow-black/5"
                  >
                    <div className="text-xs font-semibold text-black/50">Trending</div>
                    <div className="mt-2">{x}</div>
                    <div className="mt-3 text-[11px] font-semibold text-black/45">
                      from ₹199/day
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold text-black">Featured listings</div>
          <div className="text-xs font-semibold text-black/55">
            Fresh picks from your city
          </div>
        </div>
        <Button variant="ghost" className="text-sm">
          View all
        </Button>
      </section>

      <section id="grid">
        {status === "loading" ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
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
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

