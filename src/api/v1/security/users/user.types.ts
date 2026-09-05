export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";

export interface User {
  id: number;
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
  roleId: number;
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
}

export interface UserListItem extends User {
  roleCode: string | null;
  roleDisplayName: string | null;
}
