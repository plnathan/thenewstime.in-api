import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

import * as repository from "./category.repository.js";

export const getCategories = async () => {
  return repository.findAll();
};

export const getCategoryById = async (id: number) => {
  const category = await repository.findById(id);

  if (!category) {
    throw new ApiError(404, "Category not found.");
  }

  return category;
};
