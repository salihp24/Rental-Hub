import Category from "../models/Category.js";

/**
 * Returns this category id plus every descendant category id (for product filters, etc.).
 */
export async function getSubtreeCategoryIds(rootCategoryId) {
  const rootId = String(rootCategoryId);

  const descendantIds = await Category.distinct("_id", {
    "ancestors._id": rootCategoryId,
  });

  const out = new Set([rootId, ...descendantIds.map((id) => String(id))]);
  return [...out];
}

/**
 * Attach `children: []` and nest flat categories under their parent. Orphans (missing parent) become roots.
 */
export function buildNestedTreeFromFlat(categories) {
  const byId = new Map();

  for (const raw of categories) {
    const id = String(raw._id);
    byId.set(id, {
      ...raw,
      _id: raw._id,
      parent: raw.parent ?? null,
      children: [],
    });
  }

  const roots = [];

  for (const raw of categories) {
    const id = String(raw._id);
    const node = byId.get(id);
    const parentId = raw.parent ? String(raw.parent) : null;

    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parentNode = byId.get(parentId);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByName = (a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
    });

  const sortDeep = (nodes) => {
    nodes.sort(sortByName);
    for (const n of nodes) {
      sortDeep(n.children);
    }
  };

  sortDeep(roots);
  return roots;
}
