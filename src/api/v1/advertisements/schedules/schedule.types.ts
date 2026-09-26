export type AdvertisementScheduleStatus =
  "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export type AdvertisementScheduleLifecycleAction =
  "ACTIVATE" | "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL";

export interface AdvertisementSchedule {
  id: number;
  advertisementId: number;
  placementId: number;
  placementRuleId: number | null;
  startAt: Date;
  endAt: Date;
  status: AdvertisementScheduleStatus;
  priority: number;
  rescheduledFromId: number | null;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduleInput {
  advertisementId: number;
  placementId: number;
  placementRuleId?: number | null;
  startAt: Date;
  endAt: Date;
  status?: AdvertisementScheduleStatus;
  priority?: number;
  rescheduledFromId?: number | null;
  notes?: string | null;
}

export interface UpdateScheduleInput {
  placementRuleId?: number | null;
  startAt?: Date;
  endAt?: Date;
  status?: AdvertisementScheduleStatus;
  priority?: number;
  rescheduledFromId?: number | null;
  notes?: string | null;
}

export interface ScheduleQuery {
  advertisementId?: number;
  placementId?: number;
  placementRuleId?: number;
  status?: AdvertisementScheduleStatus;
}

export interface ScheduleLifecycleInput {
  action: AdvertisementScheduleLifecycleAction;
}
