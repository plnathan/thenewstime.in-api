// To run in terminal, use the below command
// npx tsx src/scripts/check-database-connection.ts

import { pool } from "../shared/config/db.js";

const main = async (): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        current_schema() AS schema_name,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port,
        (
          SELECT COUNT(*)::text
          FROM public.media_assets
          WHERE public_id = 'cleanup-testing/abandoned-test-001'
        ) AS mock_count,
        (
          SELECT COUNT(*)::text
          FROM public.cloudinary_cleanup_jobs
        ) AS cleanup_job_count
    `);

    console.log("Database diagnostic:");
    console.table(result.rows);
  } catch (error) {
    console.error("Database diagnostic failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

void main();
