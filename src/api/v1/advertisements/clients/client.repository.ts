import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementBusinessType,
  AdvertisementClient,
  AdvertisementClientSearchFilters,
  CreateAdvertisementClientInput,
  UpdateAdvertisementClientInput
} from "./client.types.js";

interface AdvertisementClientRow {
  id: number | string;
  client_code: string;
  name: string;
  display_name: string | null;
  business_name: string | null;

  business_type_id: number | string | null;
  business_type_code: string | null;
  business_type_display_name: string | null;
  business_type_description: string | null;
  business_type_display_order: number | null;
  business_type_status: "ACTIVE" | "INACTIVE" | null;

  website: string | null;

  primary_address: string | null;
  communication_address: string | null;

  contact_person: string | null;
  contact_no: string | null;
  alternate_mobile: string | null;

  email: string | null;
  alternate_email: string | null;

  website_url: string | null;

  status: "ACTIVE" | "INACTIVE" | "BLOCKED";

  notes: string | null;

  ad_creation_hold: boolean;
  ad_creation_hold_type: "AUTOMATIC" | "MANUAL" | null;
  ad_creation_hold_reason: string | null;
  ad_creation_hold_remarks: string | null;
  ad_creation_hold_at: Date | null;
  ad_creation_hold_by: number | string | null;

  ad_creation_unhold_at: Date | null;
  ad_creation_unhold_by: number | string | null;
  ad_creation_unhold_reason: string | null;

  created_by: number | string | null;
  updated_by: number | string | null;

  created_at: Date;
  updated_at: Date;
}

const selectColumns = `
  c.id,
  c.client_code,
  c.name,
  c.display_name,
  c.business_name,
  c.business_type_id,

  bt.code AS business_type_code,
  bt.display_name AS business_type_display_name,
  bt.description AS business_type_description,
  bt.display_order AS business_type_display_order,
  bt.status AS business_type_status,

  c.website,

  c.primary_address,
  c.communication_address,

  c.contact_person,
  c.contact_no,
  c.alternate_mobile,

  c.email,
  c.alternate_email,

  c.website_url,

  c.status,

  c.notes,

  c.ad_creation_hold,
  c.ad_creation_hold_type,
  c.ad_creation_hold_reason,
  c.ad_creation_hold_remarks,
  c.ad_creation_hold_at,
  c.ad_creation_hold_by,

  c.ad_creation_unhold_at,
  c.ad_creation_unhold_by,
  c.ad_creation_unhold_reason,

  c.created_by,
  c.updated_by,

  c.created_at,
  c.updated_at
`;

const fromClause = `
  FROM advertisement_clients c
  LEFT JOIN advertisement_business_types bt
    ON bt.id = c.business_type_id
`;

function mapBusinessType(
  row: AdvertisementClientRow
): AdvertisementBusinessType | null {
  if (
    row.business_type_id === null ||
    row.business_type_code === null ||
    row.business_type_display_name === null ||
    row.business_type_status === null
  ) {
    return null;
  }

  return {
    id: Number(row.business_type_id),
    code: row.business_type_code,
    displayName: row.business_type_display_name,
    description: row.business_type_description,
    displayOrder: Number(row.business_type_display_order ?? 0),
    status: row.business_type_status
  };
}

