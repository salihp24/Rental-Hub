import slugify from "slugify";

import Category from "../models/Category.js";

/**
 * URL slug unique among siblings (same parent). Root categories use parent = null.
 */
export async function buildSiblingUniqueCategorySlug(
  name,
  parentId,
  excludeCategoryId = null
) {
  const base =
    slugify(String(name || ""), { lower: true, strict: true, trim: true }) ||
    `category-${Date.now()}`;

  let slug = base;
  let suffix = 1;

  const parent = parentId == null ? null : parentId; 

  while (true) {
    const query = { parent, slug };
    if (excludeCategoryId) {
      query._id = { $ne: excludeCategoryId };
    }

    const exists = await Category.exists(query);
    if (!exists) return slug;

    slug = `${base}-${suffix++}`;
  }
}
