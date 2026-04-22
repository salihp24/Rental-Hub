import Category from "../models/Category.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import { buildSiblingUniqueCategorySlug } from "../utils/categorySlug.js";
import { buildNestedTreeFromFlat } from "../utils/categoryTree.js";

const activeEligibilityFilter = () => ({ $nor: [{ isActive: false }] });

//if there is document, then make it minimal clean version of that document
const leanSnapshot = (doc) =>
  doc
    ? {
      _id: doc._id,
      name: doc.name,
      slug: doc.slug,
      ancestors: doc.ancestors || [],
      level: doc.level ?? 0,
    }
    : null;

function applyParentMeta(categoryDoc, parentLean) {

  //case 1 - no parent 
  if (!parentLean) {
    categoryDoc.ancestors = [];
    categoryDoc.level = 0;
    return;
  }

  //Case 2 - Have parent
  //Copy parent ancestors
  categoryDoc.ancestors = [
    ...(parentLean.ancestors || []).map((a) => ({
      _id: a._id,
      name: a.name,
      slug: a.slug,
    })),

    //add the parent
    //ancestors = [grandparent, parent]
    {
      _id: parentLean._id,
      name: parentLean.name,
      slug: parentLean.slug,
    },
  ];

  //set level, take parent level +1
  categoryDoc.level = (parentLean.level ?? 0) + 1;
}

//This function ensures you don’t create invalid or circular category relationships.
async function assertReparentValid(categoryId, newParentId) {
  if (!newParentId) return;

  if (String(newParentId) === String(categoryId)) {
    throw new AppError("A category cannot be its own parent.", 400);
  }

  const cycle = await Category.exists({
    _id: newParentId,
    "ancestors._id": categoryId,
  });

  if (cycle) {
    throw new AppError(
      "Invalid parent: cannot place a category under one of its descendants.",
      400
    );
  }
}

//This function ensures that no two categories under the same parent share the same slug.
async function assertSiblingSlugUnique(parentId, slug, excludeId = null) {
  const q = { parent: parentId ?? null, slug };
  if (excludeId) q._id = { $ne: excludeId };

  const taken = await Category.exists(q);
  if (taken) {
    throw new AppError("That slug is already used by a sibling category.", 409);
  }
}

//Whenever a category changes, update all its children… and their children… and so on.
//Find children - for each child update - save it - Repeat for deeper levels
async function propagateDescendantsMeta(nodeSnapshot) {
  const children = await Category.find({ parent: nodeSnapshot._id });
  const prefix = (nodeSnapshot.ancestors || []).map((a) => ({
    _id: a._id,
    name: a.name,
    slug: a.slug,
  }));

  for (const child of children) {
    child.ancestors = [
      ...prefix,
      {
        _id: nodeSnapshot._id,
        name: nodeSnapshot.name,
        slug: nodeSnapshot.slug,
      },
    ];
    child.level = nodeSnapshot.level + 1;
    await child.save({ validateBeforeSave: false });

    const nextSnap = leanSnapshot(child.toObject ? child.toObject() : child);
    await propagateDescendantsMeta(nextSnap);
  }
}

//Fetch categories from DB based on filters like parent, search, active status, and pagination
export const listCategoriesService = async (query) => {
  const {
    parent,
    isActive,
    page = 1,
    limit = 100,
    search,
    rootsOnly,
  } = query;

  const filter = {};

  if (typeof isActive === "boolean" && isActive === false) {
    filter.isActive = false;
  } else {
    Object.assign(filter, activeEligibilityFilter());
  }

  const parentMeansRoot =
    parent === null || parent === "null" || parent === "root";

  if (
    parent !== undefined &&
    parent !== null &&
    parent !== "" &&
    !parentMeansRoot
  ) {
    filter.parent = parent;
  } else if (rootsOnly === true || parentMeansRoot) {
    filter.$or = [{ parent: null }, { parent: { $exists: false } }];
  }

  if (search) {
    filter.name = { $regex: String(search).trim(), $options: "i" };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .select("name slug description attributes parent level ancestors isActive")
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Category.countDocuments(filter),
  ]);

  return {
    categories,
    total,
    page: Number(page),
    limit: Number(limit),
  };
};


//fetches all categories and converts them into a tree structure (parent → children)
export const getCategoryTreeService = async () => {
  const categories = await Category.find(activeEligibilityFilter())
    .select("name slug description attributes parent level ancestors isActive")
    .sort({ name: 1 })
    .lean();

  //convert flat to tree
  const tree = buildNestedTreeFromFlat(categories);
  return { tree, flat: categories };
};

//Fetch a category and build its full navigation path using ancestors.
export const getCategoryByIdService = async (categoryId) => {
  const category = await Category.findById(categoryId).lean();

  if (!category) {
    throw new AppError("Category not found.", 404);
  }

  //It’s the navigation path like: Home > Electronics > Mobiles > Smartphones
  const breadcrumb = [
    ...(category.ancestors || []).map((a) => ({
      _id: a._id,
      name: a.name,
      slug: a.slug,
    })),
    { _id: category._id, name: category.name, slug: category.slug },
  ];

  return { category, breadcrumb };
};

