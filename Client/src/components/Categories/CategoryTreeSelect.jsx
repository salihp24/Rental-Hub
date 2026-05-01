import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import Input from "../ui/Input";

function normaliseId(id) {
  if (id == null) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object" && id.$oid) return String(id.$oid);
  return String(id);
}

function subtreeMatches(node, q) {
  if (!q) return true;
  if (String(node.name || "").toLowerCase().includes(q)) return true;
  for (const ch of node.children || []) {
    if (subtreeMatches(ch, q)) return true;
  }
  return false;
}

function collectAncestorIds(nodes, targetId, chain = []) {
  for (const n of nodes || []) {
    const id = normaliseId(n._id);
    const next = [...chain, id];
    if (id === normaliseId(targetId)) return next;
    const found = collectAncestorIds(n.children, targetId, next);
    if (found) return found;
  }
  return null;
}

function findNodeById(nodes, targetId) {
  for (const n of nodes || []) {
    if (normaliseId(n._id) === normaliseId(targetId)) return n;
    const found = findNodeById(n.children, targetId);
    if (found) return found;
  }
  return null;
}

function Row({ node, depth, expanded, toggle, value, onPick, search }) {
  const id = normaliseId(node._id);
  const hasChildren = Boolean(node.children?.length);
  const open = expanded.has(id);
  const isSelected = normaliseId(value) === id;

  const label = String(node.name || "");
  const q = search.trim().toLowerCase();
  const dim = q && !label.toLowerCase().includes(q) && !subtreeMatches(node, q);

  return (
    <div className={dim ? "opacity-40" : ""}>
      <div
        className={`flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-semibold ${
          isSelected ? "bg-[#FFC800]/50 text-black" : "text-black hover:bg-black/[0.04]"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-black/70 hover:bg-black/10"
            onClick={() => toggle(id)}
          >
            {open ? "v" : ">"}
          </button>
        ) : (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-black/25">
            .
          </span>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-bold"
          onClick={() => onPick(node)}
        >
          {label}
        </button>
      </div>
      {hasChildren && open ? (
        <div>
          {node.children.map((ch) => (
            <Row
              key={normaliseId(ch._id)}
              node={ch}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              value={value}
              onPick={onPick}
              search={search}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CategoryTreeSelect({
  value,
  onChange,
  disabled = false,
  onMetaChange,
  allowClear = false,
}) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [manualExpanded, setManualExpanded] = useState(() => new Set());
  const [search, setSearch] = useState("");

  const toggle = useCallback((id) => {
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPick = useCallback(
    (node) => {
      const id = normaliseId(node._id);
      onChange?.(id, node);
      onMetaChange?.(node);
    },
    [onChange, onMetaChange]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await api.get("/categories/tree");
        const nextTree = res.data?.data?.tree ?? [];
        if (cancelled) return;

        setTree(nextTree);

        if (normaliseId(value) && nextTree.length) {
          const selectedNode = findNodeById(nextTree, value);
          if (selectedNode) {
            onMetaChange?.(selectedNode);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setTree([]);
          setLoadError(
            e?.response?.data?.message ||
              e?.message ||
              "Could not load category tree."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally load once; `value` is read only for initial expansion and auto-pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => !loading && !tree.length, [loading, tree.length]);
  const expanded = useMemo(() => {
    const next = new Set(manualExpanded);

    for (const root of tree) {
      next.add(normaliseId(root._id));
    }

    const chain = normaliseId(value) ? collectAncestorIds(tree, value) : null;
    chain?.slice(0, -1).forEach((ancestorId) => next.add(ancestorId));

    return next;
  }, [manualExpanded, tree, value]);
  return (
    <div className="space-y-2">
      {allowClear && normaliseId(value) ? (
        <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60">
          <span>Selected category ready</span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-black hover:bg-black/[0.04]"
            onClick={() => {
              onChange?.("", null);
              onMetaChange?.(null);
            }}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      ) : null}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search in tree..."
        disabled={disabled || loading || empty}
        className="text-sm"
      />
      <div
        className="max-h-72 overflow-y-auto rounded-2xl border border-black/10 bg-[#FFF7D1]/30 p-2"
        aria-busy={loading}
      >
        {loading ? (
          <div className="px-2 py-3 text-xs font-semibold text-black/50">
            Loading categories...
          </div>
        ) : loadError ? (
          <div className="px-2 py-3 text-xs font-semibold text-red-700">{loadError}</div>
        ) : empty ? (
          <div className="px-2 py-3 text-xs font-semibold text-black/55">No categories yet.</div>
        ) : (
          tree.map((n) => (
            <Row
              key={normaliseId(n._id)}
              node={n}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              value={value}
              onPick={onPick}
              search={search}
            />
          ))
        )}
      </div>
    </div>
  );
}
