import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import { pool } from "../../../../shared/config/db.js";

import { userHasPermission } from "../permissions/permission.repository.js";

export const authorize = (module: string, resource: string, action: string) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(401, "Authentication required.");
      }

      /*
       * SUPER_ADMIN has unrestricted access.
       *
       * We check the database rather than putting roles
       * inside the JWT, so current role status is respected.
       */
      const superAdminResult = await pool.query(
        `
          SELECT EXISTS
          (
            SELECT 1
            FROM user_roles ur
            INNER JOIN roles r
              ON r.id = ur.role_id
            WHERE ur.user_id = $1
              AND r.code = 'SUPER_ADMIN'
              AND r.status = 'ACTIVE'
          ) AS is_super_admin
        `,
        [req.user.id]
      );

      if (superAdminResult.rows[0]?.is_super_admin === true) {
        next();
        return;
      }

      const allowed = await userHasPermission(
        req.user.id,
        module,
        resource,
        action
      );

      if (!allowed) {
        throw new ApiError(
          403,
          "You do not have permission to perform this action."
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
