// how to run : node src/scripts/check-database.cjs

require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    const result = await pool.query(`
            SELECT
                current_database() AS database_name,
                current_schema() AS schema_name,
                current_user AS connected_user,
                inet_server_addr() AS server_address,
                to_regclass('public.advertisement_placements')
                    AS placements_table
        `);

    console.table(result.rows);

    const constraints = await pool.query(`
            SELECT
                c.conname,
                pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            JOIN pg_class t
                ON t.oid = c.conrelid
            WHERE t.relname = 'advertisement_placements'
              AND c.conname = 'chk_advertisement_placements_type'
        `);

    console.table(constraints.rows);
  } catch (error) {
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

main();
