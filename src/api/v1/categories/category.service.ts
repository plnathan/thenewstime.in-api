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

export const createCategory = async (data: {
  code: string;
  displayName: string;
  urlName: string;
}) => {
  try {
    return await repository.createCategory(data);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new ApiError(409, "Category code or URL name already exists.");
    throw error;
  }
};
export const updateCategory = async (
  id: number,
  data: {
    code?: string;
    displayName?: string;
    urlName?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
) => {
  if (data.status === "INACTIVE") {
    const { pool } = await import("../../../shared/config/db.js");
    const references = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM news WHERE category_id=$1",
      [id]
    );
    if (Number(references.rows[0]?.count ?? 0) > 0)
      throw new ApiError(
        409,
        "This category is associated with news and cannot be deactivated."
      );
  }
  try {
    const result = await repository.updateCategory(id, data);
    if (!result) throw new ApiError(404, "Category not found.");
    return result;
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new ApiError(409, "Category code or URL name already exists.");
    throw error;
  }
};
