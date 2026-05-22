import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import CategoryTreeSelect from "../components/Categories/CategoryTreeSelect";
import ProductCard from "../components/Products/ProductCard";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import api from "../lib/api";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to high" },
  { value: "price_desc", label: "Price: High to low" },
  { value: "rating", label: "Top rated" },
  { value: "nearest", label: "Nearest first" },
  { value: "trending", label: "Trending" },
  { value: "featured", label: "Featured" },
];

const CONDITION_OPTIONS = [
  { value: "", label: "Any condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

function buildDraft(searchParams) {
  const attrFilters = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("attr_") && value) {
      attrFilters[key.slice(5)] = value;
    }
  }

  return {
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    state: searchParams.get("state") || "",
    lat: searchParams.get("lat") || "",
    lng: searchParams.get("lng") || "",
    radiusKm: searchParams.get("radiusKm") || "",
    condition: searchParams.get("condition") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    sort: searchParams.get("sort") || "newest",
    attrFilters,
  };
}

function buildAttributeFilters(node, existing = {}) {
  const attributes = collectFilterableAttributes(node);
  if (!attributes.length) return {};

  const next = {};
  for (const attribute of attributes) {
    if (attribute?.isFilterable === false) continue;
    next[attribute.key] = existing[attribute.key] ?? "";
  }

  return next;
}

function collectFilterableAttributes(node, seen = new Map()) {
  if (!node) return [...seen.values()];

  const attributes = Array.isArray(node.attributes) ? node.attributes : [];
  for (const attribute of attributes) {
    if (!attribute?.key || attribute?.isFilterable === false) continue;
    if (!seen.has(attribute.key)) {
      seen.set(attribute.key, attribute);
    }
  }

  for (const child of node.children || []) {
    collectFilterableAttributes(child, seen);
  }

  return [...seen.values()];
}

