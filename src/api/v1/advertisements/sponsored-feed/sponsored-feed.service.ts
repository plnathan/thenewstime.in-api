import * as repository from "./sponsored-feed.repository.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { cardSchema, idSchema } from "./sponsored-feed.validation.js";
export async function getCard(rawId: unknown) {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw new ApiError(400, "Invalid advertisement ID.");
  const card = await repository.readCard(id.data);

  return card;
}
export async function putCard(rawId: unknown, body: unknown, actor: unknown) {
  const id = idSchema.safeParse(rawId);
  const input = cardSchema.safeParse(body);
  if (!id.success) throw new ApiError(400, "Invalid advertisement ID.");
  if (!input.success)
    throw new ApiError(400, "Invalid card content.", input.error.issues);
  if (typeof actor !== "number" || !Number.isSafeInteger(actor) || actor <= 0)
    throw new ApiError(401, "Authentication required.");
  return repository.saveCard(id.data, input.data, actor);
}
export const listBatches = repository.listBatches;
