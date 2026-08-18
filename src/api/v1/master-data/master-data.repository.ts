import { pool } from "../../../shared/config/db.js";

import type {
  CountryItem,
  DistrictItem,
  MasterDataItem,
  StateItem
} from "./master-data.types.js";

export const findCategories = async (): Promise<MasterDataItem[]> => {
  const result = await pool.query<MasterDataItem>(
    `
        SELECT
          id,
          code,
          display_name AS "displayName",
          url_name AS "urlName"
        FROM categories
        WHERE status = 'ACTIVE'
        ORDER BY display_order ASC, display_name ASC
      `
  );

  return result.rows;
};

export const findCountries = async (): Promise<CountryItem[]> => {
  const result = await pool.query<CountryItem>(
    `
        SELECT
          id,
          code,
          display_name AS "displayName",
          url_name AS "urlName",
          iso_code AS "isoCode"
        FROM countries
        WHERE status = 'ACTIVE'
        ORDER BY display_order ASC, display_name ASC
      `
  );

  return result.rows;
};

export const findStates = async (countryId: number): Promise<StateItem[]> => {
  const result = await pool.query<StateItem>(
    `
      SELECT
        id,
        country_id AS "countryId",
        code,
        display_name AS "displayName",
        url_name AS "urlName"
      FROM states
      WHERE country_id = $1
        AND status = 'ACTIVE'
      ORDER BY display_order ASC, display_name ASC
    `,
    [countryId]
  );

  return result.rows;
};

export const findDistricts = async (
  stateId: number
): Promise<DistrictItem[]> => {
  const result = await pool.query<DistrictItem>(
    `
          SELECT
            id,
            state_id AS "stateId",
            code,
            display_name AS "displayName",
            url_name AS "urlName"
          FROM districts
          WHERE state_id = $1
            AND status = 'ACTIVE'
          ORDER BY display_order ASC, display_name ASC
        `,
    [stateId]
  );

  return result.rows;
};
