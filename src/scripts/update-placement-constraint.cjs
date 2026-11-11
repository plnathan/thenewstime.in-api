const path = require("node:path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000
});

const placementTypes = [
  // HOME
  "HOME_TOP",
  "HOME_BANNER",
  "HOME_BETWEEN_SECTIONS",
  "HOME_SIDEBAR",
  "HOME_BOTTOM",
  "HOME_MODAL",

  // NEWS LIST
  "NEWS_LIST_TOP",
  "NEWS_LIST_BANNER",
  "NEWS_LIST_BETWEEN",
  "NEWS_LIST_SIDEBAR",
  "NEWS_LIST_BOTTOM",
  "NEWS_LIST_MODAL",

  // NEWS DETAIL
  "NEWS_DETAIL_TOP",
  "NEWS_DETAIL_BANNER",
  "NEWS_DETAIL_BETWEEN",
  "NEWS_DETAIL_SIDEBAR",
  "NEWS_DETAIL_BOTTOM",
  "NEWS_DETAIL_MODAL"
];

async function main() {
  const client = await pool.connect();

  try {
    console.log("Connected to PostgreSQL.");

    const database = await client.query(`
            SELECT
                current_database() AS database_name,
                current_schema() AS schema_name,
                to_regclass('public.advertisement_placements')
                    AS placements_table
        `);

    console.table(database.rows);

    if (!database.rows[0]?.placements_table) {
      throw new Error(
        "advertisement_placements table not found. Migration cancelled."
      );
    }

    const existingConstraint = await client.query(`
            SELECT pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            WHERE c.conrelid =
                'public.advertisement_placements'::regclass
              AND c.conname = 'chk_advertisement_placements_type'
        `);

    if (existingConstraint.rows.length !== 1) {
      throw new Error(
        "Expected placement type constraint not found. Migration cancelled."
      );
    }

    console.log("Existing constraint:");
    console.log(existingConstraint.rows[0].definition);

    const values = placementTypes.map((value) => `'${value}'`).join(", ");

    await client.query("BEGIN");

    await client.query(`
            ALTER TABLE public.advertisement_placements
            DROP CONSTRAINT chk_advertisement_placements_type
        `);

    await client.query(`
            ALTER TABLE public.advertisement_placements
            ADD CONSTRAINT chk_advertisement_placements_type
            CHECK (placement_type IN (${values}))
        `);

    await client.query("COMMIT");

    console.log("Placement constraint updated successfully.");

    const verification = await client.query(`
            SELECT pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            WHERE c.conrelid =
                'public.advertisement_placements'::regclass
              AND c.conname = 'chk_advertisement_placements_type'
        `);

    console.log("Updated constraint:");
    console.log(verification.rows[0]?.definition);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
