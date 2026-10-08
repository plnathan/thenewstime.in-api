export type AdvertisementRotationMode = "TIME_BASED";

export type AdvertisementRotationStrategy = "ROUND_ROBIN";

export type AdvertisementRotationMemberStatus = "ACTIVE" | "INACTIVE";

export interface AdvertisementRotationConfig {
  placementId: number;
  rotationEnabled: boolean;
  rotationMode: AdvertisementRotationMode;
  rotationIntervalSeconds: number;
  rotationStrategy: AdvertisementRotationStrategy;
}

export interface AdvertisementRotationMember {
  id: number;
  placementId: number;
  advertisementId: number;
  advertisementName: string | null;
  advertisementStatus: string | null;
  advertisementWorkflowStatus: string | null;
  priority: number;
  status: AdvertisementRotationMemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAdvertisementRotationConfigInput {
  rotationEnabled?: boolean | undefined;
  rotationMode?: AdvertisementRotationMode | undefined;
  rotationIntervalSeconds?: number | undefined;
  rotationStrategy?: AdvertisementRotationStrategy | undefined;
}

export interface CreateAdvertisementRotationMemberInput {
  advertisementId: number;
  priority?: number | undefined;
  status?: AdvertisementRotationMemberStatus | undefined;
}

export interface UpdateAdvertisementRotationMemberInput {
  priority?: number | undefined;
  status?: AdvertisementRotationMemberStatus | undefined;
}

export interface AdvertisementRotationMemberList {
  placementId: number;
  members: AdvertisementRotationMember[];
}
