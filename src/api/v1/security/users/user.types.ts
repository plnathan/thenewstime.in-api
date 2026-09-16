export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";

export interface UserRole {
  id: number;
  code: string;
  displayName: string;
  status: string;
}

export interface User {
  id: number;

  /*
   * Kept for backward compatibility with existing authentication
   * and security code. user_roles is the authoritative RBAC
   * relationship when a user has multiple roles.
   */
  roleId: number | null;

  fullName: string;
  displayName: string;
  username: string;
  email: string | null;
  mobile: string | null;
  profileImageUrl: string | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  mustChangePassword: boolean;
  passwordExpiresAt: Date | null;
  failedLoginCount: number;
  status: UserStatus;

  roles: UserRole[];

  createdBy: number | null;
  createdAt: Date;
  updatedBy: number | null;
  updatedAt: Date;
}

export interface CreateUserInput {
  fullName: string;
  displayName: string;
  username: string;
  email?: string | undefined;
  mobile?: string | undefined;
  password: string;

  roleIds: number[];

  profileImageUrl?: string | undefined;
  mustChangePassword?: boolean | undefined;
  passwordExpiresAt?: string | undefined;
}

export interface UpdateUserInput {
  fullName?: string | undefined;
  displayName?: string | undefined;
  email?: string | undefined;
  mobile?: string | undefined;
  profileImageUrl?: string | undefined;
  status?: UserStatus | undefined;
  mustChangePassword?: boolean | undefined;
  password?: string | undefined;
  passwordExpiresAt?: string | undefined;

  roleIds?: number[] | undefined;
}

export interface UserListItem extends User {}
