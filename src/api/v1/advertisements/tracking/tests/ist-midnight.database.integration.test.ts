/**
 * Read-only Neon/PostgreSQL IST midnight-boundary verification.
 * Opt in explicitly with RUN_IST_DB_TESTS=1 and use a development/UAT DATABASE_URL.
 * 
 * $env:RUN_IST_DB_TESTS = "1"
$env:TZ = "Asia/Kolkata"

npx vitest run `
  src/api/v1/advertisements/tracking/tests/ist-midnight.database.integration.test.ts

  $env:TZ = "America/New_York"

npx vitest run `
  src/api/v1/advertisements/tracking/tests/ist-midnight.database.integration.test.ts

  Clean up:
  Remove-Item Env:RUN_IST_DB_TESTS -ErrorAction SilentlyContinue
Remove-Item Env:TZ -ErrorAction SilentlyContinue
 */
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../../../../shared/config/db.js";

const enabled = process.env.RUN_IST_DB_TESTS === "1";

// All queries are SELECT-only; no application records are created or modified.
describe.skipIf(!enabled)("IST midnight: real PostgreSQL boundary", () => {
  afterAll(async () => {
    await pool.end();
  });

  for (const sessionZone of ["UTC", "America/New_York", "Asia/Kolkata"]) {
    it(`keeps IST schedule dates and daily metrics stable with DB session timezone ${sessionZone}`, async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN READ ONLY");
        await client.query("SELECT set_config('TimeZone', $1, true)", [
          sessionZone
        ]);

        // Synthetic timestamps are real timestamptz values evaluated by Neon.
        // No advertisement or tracking tables are written to.
        const result = await client.query<{
          before_ist_date: string;
          after_ist_date: string;
          nov13_count: string;
          nov14_count: string;
          nov13_schedule_matches: boolean;
          nov14_schedule_matches: boolean;
        }>(`
          WITH events(event_at, event_kind) AS (
            VALUES
              ('2026-11-13T18:29:59Z'::timestamptz, 'impression'::text),
              ('2026-11-13T18:30:00Z'::timestamptz, 'impression'::text),
              ('2026-11-13T18:30:00Z'::timestamptz, 'click'::text)
          ), grouped AS (
            SELECT (event_at AT TIME ZONE 'Asia/Kolkata')::date AS ist_date,
                   count(*)::bigint AS events_count
            FROM events GROUP BY 1
          ), schedule AS (
            SELECT '2026-11-13T18:30:00Z'::timestamptz AS start_at,
                   '2026-11-14T18:29:59Z'::timestamptz AS end_at
          )
          SELECT
            ('2026-11-13T18:29:59Z'::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::text AS before_ist_date,
            ('2026-11-13T18:30:00Z'::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::text AS after_ist_date,
            (SELECT events_count::text FROM grouped WHERE ist_date = DATE '2026-11-13') AS nov13_count,
            (SELECT events_count::text FROM grouped WHERE ist_date = DATE '2026-11-14') AS nov14_count,
            (SELECT (start_at AT TIME ZONE 'Asia/Kolkata')::date <= DATE '2026-11-13'
                     AND (end_at AT TIME ZONE 'Asia/Kolkata')::date >= DATE '2026-11-13'
             FROM schedule) AS nov13_schedule_matches,
            (SELECT (start_at AT TIME ZONE 'Asia/Kolkata')::date <= DATE '2026-11-14'
                     AND (end_at AT TIME ZONE 'Asia/Kolkata')::date >= DATE '2026-11-14'
             FROM schedule) AS nov14_schedule_matches
        `);
        expect(result.rows[0]).toEqual({
          before_ist_date: "2026-11-13",
          after_ist_date: "2026-11-14",
          nov13_count: "1",
          nov14_count: "2",
          nov13_schedule_matches: false,
          nov14_schedule_matches: true
        });
      } finally {
        await client.query("ROLLBACK").catch(() => undefined);
        client.release();
      }
    });
  }
});