function ProductBrowsePageContent({ searchParams, setSearchParams, initialDraft }) {
  const { user } = useSelector((s) => s.auth);
  const [draft, setDraft] = useState(initialDraft);
  const [selectedCategoryNode, setSelectedCategoryNode] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 12 });
  const autoLocationAppliedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const params = Object.fromEntries(searchParams.entries());
        if (!params.limit) params.limit = "12";
        if (!params.page) params.page = "1";

        const res = await api.get("/products", { params });
        if (cancelled) return;

        setProducts(res.data?.data?.products || []);
        setPagination(
          res.data?.pagination || { total: 0, page: 1, pages: 1, limit: Number(params.limit) }
        );
      } catch (err) {
        if (cancelled) return;
        setProducts([]);
        setError(err?.response?.data?.message || err.message || "We could not load listings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (autoLocationAppliedRef.current) return;

    const hasManualLocation =
      Boolean(searchParams.get("district")) ||
      Boolean(searchParams.get("city")) ||
      Boolean(searchParams.get("state")) ||
      Boolean(searchParams.get("lat")) ||
      Boolean(searchParams.get("lng"));
    if (hasManualLocation) return;

    const hasOtherFilters =
      Boolean(searchParams.get("search")) ||
      Boolean(searchParams.get("category")) ||
      Boolean(searchParams.get("condition")) ||
      Boolean(searchParams.get("minPrice")) ||
      Boolean(searchParams.get("maxPrice")) ||
      [...searchParams.keys()].some((key) => key.startsWith("attr_"));
    if (hasOtherFilters) return;

    const profileCity = user?.ownerProfile?.address?.city?.trim();
    const profileState = user?.ownerProfile?.address?.state?.trim();
    if (!profileCity && !profileState) return;

    const next = new URLSearchParams(searchParams);
    if (profileCity) {
      next.set("district", profileCity);
    }
    if (profileState) {
      next.set("state", profileState);
    }
    if (!next.get("page")) next.set("page", "1");
    if (!next.get("limit")) next.set("limit", "12");
    if (!next.get("sort")) next.set("sort", "newest");
    autoLocationAppliedRef.current = true;
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, user?.ownerProfile?.address?.city, user?.ownerProfile?.address?.state]);

  const activeFilterCount = useMemo(
    () =>
      [
        draft.search,
        draft.category,
        draft.city,
        draft.district,
        draft.state,
        draft.lat,
        draft.lng,
        draft.radiusKm,
        draft.condition,
        draft.minPrice,
        draft.maxPrice,
        ...Object.values(draft.attrFilters || {}),
      ].filter(Boolean).length,
    [draft]
  );
  const categoryAttributes = useMemo(
    () => collectFilterableAttributes(selectedCategoryNode),
    [selectedCategoryNode]
  );

  const applyFilters = () => {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(draft)) {
      if (key === "attrFilters") continue;
      if (value) next.set(key, value);
    }

    for (const [key, value] of Object.entries(draft.attrFilters || {})) {
      if (value) next.set(`attr_${key}`, value);
    }

    next.set("page", "1");
    next.set("limit", "12");
    setSearchParams(next);
  };

  const resetFilters = () => {
    setDraft({
      search: "",
      category: "",
      city: "",
      district: "",
      state: "",
      lat: "",
      lng: "",
      radiusKm: "",
      condition: "",
      minPrice: "",
      maxPrice: "",
      sort: "newest",
      attrFilters: {},
    });
    setSearchParams({ page: "1", limit: "12", sort: "newest" });
  };

  const changePage = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    if (!next.get("limit")) next.set("limit", "12");
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Marketplace
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              Browse available rental listings
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
              Use filters such as category, price, condition, and location to find the most suitable option.
            </p>
          </div>
          <Button as={Link} to="/list">
            List an Item
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm shadow-black/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Filters</div>
              <div className="text-xs font-semibold text-slate-500">
                {activeFilterCount ? `${activeFilterCount} active filters` : "Use filters to narrow results"}
              </div>
            </div>
            <Button type="button" variant="ghost" className="px-2 py-1.5 text-xs" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Search</div>
            <Input
              value={draft.search}
              onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Camera, drone, laptop"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Category</div>
            <CategoryTreeSelect
              value={draft.category}
              allowClear
              onChange={(id, node) =>
                setDraft((prev) => ({
                  ...prev,
                  category: id,
                  attrFilters: buildAttributeFilters(node, prev.attrFilters),
                }))
              }
              onMetaChange={(node) => {
                setSelectedCategoryNode(node || null);
                setDraft((prev) => ({
                  ...prev,
                  attrFilters: buildAttributeFilters(node, prev.attrFilters),
                }));
              }}
            />
          </div>

          {categoryAttributes.length ? (
            <div className="space-y-4">
              <div className="text-sm font-extrabold text-slate-900">Category Filters</div>
              <p className="text-xs font-semibold text-slate-500">
                These filters update automatically based on your selected category.
              </p>
              {categoryAttributes.map((attribute) => (
                  <div key={attribute.key} className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-700">{attribute.name}</div>
                    {attribute.type === "select" ? (
                      <select
                        value={draft.attrFilters?.[attribute.key] || ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            attrFilters: {
                              ...(prev.attrFilters || {}),
                              [attribute.key]: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Any</option>
                        {(attribute.options || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : attribute.type === "boolean" ? (
                      <select
                        value={draft.attrFilters?.[attribute.key] || ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            attrFilters: {
                              ...(prev.attrFilters || {}),
                              [attribute.key]: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <Input
                        type={attribute.type === "number" ? "number" : "text"}
                        value={draft.attrFilters?.[attribute.key] || ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            attrFilters: {
                              ...(prev.attrFilters || {}),
                              [attribute.key]: e.target.value,
                            },
                          }))
                        }
                        placeholder={`Filter by ${attribute.name.toLowerCase()}`}
                      />
                    )}
                  </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-700">City</div>
              <Input
                value={draft.city}
                onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Kochi"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-700">District Priority</div>
              <Input
                value={draft.district}
                onChange={(e) => setDraft((prev) => ({ ...prev, district: e.target.value }))}
                placeholder="Ernakulam"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-700">State</div>
              <Input
                value={draft.state}
                onChange={(e) => setDraft((prev) => ({ ...prev, state: e.target.value }))}
                placeholder="Kerala"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold text-slate-700">Proximity Search</div>
                <div className="text-[11px] font-semibold text-slate-500">
                  Use location coordinates to find nearby items.
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition((position) => {
                    setDraft((prev) => ({
                      ...prev,
                      lat: position.coords.latitude.toFixed(6),
                      lng: position.coords.longitude.toFixed(6),
                      radiusKm: prev.radiusKm || "25",
                      sort: prev.sort === "newest" ? "nearest" : prev.sort,
                    }));
                  });
                }}
              >
                Use My Location
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Input
                value={draft.lat}
                onChange={(e) => setDraft((prev) => ({ ...prev, lat: e.target.value }))}
                placeholder="Latitude"
              />
              <Input
                value={draft.lng}
                onChange={(e) => setDraft((prev) => ({ ...prev, lng: e.target.value }))}
                placeholder="Longitude"
              />
              <Input
                type="number"
                min={1}
                value={draft.radiusKm}
                onChange={(e) => setDraft((prev) => ({ ...prev, radiusKm: e.target.value }))}
                placeholder="Radius km"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Condition</div>
            <select
              value={draft.condition}
              onChange={(e) => setDraft((prev) => ({ ...prev, condition: e.target.value }))}
              className="w-full rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-700">Minimum Price / Day</div>
              <Input
                type="number"
                min={0}
                value={draft.minPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
                placeholder="200"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-700">Maximum Price / Day</div>
              <Input
                type="number"
                min={0}
                value={draft.maxPrice}
                onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
                placeholder="1500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Sort By</div>
            <select
              value={draft.sort}
              onChange={(e) => setDraft((prev) => ({ ...prev, sort: e.target.value }))}
              className="w-full rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button type="button" className="w-full" onClick={applyFilters}>
            Apply Filters
          </Button>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-blue-100 bg-white px-5 py-4 shadow-sm shadow-black/5">
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {loading ? "Loading listings..." : `${pagination.total || 0} listings available`}
              </div>
              <div className="text-xs font-semibold text-slate-500">
                Sort order: {SORT_OPTIONS.find((option) => option.value === draft.sort)?.label || "Newest"}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Page {pagination.page || 1} of {pagination.pages || 1}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-2xl border border-blue-100 bg-white"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : products.length ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              <div className="flex items-center justify-between rounded-3xl border border-blue-100 bg-white px-5 py-4 shadow-sm shadow-black/5">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={(pagination.page || 1) <= 1}
                  onClick={() => changePage((pagination.page || 1) - 1)}
                >
                  Previous
                </Button>
                <div className="text-sm font-semibold text-slate-600">
                  Showing page {pagination.page || 1}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={(pagination.page || 1) >= (pagination.pages || 1)}
                  onClick={() => changePage((pagination.page || 1) + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm shadow-black/5">
              <div className="text-lg font-extrabold text-slate-900">No listings match your criteria.</div>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Try broadening your filters or using a more general search term.
              </p>
              <Button type="button" variant="secondary" className="mt-4" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ProductBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDraft = useMemo(() => buildDraft(searchParams), [searchParams]);
  const draftKey = useMemo(() => JSON.stringify(initialDraft), [initialDraft]);

  return (
    <ProductBrowsePageContent
      key={draftKey}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      initialDraft={initialDraft}
    />
  );
}