//Creates a new category with correct parent, slug, and hierarchy (ancestors + level)
export const createCategoryService = async (payload) => {

  //Get parent ID
  //If no parent is provided: it becomes a root category
  const parentId = payload.parent ?? null;

  //f parentId exists: get parent details (only required fields)
  const parent = parentId
    ? await Category.findById(parentId).select("name slug ancestors level isActive").lean()
    : null;

  if (parentId && !parent) {
    throw new AppError("Parent category not found.", 404);
  }

  if (parent && parent.isActive === false) {
    throw new AppError("Cannot create a category under an inactive parent.", 400);
  }

  //Generate or use slug
  const slug = payload.slug?.trim()
    ? payload.slug.trim().toLowerCase()
    : await buildSiblingUniqueCategorySlug(payload.name, parentId || null);

  //Ensure slug is unique
  await assertSiblingSlugUnique(parentId || null, slug);

  // Category object
  const doc = {
    name: payload.name.trim(),
    slug,
    description: payload.description ?? "",
    image: payload.image || { url: "", publicId: "" },
    parent: parentId || null,
    attributes: payload.attributes || [],
    isActive: payload.isActive !== undefined ? payload.isActive : true,
  };

  // Apply hierarchy - This sets: ancestors, level
  applyParentMeta(doc, parent);

  const created = await Category.create(doc);
  return created;
};


//Updates a category and, if needed, updates all its child categories too.
export const updateCategoryService = async (categoryId, payload) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new AppError("Category not found.", 404);
  }

  //Validate reparenting
  if (payload.parent !== undefined) {
    //Prevents: self-parent, circular hierarchy 
    await assertReparentValid(categoryId, payload.parent);
  }

  //Update basic fields
  if (payload.name !== undefined) category.name = payload.name.trim();
  if (payload.description !== undefined) category.description = payload.description ?? "";
  if (payload.image !== undefined) category.image = payload.image;
  if (payload.attributes !== undefined) category.attributes = payload.attributes;
  if (payload.isActive !== undefined) category.isActive = payload.isActive;

  let parentChanged = false;

  if (payload.parent !== undefined) {
    const newParentId = payload.parent;
    const parentLean = newParentId
      ? await Category.findById(newParentId).select("name slug ancestors level isActive").lean()
      : null;

    if (newParentId && !parentLean) {
      throw new AppError("Parent category not found.", 404);
    }

    if (parentLean && parentLean.isActive === false) {
      throw new AppError("Cannot move a category under an inactive parent.", 400);
    }

    // If user is changing parent:This checks:Old parent ≠ New parent ?
    parentChanged =
      String(category.parent || "") !== String(newParentId || "");

    category.parent = newParentId || null;
    applyParentMeta(category, parentLean);
  }

  // Slug handling - Did the user send a slug?
  // If YES → update slug
  if (payload.slug !== undefined) {
    const nextSlug = payload.slug.trim().toLowerCase();
    await assertSiblingSlugUnique(category.parent ?? null, nextSlug, category._id);
    category.slug = nextSlug;
  } else if (payload.name !== undefined && !payload.slug) {
    // Keep existing slug for stable URLs unless slug explicitly sent.
  }

  // Update DB
  await category.save();

  // Do I need to update all child categories?
  // If parent changed, OR slug changed, OR name changed → then update children
  // Because these changes the hierarchy
  const shouldPropagateTree =
    parentChanged ||
    payload.slug !== undefined ||
    payload.name !== undefined;

  if (shouldPropagateTree) {
    // Get updated category
    const fresh = await Category.findById(category._id).lean();
    // Update all children recursively
    await propagateDescendantsMeta(leanSnapshot(fresh));
  }
  // .lean Converts result into: plain JavaScript object, faster, no Mongoose overhead
  // clean object from the database
  return Category.findById(categoryId).lean();
};


// Deletes a category ONLY if it’s safe to delete
export const deleteCategoryService = async (categoryId) => {
  const doc = await Category.findById(categoryId);

  if (!doc) {
    throw new AppError("Category not found.", 404);
  }

  // Check is it have children
  const childCount = await Category.countDocuments({ parent: categoryId });
  // Prevent deletion if it have children
  if (childCount > 0) {
    throw new AppError(
      "This category has sub-categories. Remove or reassign them before deleting.",
      400
    );
  }

  // Check is it have products
  const productCount = await Product.countDocuments({ category: categoryId });

  if (productCount > 0) {
    throw new AppError(
      "This category still has products. Reassign or remove them before deleting.",
      400
    );
  }
  // Finally if everything is ok we can delete that category
  await doc.deleteOne();
  return true;
};
