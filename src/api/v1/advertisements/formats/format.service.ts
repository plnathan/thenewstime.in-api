import { formatInputSchema, formatIdSchema } from "./format.validation.js";

import * as repository from "./format.configuration.js";

import type { FormatInput } from "./format.configuration.js";

type FormatLifecycleStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

function error(status: number, message: string): Error {
  return Object.assign(new Error(message), {
    status,
    statusCode: status
  });
}

function parseId(value: unknown): number {
  return formatIdSchema.parse({
    id: value
  }).id;
}

function parseInput(value: unknown): FormatInput {
  const parsed = formatInputSchema.parse(value);

  return {
    code: parsed.code,
    displayName: parsed.displayName,
    description: parsed.description ?? null,
    widthPx: parsed.widthPx ?? null,
    heightPx: parsed.heightPx ?? null,
    mobileWidthPx: parsed.mobileWidthPx ?? null,
    mobileHeightPx: parsed.mobileHeightPx ?? null,
    isResponsive: parsed.isResponsive,
    displayOrder: parsed.displayOrder
  };
}

export const listFormats = () => repository.listFormats();

export async function getFormat(value: unknown) {
  const id = parseId(value);

  const item = await repository.getFormat(id);

  if (!item) {
    throw error(404, "Format not found.");
  }

  return item;
}

export async function createFormat(body: unknown, actor: number) {
  const input = parseInput(body);

  try {
    return await repository.createFormat(input, actor);
  } catch (cause) {
    if ((cause as { code?: string }).code === "23505") {
      throw error(409, "Format code already exists.");
    }

    throw cause;
  }
}

/**
 * Edit system and custom formats.
 *
 * Rules:
 * - System formats can be edited.
 * - Custom formats can be edited.
 * - Archived formats cannot be edited.
 * - Formats assigned to placements remain protected
 *   against configuration changes.
 * - Format code remains immutable.
 */
export async function updateFormat(
  value: unknown,
  body: unknown,
  actor: number
) {
  const id = parseId(value);

  const current = await getFormat(id);

  if (current.status === "ARCHIVED") {
    throw error(409, "Archived formats cannot be edited.");
  }

  if (await repository.isFormatUsed(id)) {
    throw error(
      409,
      "Format is assigned to a placement; editing is restricted."
    );
  }

  const input = parseInput({
    ...(body as Record<string, unknown>),
    code: current.code
  });

  return repository.updateFormat(id, input, actor);
}

/**
 * Shared status transition.
 *
 * System formats may be activated/deactivated.
 * Archiving is handled separately.
 */
async function changeStatus(
  value: unknown,
  status: "ACTIVE" | "INACTIVE",
  actor: number
) {
  const id = parseId(value);

  const current = await getFormat(id);

  if (current.status === "ARCHIVED") {
    throw error(409, "Archived formats cannot be reactivated or deactivated.");
  }

  if (current.status === status) {
    return current;
  }

  if (status === "INACTIVE" && (await repository.isFormatUsed(id))) {
    throw error(
      409,
      "Format is assigned to a placement and cannot be deactivated."
    );
  }

  return repository.setFormatStatus(id, status, actor);
}

export async function activateFormat(value: unknown, actor: number) {
  return changeStatus(value, "ACTIVE", actor);
}

export async function deactivateFormat(value: unknown, actor: number) {
  return changeStatus(value, "INACTIVE", actor);
}

/**
 * Archive format.
 *
 * System formats cannot be archived.
 * Referenced formats cannot be archived.
 * Archived formats cannot be modified.
 */
export async function archiveFormat(value: unknown, actor: number) {
  const id = parseId(value);

  const current = await getFormat(id);

  if (current.status === "ARCHIVED") {
    throw error(409, "Format is already archived.");
  }

  if (current.isSystemFormat) {
    throw error(409, "System formats cannot be archived.");
  }

  if (await repository.isFormatUsed(id)) {
    throw error(
      409,
      "Format is assigned to a placement and cannot be archived."
    );
  }

  const nextStatus: FormatLifecycleStatus = "ARCHIVED";

  return repository.setFormatStatus(id, nextStatus, actor);
}
