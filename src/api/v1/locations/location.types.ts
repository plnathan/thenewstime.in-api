export interface Country {
  id: number;

  code: string;

  displayName: string;

  urlName: string;

  isoCode: string | null;
}

export interface State {
  id: number;

  countryId: number;

  code: string;

  displayName: string;

  urlName: string;
}

export interface District {
  id: number;

  stateId: number;

  code: string;

  displayName: string;

  urlName: string;
}
