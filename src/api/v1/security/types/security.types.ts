// src/api/v1/security/types/security.types.ts

import type { AuthRole } from "../auth/auth.types.js";

export interface AuthenticatedUser {
  id: number;
  username: string;
  roles: AuthRole[];
}

export interface PermissionRecord {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  module: string | null;
  resource: string | null;
  action: string | null;
  displayOrder: number;
  isSystemPermission: boolean;
  status: string;
}

export interface UserPermissionResult {
  userId: number;
  roleId: number;
  roleCode: string;
  roleStatus: string;
  permissionId: number;
  permissionCode: string;
  permissionDisplayName: string;
  module: string | null;
  resource: string | null;
  action: string | null;
  permissionStatus: string;
  isSystemPermission: boolean;
}

export interface JwtPayload {
  userId: number;
  username: string;
  roles: AuthRole[];
  iat?: number;
  exp?: number;
}
