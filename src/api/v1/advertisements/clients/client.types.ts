export type AdvertisementClientStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type AdvertisementHoldType = "AUTOMATIC" | "MANUAL";

export interface AdvertisementBusinessType {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface AdvertisementClient {
  id: number;
  clientCode: string;
  name: string;
  displayName: string | null;
  businessName: string | null;

  businessTypeId: number | null;
  businessType: AdvertisementBusinessType | null;

  website: string | null;

  primaryAddress: string | null;
  communicationAddress: string | null;

  contactPerson: string | null;
  contactNo: string | null;
  alternateMobile: string | null;

  email: string | null;
  alternateEmail: string | null;

  websiteUrl: string | null;

  status: AdvertisementClientStatus;

  notes: string | null;

  adCreationHold: boolean;
  adCreationHoldType: AdvertisementHoldType | null;
  adCreationHoldReason: string | null;
  adCreationHoldRemarks: string | null;
  adCreationHoldAt: Date | null;
  adCreationHoldBy: number | null;

  adCreationUnholdAt: Date | null;
  adCreationUnholdBy: number | null;
  adCreationUnholdReason: string | null;

  createdBy: number | null;
  updatedBy: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdvertisementClientInput {
  clientCode: string;
  name: string;

  displayName?: string | undefined;
  businessName?: string | undefined;

  businessTypeId?: number | undefined;

  website?: string | undefined;

  primaryAddress?: string | undefined;
  communicationAddress?: string | undefined;

  contactPerson?: string | undefined;
  contactNo?: string | undefined;
  alternateMobile?: string | undefined;

  email?: string | undefined;
  alternateEmail?: string | undefined;

  websiteUrl?: string | undefined;

  status?: AdvertisementClientStatus | undefined;

  notes?: string | undefined;
}

export interface UpdateAdvertisementClientInput {
  name?: string | undefined;

  displayName?: string | undefined;
  businessName?: string | undefined;

  businessTypeId?: number | undefined;

  website?: string | undefined;

  primaryAddress?: string | undefined;
  communicationAddress?: string | undefined;

  contactPerson?: string | undefined;
  contactNo?: string | undefined;
  alternateMobile?: string | undefined;

  email?: string | undefined;
  alternateEmail?: string | undefined;

  websiteUrl?: string | undefined;

  status?: AdvertisementClientStatus | undefined;

  notes?: string | undefined;
}

export interface AdvertisementClientSearchFilters {
  page: number;
  pageSize: number;
  search?: string | undefined;
  status?: AdvertisementClientStatus | undefined;
  businessTypeId?: number | undefined;
}

export interface PaginatedAdvertisementClients {
  items: AdvertisementClient[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
