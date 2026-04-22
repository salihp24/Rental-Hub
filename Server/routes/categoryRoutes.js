import express from "express";

import protect from "../middleware/auth.js";
import restrictTo from "../middleware/authorize.js";
import validate from "../middleware/validate.js";
import { categoryValidation } from "../validation/index.js";
import {
  listCategories,
  getCategoryTree,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

// Static paths must be registered before `/:categoryId` so "tree" is not parsed as an id.

//Returns hierarchical categories (parent → child)
router.get("/tree", validate(categoryValidation.treeQuery), getCategoryTree);

router.get("/", validate(categoryValidation.listQuery), listCategories);

router.post(
  "/",
  protect,
  restrictTo("admin"),
  validate(categoryValidation.create),
  createCategory
);

router.get("/:categoryId", validate(categoryValidation.params), getCategory);

router.patch(
  "/:categoryId",
  protect,
  restrictTo("admin"),
  validate({ ...categoryValidation.params, ...categoryValidation.update }),
  updateCategory
);

router.delete(
  "/:categoryId",
  protect,
  restrictTo("admin"),
  //Merging params validation (ID), body validation (update data)
  validate(categoryValidation.params),
  deleteCategory
);

export default router;
