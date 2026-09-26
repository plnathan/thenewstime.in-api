import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./client.repository.js";

import type {
  AdvertisementClient,
  AdvertisementClientSearchFilters,
  CreateAdvertisementClientInput,
  UpdateAdvertisementClientInput
} from "./client.types.js";

export const createClient = async (
  input: CreateAdvertisementClientInput,
  createdBy: number
): Promise<AdvertisementClient> => {
  const clientCode = input.clientCode.trim();

  if (!clientCode) {
    throw new ApiError(400, "Client code is required.");
  }

  const name = input.name.trim();

  if (!name) {
    throw new ApiError(400, "Client name is required.");
  }

  const existing = await repository.findByClientCode(clientCode);

  if (existing) {
    throw new ApiError(409, "Advertisement client code already exists.");
  }

  if (input.businessTypeId !== undefined) {
    const exists = await repository.businessTypeExists(input.businessTypeId);

    if (!exists) {
      throw new ApiError(404, "Advertisement business type not found.");
    }
  }

  return repository.create(
    {
      ...input,
      clientCode,
      name
    },
    createdBy
  );
};

export const getClientById = async (
  id: number
): Promise<AdvertisementClient> => {
  const client = await repository.findById(id);

  if (!client) {
    throw new ApiError(404, "Advertisement client not found.");
  }

  return client;
};

export const getClients = async (
  filters: AdvertisementClientSearchFilters
): Promise<{
  items: AdvertisementClient[];
  total: number;
}> => {
  return repository.list(filters);
};

export const updateClient = async (
  id: number,
  input: UpdateAdvertisementClientInput,
  updatedBy: number
): Promise<AdvertisementClient> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement client not found.");
  }

  if (input.businessTypeId !== undefined) {
    const exists = await repository.businessTypeExists(input.businessTypeId);

    if (!exists) {
      throw new ApiError(404, "Advertisement business type not found.");
    }
  }

  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new ApiError(400, "Client name cannot be empty.");
  }

  const updated = await repository.update(id, input, updatedBy);

  if (!updated) {
    throw new ApiError(404, "Advertisement client not found.");
  }

  return updated;
};
