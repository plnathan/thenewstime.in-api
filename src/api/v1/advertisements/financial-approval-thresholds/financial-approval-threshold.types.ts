export type FinancialApprovalThresholdApprovalType =
  "DISCOUNT" | "REFUND" | "PARTIAL_REFUND" | "ADJUSTMENT" | "CREDIT_EXCEPTION";

export type FinancialApprovalThresholdStatus = "ACTIVE" | "INACTIVE";

export interface FinancialApprovalThreshold {
  id: number;
  approvalType: FinancialApprovalThresholdApprovalType;
  amountThreshold: number | null;
  percentageThreshold: number | null;
  status: FinancialApprovalThresholdStatus;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFinancialApprovalThresholdInput {
  approvalType: FinancialApprovalThresholdApprovalType;
  amountThreshold?: number | undefined;
  percentageThreshold?: number | undefined;
}

export interface UpdateFinancialApprovalThresholdInput {
  approvalType?: FinancialApprovalThresholdApprovalType | undefined;
  amountThreshold?: number | null | undefined;
  percentageThreshold?: number | null | undefined;
}

export interface FinancialApprovalThresholdListFilters {
  approvalType?: FinancialApprovalThresholdApprovalType | undefined;
  status?: FinancialApprovalThresholdStatus | undefined;
}

export interface FinancialApprovalThresholdRow {
  id: string | number;
  approval_type: FinancialApprovalThresholdApprovalType;
  amount_threshold: string | number | null;
  percentage_threshold: string | number | null;
  status: FinancialApprovalThresholdStatus;
  created_by: string | number | null;
  updated_by: string | number | null;
  created_at: Date;
  updated_at: Date;
}
