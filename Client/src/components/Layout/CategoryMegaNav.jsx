import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";

function categoryHref(categoryId, extraFilters = {}) {
  const params = new URLSearchParams({
    category: categoryId,
    page: "1",
    limit: "12",
    sort: "newest",
  });

  Object.entries(extraFilters).forEach(([key, value]) => {
    if (!key || !value) return;
    params.set(`attr_${key}`, value);
  });

  return `/products?${params.toString()}`;
}

function byName(a, b) {
  return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
    sensitivity: "base",
  });
}

function normalizeColumnNodes(root) {
  const children = Array.isArray(root?.children) ? [...root.children].sort(byName) : [];

  if (!children.length) return [];

  return children.map((child) => ({
    ...child,
    items: Array.isArray(child.children) ? [...child.children].sort(byName) : [],
    quickSections: collectQuickSections(child),
  }));
}

function collectNodes(node, bucket = []) {
  if (!node) return bucket;
  bucket.push(node);
  for (const child of node.children || []) {
    collectNodes(child, bucket);
  }
  return bucket;
}

function findFilterableAttribute(node, matcher, usedKeys = new Set()) {
  const attributes = Array.isArray(node?.attributes) ? node.attributes : [];
  const directMatch = attributes.find(
    (attribute) =>
      !usedKeys.has(attribute?.key) &&
      attribute?.isFilterable !== false &&
      attribute?.type === "select" &&
      Array.isArray(attribute?.options) &&
      attribute.options.length &&
      matcher(attribute)
  );

  if (directMatch) return directMatch;

  for (const child of node?.children || []) {
    const nestedMatch = findFilterableAttribute(child, matcher, usedKeys);
    if (nestedMatch) return nestedMatch;
  }

  return null;
}

function buildQuickSection(attribute, label) {
  if (!attribute?.key || !Array.isArray(attribute.options) || !attribute.options.length) {
    return null;
  }

  return {
    label: label || attribute.name || "Popular",
    key: attribute.key,
    options: attribute.options.slice(0, 6),
  };
}

function getQuickSectionLabel(attribute, fallbackIndex = 0) {
  const key = String(attribute?.key || "").toLowerCase();
  const name = String(attribute?.name || "").toLowerCase();

  if (["brand", "make"].includes(key) || name.includes("brand")) {
    return "Shop by brand";
  }

  if (["type", "category", "style"].includes(key) || name.includes("type")) {
    return "Explore types";
  }

  if (["model", "series"].includes(key) || name.includes("series") || name.includes("model")) {
    return "Popular models";
  }

  return fallbackIndex === 0 ? "Popular picks" : attribute?.name || "More filters";
}

function collectQuickSections(node) {
  const sections = [];
  const usedKeys = new Set();
  const preferredAttributes = [
    (attribute) =>
      ["brand", "make"].includes(String(attribute?.key || "").toLowerCase()) ||
      String(attribute?.name || "").toLowerCase().includes("brand"),
    (attribute) =>
      ["type", "category", "style"].includes(String(attribute?.key || "").toLowerCase()) ||
      ["type", "category"].some((term) =>
        String(attribute?.name || "")
          .toLowerCase()
          .includes(term)
      ),
    (attribute) =>
      ["model", "series"].includes(String(attribute?.key || "").toLowerCase()) ||
      ["model", "series"].some((term) =>
        String(attribute?.name || "")
          .toLowerCase()
          .includes(term)
      ),
  ];

  for (const matcher of preferredAttributes) {
    const attribute = findFilterableAttribute(node, matcher, usedKeys);
    if (attribute) {
      usedKeys.add(attribute.key);
      const label = getQuickSectionLabel(attribute, sections.length);
      const section = buildQuickSection(attribute, label);
      if (section) sections.push(section);
    }
  }

  if (sections.length < 2) {
    const fallback = findFilterableAttribute(node, () => true, usedKeys);
    if (fallback) {
      const section = buildQuickSection(
        fallback,
        getQuickSectionLabel(fallback, sections.length)
      );
      if (section) sections.push(section);
    }
  }

  return sections;
}

function collectFeaturedLinks(node) {
  const descendants = collectNodes(node, []).filter(
    (item) => String(item?._id) !== String(node?._id)
  );

  const directChildren = descendants
    .filter((item) => String(item?.parent) === String(node?._id))
    .sort(byName)
    .slice(0, 6);

  if (directChildren.length) {
    return directChildren;
  }

  return descendants.sort(byName).slice(0, 6);
}