function mapClient(row: AdvertisementClientRow): AdvertisementClient {
  return {
    id: Number(row.id),
    clientCode: row.client_code,
    name: row.name,
    displayName: row.display_name,
    businessName: row.business_name,

    businessTypeId:
      row.business_type_id === null ? null : Number(row.business_type_id),

    businessType: mapBusinessType(row),

    website: row.website,

    primaryAddress: row.primary_address,
    communicationAddress: row.communication_address,

    contactPerson: row.contact_person,
    contactNo: row.contact_no,
    alternateMobile: row.alternate_mobile,

    email: row.email,
    alternateEmail: row.alternate_email,

    websiteUrl: row.website_url,

    status: row.status,

    notes: row.notes,

    adCreationHold: row.ad_creation_hold,
    adCreationHoldType: row.ad_creation_hold_type,
    adCreationHoldReason: row.ad_creation_hold_reason,
    adCreationHoldRemarks: row.ad_creation_hold_remarks,
    adCreationHoldAt: row.ad_creation_hold_at,
    adCreationHoldBy:
      row.ad_creation_hold_by === null ? null : Number(row.ad_creation_hold_by),

    adCreationUnholdAt: row.ad_creation_unhold_at,
    adCreationUnholdBy:
      row.ad_creation_unhold_by === null
        ? null
        : Number(row.ad_creation_unhold_by),
    adCreationUnholdReason: row.ad_creation_unhold_reason,

    createdBy: row.created_by === null ? null : Number(row.created_by),

    updatedBy: row.updated_by === null ? null : Number(row.updated_by),

    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementClient | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementClientRow>(
    `
      SELECT ${selectColumns}
      ${fromClause}
      WHERE c.id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row ? mapClient(row) : null;
};

export const findByClientCode = async (
  clientCode: string,
  client?: PoolClient
): Promise<AdvertisementClient | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementClientRow>(
    `
      SELECT ${selectColumns}
      ${fromClause}
      WHERE LOWER(c.client_code) = LOWER($1)
      LIMIT 1
    `,
    [clientCode]
  );

  const row = result.rows[0];

  return row ? mapClient(row) : null;
};

export const businessTypeExists = async (
  id: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM advertisement_business_types
        WHERE id = $1
          AND status = 'ACTIVE'
      ) AS exists
    `,
    [id]
  );

  return Boolean(result.rows[0]?.exists);
};

export const create = async (
  input: CreateAdvertisementClientInput,
  createdBy: number,
  client?: PoolClient
): Promise<AdvertisementClient> => {
  const db = client ?? pool;

  const result = await db.query<{ id: number | string }>(
    `
      INSERT INTO advertisement_clients
      (
        client_code,
        name,
        display_name,
        business_name,
        business_type_id,
        website,
        primary_address,
        communication_address,
        contact_person,
        contact_no,
        alternate_mobile,
        email,
        alternate_email,
        website_url,
        status,
        notes,
        ad_creation_hold,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        FALSE,
        $17,
        $17
      )
      RETURNING id
    `,
    [
      input.clientCode.trim(),
      input.name.trim(),
      input.displayName?.trim() || null,
      input.businessName?.trim() || null,
      input.businessTypeId ?? null,
      input.website?.trim() || null,
      input.primaryAddress?.trim() || null,
      input.communicationAddress?.trim() || null,
      input.contactPerson?.trim() || null,
      input.contactNo?.trim() || null,
      input.alternateMobile?.trim() || null,
      input.email?.trim() || null,
      input.alternateEmail?.trim() || null,
      input.websiteUrl?.trim() || null,
      input.status ?? "ACTIVE",
      input.notes?.trim() || null,
      createdBy
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error(
      "Advertisement client was created but its ID was not returned."
    );
  }

  const created = await findById(Number(row.id), client);

  if (!created) {
    throw new Error(
      "Advertisement client was created but could not be loaded."
    );
  }

  return created;
};

export const update = async (
  id: number,
  input: UpdateAdvertisementClientInput,
  updatedBy: number,
  client?: PoolClient
): Promise<AdvertisementClient | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) {
    addField("name", input.name.trim());
  }

  if (input.displayName !== undefined) {
    addField("display_name", input.displayName.trim() || null);
  }

  if (input.businessName !== undefined) {
    addField("business_name", input.businessName.trim() || null);
  }

  if (input.businessTypeId !== undefined) {
    addField("business_type_id", input.businessTypeId);
  }

  if (input.website !== undefined) {
    addField("website", input.website.trim() || null);
  }

  if (input.primaryAddress !== undefined) {
    addField("primary_address", input.primaryAddress.trim() || null);
  }

  if (input.communicationAddress !== undefined) {
    addField(
      "communication_address",
      input.communicationAddress.trim() || null
    );
  }

  if (input.contactPerson !== undefined) {
    addField("contact_person", input.contactPerson.trim() || null);
  }

  if (input.contactNo !== undefined) {
    addField("contact_no", input.contactNo.trim() || null);
  }

  if (input.alternateMobile !== undefined) {
    addField("alternate_mobile", input.alternateMobile.trim() || null);
  }

  if (input.email !== undefined) {
    addField("email", input.email.trim() || null);
  }

  if (input.alternateEmail !== undefined) {
    addField("alternate_email", input.alternateEmail.trim() || null);
  }

  if (input.websiteUrl !== undefined) {
    addField("website_url", input.websiteUrl.trim() || null);
  }

  if (input.status !== undefined) {
    addField("status", input.status);
  }

  if (input.notes !== undefined) {
    addField("notes", input.notes.trim() || null);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(updatedBy);
  const updatedByIndex = values.length;

  values.push(id);
  const idIndex = values.length;

  const result = await db.query<{ id: number | string }>(
    `
      UPDATE advertisement_clients
      SET
        ${fields.join(",\n        ")},
        updated_by = $${updatedByIndex},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idIndex}
      RETURNING id
    `,
    values
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return findById(Number(row.id), client);
};

export const list = async (
  filters: AdvertisementClientSearchFilters,
  client?: PoolClient
): Promise<{
  items: AdvertisementClient[];
  total: number;
}> => {
  const db = client ?? pool;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(filters.search);

    const searchIndex = values.length;

    conditions.push(`
      (
        c.client_code ILIKE '%' || $${searchIndex} || '%'
        OR c.name ILIKE '%' || $${searchIndex} || '%'
        OR c.display_name ILIKE '%' || $${searchIndex} || '%'
        OR c.business_name ILIKE '%' || $${searchIndex} || '%'
        OR c.contact_person ILIKE '%' || $${searchIndex} || '%'
        OR c.email ILIKE '%' || $${searchIndex} || '%'
        OR c.contact_no ILIKE '%' || $${searchIndex} || '%'
      )
    `);
  }

  if (filters.status !== undefined) {
    values.push(filters.status);

    conditions.push(`c.status = $${values.length}`);
  }

  if (filters.businessTypeId !== undefined) {
    values.push(filters.businessTypeId);

    conditions.push(`c.business_type_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      ${fromClause}
      ${whereClause}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;

  const dataValues = [...values];

  dataValues.push(filters.pageSize);
  const limitIndex = dataValues.length;

  dataValues.push(offset);
  const offsetIndex = dataValues.length;

  const result = await db.query<AdvertisementClientRow>(
    `
      SELECT ${selectColumns}
      ${fromClause}
      ${whereClause}
      ORDER BY
        c.name ASC,
        c.id ASC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    dataValues
  );

  return {
    items: result.rows.map(mapClient),
    total
  };
};
