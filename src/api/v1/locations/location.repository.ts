import type { PoolClient } from "pg";

import { pool } from "../../../shared/config/db.js";

import type { Country, District, State } from "./location.types.js";

export const findCountries = async (
  client?: PoolClient
): Promise<Country[]> => {
  const db = client ?? pool;

  const result = await db.query<Country>(`
    SELECT
      id,
      code,
      display_name AS "displayName",
      url_name AS "urlName",
      iso_code AS "isoCode"
    FROM countries
    ORDER BY display_name ASC, id ASC;
  `);

  return result.rows;
};

export const findStates = async (
  countryId?: number,
  client?: PoolClient
): Promise<State[]> => {
  const db = client ?? pool;

  const result = await db.query<State>(
    `
      SELECT
        id,
        country_id AS "countryId",
        code,
        display_name AS "displayName",
        url_name AS "urlName"
      FROM states
      ${countryId !== undefined ? "WHERE country_id = $1" : ""}
      ORDER BY display_name ASC, id ASC;
    `,
    countryId !== undefined ? [countryId] : []
  );

  return result.rows;
};

export const findDistricts = async (
  stateId?: number,
  client?: PoolClient
): Promise<District[]> => {
  const db = client ?? pool;

  const result = await db.query<District>(
    `
      SELECT
        id,
        state_id AS "stateId",
        code,
        display_name AS "displayName",
        url_name AS "urlName"
      FROM districts
      ${stateId !== undefined ? "WHERE state_id = $1" : ""}
      ORDER BY display_name ASC, id ASC;
    `,
    stateId !== undefined ? [stateId] : []
  );

  return result.rows;
};
