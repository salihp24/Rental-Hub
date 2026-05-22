import { Fragment, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import { cardClass } from "./ui.jsx";

const initialForm = {
  name: "",
  description: "",
  parent: "root",
  isActive: true,
};

const flattenTreeRows = (nodes, depth = 0) => {
  const rows = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.children?.length) {
      rows.push(...flattenTreeRows(node.children, depth + 1));
    }
  }
  return rows;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableBusy, setTableBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tableError, setTableError] = useState("");
  const [tableSuccess, setTableSuccess] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("createRoot");
  const [inlineParentId, setInlineParentId] = useState("");
  const [inlineForm, setInlineForm] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  const categoriesById = useMemo(() => {
    const map = new Map();
    for (const category of categories) {
      map.set(String(category._id), category);
    }
    return map;
  }, [categories]);

  const parentOptions = useMemo(
    () =>
      categories.map((cat) => ({
        value: cat._id,
        label: `${"  ".repeat(cat.level || 0)}${cat.name}`,
      })),
    [categories]
  );

  const categoryTree = useMemo(() => {
    const nodeMap = new Map();
    const roots = [];

    for (const category of categories) {
      nodeMap.set(String(category._id), { ...category, children: [] });
    }

    for (const category of categories) {
      const node = nodeMap.get(String(category._id));
      const parentId = category.parent ? String(category.parent) : "";
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
    const sortDeep = (nodes) => {
      nodes.sort(sortByName);
      for (const node of nodes) {
        if (node.children?.length) sortDeep(node.children);
      }
    };

    sortDeep(roots);
    return roots;
  }, [categories]);

  const treeRows = useMemo(() => flattenTreeRows(categoryTree), [categoryTree]);

  const getCategoryPathLabel = (category) => {
    if (!category) return "";
    const breadcrumb = [...(category.ancestors || []).map((a) => a.name), category.name].filter(Boolean);
    return breadcrumb.join(" > ");
  };

  const loadCategories = async ({ silent = false } = {}) => {
    if (silent) {
      setTableBusy(true);
    } else {
      setLoading(true);
    }
    setError("");
    setTableError("");
    try {
      const [activeRes, inactiveRes] = await Promise.all([
        api.get("/categories?limit=100&page=1"),
        api.get("/categories?limit=100&page=1&isActive=false"),
      ]);

      const activeCategories = activeRes?.data?.data?.categories || [];
      const inactiveCategories = inactiveRes?.data?.data?.categories || [];
      const mergedById = new Map();

      for (const category of [...activeCategories, ...inactiveCategories]) {
        mergedById.set(String(category._id), category);
      }

      setCategories(Array.from(mergedById.values()));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load categories.");
    } finally {
      if (silent) {
        setTableBusy(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openRootCreateForm = () => {
    setFormMode("createRoot");
    setEditingId("");
    setForm(initialForm);
    setIsFormOpen(true);
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
  };

  const openSubcategoryForm = (parentCategory) => {
    setInlineParentId(String(parentCategory._id));
    setInlineForm({ name: "", description: "", isActive: true });
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
  };

  const closeInlineSubcategoryForm = () => {
    setInlineParentId("");
    setInlineForm({ name: "", description: "", isActive: true });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        parent: form.parent === "root" ? null : form.parent,
        isActive: form.isActive,
      };

      if (editingId) {
        await api.patch(`/categories/${editingId}`, payload);
        setSuccess("Category updated.");
      } else {
        await api.post("/categories", payload);
        setSuccess("Category created.");
      }

      setForm(initialForm);
      setEditingId("");
      setIsFormOpen(false);
      setFormMode("createRoot");
      await loadCategories({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const onInlineSubmit = async (e) => {
    e.preventDefault();
    if (!inlineParentId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
    try {
      await api.post("/categories", {
        name: inlineForm.name.trim(),
        description: inlineForm.description.trim(),
        parent: inlineParentId,
        isActive: inlineForm.isActive,
      });
      setSuccess("Subcategory created.");
      closeInlineSubcategoryForm();
      await loadCategories({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    closeInlineSubcategoryForm();
    setFormMode("edit");
    setEditingId(category._id);
    setForm({
      name: category.name || "",
      description: category.description || "",
      parent: category.parent || "root",
      isActive: Boolean(category.isActive),
    });
    setIsFormOpen(true);
    setSuccess("");
    setError("");
  };

  const clearForm = () => {
    setEditingId("");
    setForm(initialForm);
    setFormMode("createRoot");
    setIsFormOpen(false);
  };

  const toggleActive = async (category) => {
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
    try {
      await api.patch(`/categories/${category._id}`, { isActive: !category.isActive });
      setTableSuccess(`Category ${!category.isActive ? "activated" : "deactivated"}.`);
      await loadCategories({ silent: true });
    } catch (err) {
      setTableError(err?.response?.data?.message || "Failed to update category status.");
    }
  };

  const deleteCategory = async (categoryId) => {
    setError("");
    setSuccess("");
    setTableError("");
    setTableSuccess("");
    try {
      await api.delete(`/categories/${categoryId}`);
      setTableSuccess("Category deleted.");
      await loadCategories({ silent: true });
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to delete category.";
      if (message.includes("sub-categories")) {
        setTableError("This category has sub-categories. Remove or reassign them before deleting.");
      } else if (message.includes("still has products")) {
        setTableError("This category contains products. Reassign or remove products before deleting.");
      } else {
        setTableError(message);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-5 ${cardClass}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Category Management</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openRootCreateForm}>
              Create Root Category
            </Button>
            <Button onClick={() => loadCategories({ silent: true })} disabled={tableBusy}>
              {tableBusy ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {isFormOpen ? (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            {formMode === "createSubcategory" ? (
              <p className="text-sm font-medium text-black/70">
                Creating subcategory under:{" "}
                <span className="font-semibold text-black">
                  {getCategoryPathLabel(categoriesById.get(String(form.parent)))}
                </span>
              </p>
            ) : null}
            {formMode === "createRoot" ? (
              <p className="text-sm font-medium text-black/70">Creating a root category.</p>
            ) : null}

            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Category name"
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                required
              />
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
              />

              {formMode === "createSubcategory" ? (
                <div className="rounded-xl border border-black/15 bg-black/[0.02] px-3 py-2 text-sm text-black/70">
                  Parent auto-selected
                </div>
              ) : (
                <select
                  value={form.parent}
                  onChange={(e) => setForm((prev) => ({ ...prev, parent: e.target.value }))}
                  className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                >
                  <option value="root">Root category</option>
                  {parentOptions
                    .filter((item) => item.value !== editingId)
                    .map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                </select>
              )}

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <Button type="submit" disabled={saving}>
                  {editingId ? "Update" : "Create"}
                </Button>
                <Button type="button" variant="secondary" onClick={clearForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-black/60">
            Use <span className="font-semibold">Create Root Category</span> or{" "}
            <span className="font-semibold">Add Subcategory</span> from a category row.
          </p>
        )}

        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-emerald-700">{success}</p> : null}
      </div>

      <div className={`p-5 ${cardClass}`}>
        <h2 className="text-xl font-black">Categories</h2>
        {tableError ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {tableError}
          </p>
        ) : null}
        {tableSuccess ? (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {tableSuccess}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-3 text-sm text-black/60">Loading categories...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            {tableBusy ? (
              <p className="mb-2 text-xs font-medium text-black/50">Updating categories...</p>
            ) : null}
            <table className="min-w-full text-sm">
              <thead className="text-left text-black/60">
                <tr className="border-b border-black/10">
                  <th className="py-2">Name</th>
                  <th className="py-2">Slug</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Level</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {treeRows.map(({ node: cat, depth }) => (
                  <Fragment key={cat._id}>
                    <tr className="border-b border-black/5 hover:bg-black/[0.02]">
                      <td className="py-2 font-medium">
                        <span style={{ paddingLeft: `${depth * 20}px` }} className="inline-flex items-center gap-2">
                          {depth > 0 ? <span className="text-black/35">+--</span> : null}
                          <span>{cat.name}</span>
                        </span>
                      </td>
                      <td className="py-2">{cat.slug}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            cat.isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {cat.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="py-2">{cat.level ?? 0}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => startEdit(cat)}>
                            Edit
                          </Button>
                          <Button variant="secondary" onClick={() => openSubcategoryForm(cat)}>
                            Add Subcategory
                          </Button>
                          <Button variant="secondary" onClick={() => toggleActive(cat)}>
                            {cat.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="secondary" onClick={() => deleteCategory(cat._id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {inlineParentId === String(cat._id) ? (
                      <tr className="border-b border-black/10 bg-black/[0.02]">
                        <td colSpan={5} className="py-3">
                          <form onSubmit={onInlineSubmit} className="space-y-2">
                            <p className="text-sm font-medium text-black/70">
                              Creating subcategory under:{" "}
                              <span className="font-semibold text-black">{getCategoryPathLabel(cat)}</span>
                            </p>
                            <div className="grid gap-2 md:grid-cols-4">
                              <input
                                value={inlineForm.name}
                                onChange={(e) =>
                                  setInlineForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                                placeholder="Subcategory name"
                                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                                required
                              />
                              <input
                                value={inlineForm.description}
                                onChange={(e) =>
                                  setInlineForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                placeholder="Description"
                                className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                              />
                              <label className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={inlineForm.isActive}
                                  onChange={(e) =>
                                    setInlineForm((prev) => ({ ...prev, isActive: e.target.checked }))
                                  }
                                />
                                Active
                              </label>
                              <div className="flex items-center gap-2">
                                <Button type="submit" disabled={saving}>
                                  Create
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={closeInlineSubcategoryForm}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