export default function CategoryMegaNav() {
  const [tree, setTree] = useState([]);
  const [activeRootId, setActiveRootId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const res = await api.get("/categories/tree");
        if (cancelled) return;

        const nextTree = Array.isArray(res.data?.data?.tree)
          ? [...res.data.data.tree].sort(byName)
          : [];

        setTree(nextTree);
        setActiveRootId(nextTree[0]?._id || "");
      } catch (err) {
        if (!cancelled) {
          setTree([]);
          setError(err?.response?.data?.message || err.message || "Could not load categories.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeRoot = useMemo(
    () => tree.find((root) => String(root._id) === String(activeRootId)) || tree[0] || null,
    [activeRootId, tree]
  );
  const columns = useMemo(() => normalizeColumnNodes(activeRoot), [activeRoot]);

  if (loading || error || !tree.length) {
    return null;
  }

  return (
    <div
      className="relative z-30 hidden border-t border-black/10 bg-white md:block"
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="mx-auto max-w-6xl"
        onMouseEnter={() => setOpen(true)}
      >
        <div className="flex flex-wrap items-center gap-6 px-4 py-4">
          {tree.map((root) => {
            const isActive = String(root._id) === String(activeRoot?._id);

            return (
              <button
                key={root._id}
                type="button"
                onMouseEnter={() => {
                  setActiveRootId(root._id);
                  setOpen(true);
                }}
                onFocus={() => {
                  setActiveRootId(root._id);
                  setOpen(true);
                }}
                onClick={() => {
                  setActiveRootId(root._id);
                  setOpen((prev) => !prev);
                }}
                className={`border-b-2 pb-2 text-base font-extrabold transition ${
                  isActive
                    ? "border-black text-black"
                    : "border-transparent text-black/75 hover:text-black"
                }`}
              >
                {root.name}
              </button>
            );
          })}
        </div>

        {open ? (
          <div className="absolute inset-x-0 top-full border-t border-black/10 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.08)]">
            <div className="mx-auto max-w-6xl">
              <div className="grid gap-8 px-4 py-6 lg:grid-cols-6">
                {columns.length ? (
                  columns.map((column) => (
                    <div key={column._id} className="space-y-3">
                      <Link
                        to={categoryHref(column._id)}
                        className="block text-sm font-extrabold text-black hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        {column.name}
                      </Link>
                      <div className="space-y-2">
                        {column.items.length ? (
                          column.items.map((item) => (
                            <Link
                              key={item._id}
                              to={categoryHref(item._id)}
                              className="block text-sm font-semibold text-black/65 transition hover:text-black"
                              onClick={() => setOpen(false)}
                            >
                              {item.name}
                            </Link>
                          ))
                        ) : (
                          (() => {
                            const featuredLinks = collectFeaturedLinks(column);
                            if (!featuredLinks.length) {
                              return (
                                <Link
                                  to={categoryHref(column._id)}
                                  className="block text-sm font-semibold text-black/65 transition hover:text-black"
                                  onClick={() => setOpen(false)}
                                >
                                  View all
                                </Link>
                              );
                            }

                            return featuredLinks.map((item) => (
                              <Link
                                key={item._id}
                                to={categoryHref(item._id)}
                                className="block text-sm font-semibold text-black/65 transition hover:text-black"
                                onClick={() => setOpen(false)}
                              >
                                {item.name}
                              </Link>
                            ));
                          })()
                        )}
                      </div>
                      {column.quickSections?.map((section) =>
                        section?.options?.length ? (
                          <div
                            key={`${column._id}-${section.key}`}
                            className="space-y-2 border-t border-black/8 pt-3"
                          >
                            <div className="text-[11px] font-extrabold uppercase tracking-wide text-black/45">
                              {section.label}
                            </div>
                            <div className="space-y-2">
                              {section.options.map((option) => (
                                <Link
                                  key={`${column._id}-${section.key}-${option}`}
                                  to={categoryHref(column._id, { [section.key]: option })}
                                  className="block text-sm font-semibold text-black/65 transition hover:text-black"
                                  onClick={() => setOpen(false)}
                                >
                                  {option}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  ))
                ) : activeRoot ? (
                  <div className="lg:col-span-6">
                    <Link
                      to={categoryHref(activeRoot._id)}
                      className="text-sm font-semibold text-black/65 transition hover:text-black"
                      onClick={() => setOpen(false)}
                    >
                      View all in {activeRoot.name}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
