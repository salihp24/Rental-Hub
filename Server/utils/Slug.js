import slugify from "slugify";
import Product from "../models/Product.js";

export const buildUniqueProductSlug = async (title, excludeId = null) => {
  const baseSlug =
    slugify(title, { lower: true, strict: true, trim: true }) ||
    `product-${Date.now()}`;

  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await Product.exists(query);
    if (!exists) break;

    slug = `${baseSlug}-${suffix++}`;
  }

  return slug;
};