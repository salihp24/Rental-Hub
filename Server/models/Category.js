// Category model: powers the product category tree and category-specific attributes.
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    slug: {
      type: String,
      required: [true, "Category slug is required"],
      lowercase: true,
      trim: true,
      maxlength: [80, "Slug cannot exceed 80 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    // null means it's a root category (top level)
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    // Full path of ancestor IDs from root to this category
    // e.g. [electronicsId, smartphonesId] for "Samsung"
    // This allows us to filter all products under "Electronics"
    // with a single query instead of recursive lookups
    ancestors: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        name: String,
        slug: String,
      },
    ],
    // How deep in the tree (0 = root, 1 = sub, 2 = leaf)
    level: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Custom attributes for this category
    // e.g. Electronics might have "brand", "model", "condition"
    // These appear as filters and product fields for this category
    attributes: [
      {
        name: { type: String, required: true },  // "Brand"
        key: { type: String, required: true },   // "brand"
        type: {
          type: String,
          enum: ["text", "number", "boolean", "select"],
          default: "text",
        },
        options: [String], // for "select" type: ["Samsung", "Apple", "OnePlus"]
        isFilterable: { type: Boolean, default: true },
        isRequired: { type: Boolean, default: false },
      },
    ],
    productCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for fast tree queries
categorySchema.index({ parent: 1 });
categorySchema.index({ "ancestors._id": 1 });
// Slugs are unique among siblings; different branches may reuse the same slug (e.g. "accessories").
categorySchema.index({ parent: 1, slug: 1 }, { unique: true, name: "category_parent_slug_unique" });

const Category = mongoose.model("Category", categorySchema);
export default Category;
