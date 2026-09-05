export interface Role {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  displayOrder: number;
  status: string;
  createdBy: number | null;
  createdAt: Date;
  updatedBy: number | null;
  updatedAt: Date;
}

export interface CreateRoleInput {
  code: string;
  displayName: string;
  description?: string | undefined;
  displayOrder?: number | undefined;
}

export interface UpdateRoleInput {
  displayName?: string | undefined;
  description?: string | undefined;
  displayOrder?: number | undefined;
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | undefined;
}

export interface AssignRoleInput {
  userId: number;
}
