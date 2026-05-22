import asyncHandler from "../utils/asyncHandler.js";
import {
  listCategoriesService,
  getCategoryTreeService,
  getCategoryByIdService,
  createCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "../Services/category.services.js";

export const listCategories = asyncHandler(async (req, res) => {
  const result = await listCategoriesService(req.query, req.user || null);

  res.status(200).json({
    status: "success",
    results: result.categories.length,
    pagination: {
      total: result.total,
      page: result.page,
      pages: Math.ceil(result.total / result.limit) || 1,
      limit: result.limit,
    },
    data: { categories: result.categories },
  });
});

export const getCategoryTree = asyncHandler(async (req, res) => {
  const { tree, flat } = await getCategoryTreeService();

  res.status(200).json({
    status: "success",
    results: flat.length,
    data: { tree, flat },
  });
});

export const getCategory = asyncHandler(async (req, res) => {
  const { category, breadcrumb } = await getCategoryByIdService(req.params.categoryId);

  res.status(200).json({
    status: "success",
    data: { category, breadcrumb },
  });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await createCategoryService(req.body);

  res.status(201).json({
    status: "success",
    data: { category },
  });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await updateCategoryService(req.params.categoryId, req.body);

  res.status(200).json({
    status: "success",
    data: { category },
  });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await deleteCategoryService(req.params.categoryId);

  res.status(200).json({
    status: "success",
    message: "Category deleted successfully.",
  });
});
