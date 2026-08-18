import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

import * as repository from "./master-data.repository.js";

export const getCategories = async () => {
  return repository.findCategories();
};

export const getCountries = async () => {
  return repository.findCountries();
};

export const getStates = async (countryId: number) => {
  if (!Number.isInteger(countryId) || countryId <= 0) {
    throw new ApiError(400, "Valid countryId is required.");
  }

  return repository.findStates(countryId);
};

export const getDistricts = async (stateId: number) => {
  if (!Number.isInteger(stateId) || stateId <= 0) {
    throw new ApiError(400, "Valid stateId is required.");
  }

  return repository.findDistricts(stateId);
};
