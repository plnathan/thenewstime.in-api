import type { AuthenticatedUser } from "./security.types.ts";

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
    }
  }
}

export {};
