import * as repository from "./location.repository.js";

export const getCountries = async () => {
  return repository.findCountries();
};

export const getStates = async (countryId?: number) => {
  return repository.findStates(countryId);
};

export const getDistricts = async (stateId?: number) => {
  return repository.findDistricts(stateId);
};
