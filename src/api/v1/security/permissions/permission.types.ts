export interface Permission {
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
  createdBy: number | null;
  createdAt: Date;
  updatedBy: number | null;
  updatedAt: Date;
}

export interface CreatePermissionInput {
  code: string;
  displayName: string;
  description?: string | undefined;
  module?: string | undefined;
  resource?: string | undefined;
  action?: string | undefined;
  displayOrder?: number | undefined;
  isSystemPermission?: boolean | undefined;
}

export interface UpdatePermissionInput {
  displayName?: string | undefined;
  description?: string | undefined;
  module?: string | undefined;
  resource?: string | undefined;
  action?: string | undefined;
  displayOrder?: number | undefined;
  status?: "ACTIVE" | "INACTIVE" | undefined;
}

export interface AssignPermissionInput {
  permissionId: number;
}
