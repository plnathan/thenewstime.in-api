export type PlacementRuleInsertionType =
  "FIXED" | "AFTER_N_ITEMS" | "BETWEEN_SECTIONS";

export type PlacementRuleStatus = "ACTIVE" | "INACTIVE";

export interface AdvertisementPlacementRule {
  id: number;
  advertisementId: number;
  placementId: number;
  displayOrder: number;
  insertionType: PlacementRuleInsertionType | null;
  insertionPosition: number | null;
  maxImpressions: number | null;
  status: PlacementRuleStatus;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlacementRuleInput {
  advertisementId: number;
  placementId: number;
  displayOrder?: number;
  insertionType?: PlacementRuleInsertionType | null;
  insertionPosition?: number | null;
  maxImpressions?: number | null;
  status?: PlacementRuleStatus;
}

export interface UpdatePlacementRuleInput {
  displayOrder?: number;
  insertionType?: PlacementRuleInsertionType | null;
  insertionPosition?: number | null;
  maxImpressions?: number | null;
  status?: PlacementRuleStatus;
}

export interface PlacementRuleQuery {
  advertisementId?: number;
  placementId?: number;
  status?: PlacementRuleStatus;
}
