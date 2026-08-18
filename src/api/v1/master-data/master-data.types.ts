export interface MasterDataItem {
  id: number;
  code: string;
  displayName: string;
  urlName: string;
}

export interface CountryItem extends MasterDataItem {
  isoCode: string | null;
}

export interface StateItem extends MasterDataItem {
  countryId: number;
}

export interface DistrictItem extends MasterDataItem {
  stateId: number;
}
