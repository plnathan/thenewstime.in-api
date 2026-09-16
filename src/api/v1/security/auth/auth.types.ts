export interface AuthRole {
  id: number;
  code: string;
  displayName: string;
}

export interface AuthPermission {
  id: number;
  code: string;
  displayName: string;
  module: string | null;
  resource: string | null;
  action: string | null;
  displayOrder: number;
}

export interface AuthUser {
  id: number;
  fullName: string;
  displayName: string;
  username: string;
  email: string | null;
  mobile: string | null;
  status: string;
  roles: AuthRole[];
  permissions: AuthPermission[];
}

export interface RegisterInput {
  fullName: string;
  displayName: string;
  username: string;
  password: string;
  email?: string | undefined;
  mobile?: string | undefined;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}
