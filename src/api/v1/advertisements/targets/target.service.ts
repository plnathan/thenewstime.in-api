import { pool } from "../../../../shared/config/db.js";

import * as targetRepository from "./target.repository.js";

import type {
  AdvertisementTarget,
  CreateAdvertisementTargetInput,
  UpdateAdvertisementTargetInput
} from "./target.types.js";

export class AdvertisementTargetServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AdvertisementTargetServiceError";
    this.statusCode = statusCode;
  }
}

async function assertAdvertisementExists(
  advertisementId: number
): Promise<void> {
  const result = await pool.query<{ id: string | number }>(
    `
      SELECT id
      FROM advertisements
      WHERE id = $1
      LIMIT 1
    `,
    [advertisementId]
  );

  if (result.rows[0] === undefined) {
    throw new AdvertisementTargetServiceError("Advertisement not found.", 404);
  }
}

async function assertTargetBelongsToAdvertisement(
  advertisementId: number,
  targetId: number
): Promise<AdvertisementTarget> {
  const target = await targetRepository.findById(targetId);

  if (!target || target.advertisementId !== advertisementId) {
    throw new AdvertisementTargetServiceError(
      "Targeting rule not found for this advertisement.",
      404
    );
  }

  return target;
}

export async function listTargets(
  advertisementId: number
): Promise<AdvertisementTarget[]> {
  await assertAdvertisementExists(advertisementId);

  return targetRepository.findByAdvertisementId(advertisementId);
}

export async function addTarget(
  advertisementId: number,
  input: CreateAdvertisementTargetInput
): Promise<AdvertisementTarget> {
  await assertAdvertisementExists(advertisementId);

  return targetRepository.create({
    advertisementId,
    targetType: input.targetType,
    targetValue: input.targetValue,
    isInclude: input.isInclude ?? true
  });
}

export async function editTarget(
  advertisementId: number,
  targetId: number,
  input: UpdateAdvertisementTargetInput
): Promise<AdvertisementTarget> {
  await assertTargetBelongsToAdvertisement(advertisementId, targetId);

  const updated = await targetRepository.update(targetId, input);

  if (!updated) {
    throw new AdvertisementTargetServiceError(
      "Targeting rule could not be updated.",
      404
    );
  }

  return updated;
}

export async function removeTarget(
  advertisementId: number,
  targetId: number
): Promise<void> {
  await assertTargetBelongsToAdvertisement(advertisementId, targetId);

  const deleted = await targetRepository.deleteById(targetId);

  if (!deleted) {
    throw new AdvertisementTargetServiceError(
      "Targeting rule could not be deleted.",
      404
    );
  }
}

export async function replaceTargets(
  advertisementId: number,
  targets: CreateAdvertisementTargetInput[]
): Promise<AdvertisementTarget[]> {
  await assertAdvertisementExists(advertisementId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const advertisementResult = await client.query<{ id: string | number }>(
      `
        SELECT id
        FROM advertisements
        WHERE id = $1
        FOR UPDATE
      `,
      [advertisementId]
    );

    if (advertisementResult.rows[0] === undefined) {
      throw new AdvertisementTargetServiceError(
        "Advertisement not found.",
        404
      );
    }

    await targetRepository.deleteByAdvertisementId(advertisementId, client);

    const savedTargets: AdvertisementTarget[] = [];

    for (const target of targets) {
      const saved = await targetRepository.create(
        {
          advertisementId,
          targetType: target.targetType,
          targetValue: target.targetValue,
          isInclude: target.isInclude ?? true
        },
        client
      );

      savedTargets.push(saved);
    }

    await client.query("COMMIT");

    return savedTargets;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
