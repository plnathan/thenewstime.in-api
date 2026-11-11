import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";
import { pool } from "../../../shared/config/db.js";
import { authenticate } from "../security/middleware/authenticate.middleware.js";
import { authorize } from "../security/middleware/authorize.middleware.js";

const router = Router();
router.use(authenticate);

type DashboardModule =
  "news" | "users" | "roles" | "permissions" | "advertisements";

type MetricRow = {
  metric_key: string;
  metric_label: string;
  metric_value: string | number | null;
};

type UserStatusCounts = {
  total: string;
  active: string;
  inactive: string;
  suspended: string;
  locked: string;
};

/**
 * Reconcile the five Users Dashboard status cards with public.users.
 * The cohort is selected by user creation date; statuses are current.
 * Other Users Dashboard metrics retain their existing reporting logic.
 */
async function reconcileUserStatusMetrics(
  rows: MetricRow[],
  month: number | null,
  year: number | null
): Promise<MetricRow[]> {
  const result = await pool.query<UserStatusCounts>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status::text = 'ACTIVE')::text AS active,
       COUNT(*) FILTER (WHERE status::text = 'INACTIVE')::text AS inactive,
       COUNT(*) FILTER (WHERE status::text = 'SUSPENDED')::text AS suspended,
       COUNT(*) FILTER (WHERE status::text = 'LOCKED')::text AS locked
     FROM public.users
     WHERE ($1::integer IS NULL OR EXTRACT(MONTH FROM created_at) = $1::integer)
       AND ($2::integer IS NULL OR EXTRACT(YEAR FROM created_at) = $2::integer)`,
    [month, year]
  );

  const counts = result.rows[0];
  if (!counts) return rows;

  const values: Record<string, number> = {
    total: Number(counts.total),
    active: Number(counts.active),
    inactive: Number(counts.inactive),
    suspended: Number(counts.suspended),
    locked: Number(counts.locked)
  };

  // Match the existing function's keys/labels rather than changing the
  // response contract consumed by AdminDashboardPage.tsx.
  const identify = (row: MetricRow): keyof typeof values | null => {
    const key = row.metric_key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const label = row.metric_label.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key === "total" || key === "totalusers" || label === "totalusers")
      return "total";
    if (
      key === "active" ||
      key === "activeusers" ||
      label === "active" ||
      label === "activeusers"
    )
      return "active";
    if (
      key === "inactive" ||
      key === "inactiveusers" ||
      label === "inactive" ||
      label === "inactiveusers"
    )
      return "inactive";
    if (
      key === "suspended" ||
      key === "suspendedusers" ||
      label === "suspended" ||
      label === "suspendedusers"
    )
      return "suspended";
    if (
      key === "locked" ||
      key === "lockedusers" ||
      label === "locked" ||
      label === "lockedusers"
    )
      return "locked";
    return null;
  };

  const seen = new Set<string>();
  const reconciled: MetricRow[] = rows.map((row): MetricRow => {
    const status = identify(row);
    if (!status) return row;
    seen.add(status);
    return { ...row, metric_value: values[status] ?? 0 };
  });

  // A missing row should not silently turn a real status count into zero.
  const defaults: Record<string, { key: string; label: string }> = {
    total: { key: "total_users", label: "Total Users" },
    active: { key: "active", label: "Active" },
    inactive: { key: "inactive", label: "Inactive" },
    suspended: { key: "suspended", label: "Suspended" },
    locked: { key: "locked", label: "Locked" }
  };
  for (const status of Object.keys(values)) {
    if (!seen.has(status)) {
      reconciled.push({
        metric_key: defaults[status]!.key,
        metric_label: defaults[status]!.label,
        metric_value: values[status]!
      });
    }
  }
  return reconciled;
}

function handler(module: DashboardModule) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const month =
        req.query.month === undefined || req.query.month === ""
          ? null
          : Number(req.query.month);
      const year =
        req.query.year === undefined || req.query.year === ""
          ? null
          : Number(req.query.year);
      if (
        (month !== null &&
          (!Number.isInteger(month) || month < 1 || month > 12)) ||
        (year !== null &&
          (!Number.isInteger(year) || year < 2000 || year > 2100))
      ) {
        res
          .status(400)
          .json({ success: false, message: "Invalid month/year filter" });
        return;
      }
      const result = await pool.query<MetricRow>(
        "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_metrics($1, $2, $3)",
        [module, month, year]
      );
      // Read-only stored functions refine financial and live-delivery metrics.
      // Authorization remains enforced by the endpoint's existing middleware.
      let rows = result.rows;
      if (module === "advertisements") {
        const [financial, delivery] = await Promise.all([
          pool.query<MetricRow>(
            "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_draft_payment_metrics($1, $2)",
            [month, year]
          ),
          pool.query<MetricRow>(
            "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_live_metrics($1, $2)",
            [month, year]
          )
        ]);
        const replacements = new Map(
          [...financial.rows, ...delivery.rows].map((row) => [
            row.metric_key,
            row
          ])
        );
        rows = result.rows.map(
          (row) => replacements.get(row.metric_key) ?? row
        );
      }
      if (module === "permissions") {
        const associations = await pool.query<MetricRow>(
          "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_permission_associations($1, $2)",
          [month, year]
        );
        const replacements = new Map(
          associations.rows.map((row) => [row.metric_key, row])
        );
        rows = result.rows.map(
          (row) => replacements.get(row.metric_key) ?? row
        );
      }
      // The audit stream records future lifecycle transitions and permanent
      // deletions. It cannot reconstruct events that predate installation.
      if (module === "news" || module === "advertisements") {
        const eventResult = await pool.query<MetricRow>(
          "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_event_metrics($1, $2, $3)",
          [module, month, year]
        );
        const events = new Map(
          eventResult.rows.map((row) => [row.metric_key, row])
        );
        rows = rows.map((row) =>
          module === "advertisements" &&
          row.metric_key === "paused" &&
          month === null &&
          year === null
            ? row
            : (events.get(row.metric_key) ?? row)
        );
      }
      // Advertisement creation-period cohort projection takes precedence.
      if (module === "advertisements") {
        const lifecycle = await pool.query<MetricRow>(
          "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_advertisement_period_metrics($1, $2)",
          [month, year]
        );
        const replacements = new Map(
          lifecycle.rows.map((row) => [row.metric_key, row])
        );
        rows = rows.map((row) => replacements.get(row.metric_key) ?? row);

        // Current STOPPED advertisements in the selected creation-period cohort.
        // An earlier stop does not count if a later operational event exists.
        const stopped = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM public.advertisements a
           WHERE a.status::text = 'COMPLETED'
             AND ($1::integer IS NULL OR EXTRACT(MONTH FROM a.created_at) = $1::integer)
             AND ($2::integer IS NULL OR EXTRACT(YEAR FROM a.created_at) = $2::integer)
             AND (
               SELECT oa.event_type::text
               FROM public.advertisement_operational_audit oa
               WHERE oa.advertisement_id = a.id
               ORDER BY oa.id DESC
               LIMIT 1
             ) = 'STOPPED'`,
          [month, year]
        );
        const stoppedRow: MetricRow = {
          metric_key: "stopped",
          metric_label: "Stopped",
          metric_value: Number(stopped.rows[0]?.count ?? 0)
        };
        rows = [
          ...rows.filter((row) => row.metric_key !== "stopped"),
          stoppedRow
        ];
      }
      // News lifecycle and current-state counts use one read-only projection.
      if (module === "news") {
        const news = await pool.query<MetricRow>(
          "SELECT metric_key, metric_label, metric_value FROM public.admin_dashboard_news_metrics($1, $2)",
          [month, year]
        );
        const newsKeys = new Set(news.rows.map((row) => row.metric_key));
        rows = [
          ...news.rows,
          ...rows.filter((row) => !newsKeys.has(row.metric_key))
        ];
      }
      if (module === "users") {
        rows = await reconcileUserStatusMetrics(rows, month, year);
      }
      res.json({
        success: true,
        data: rows.map((row) => ({
          key: row.metric_key,
          label: row.metric_label,
          value:
            row.metric_value === null
              ? module === "advertisements" || module === "users"
                ? 0
                : null
              : Number(row.metric_value)
        }))
      });
    } catch (error) {
      next(error);
    }
  };
}

// Read-only client status totals, independent of list pagination and filters.
router.get(
  "/clients-summary",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await pool.query<{
        total: string;
        active: string;
        inactive: string;
        blocked: string;
      }>(`SELECT COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::text AS active,
        COUNT(*) FILTER (WHERE status = 'INACTIVE')::text AS inactive,
        COUNT(*) FILTER (WHERE status = 'BLOCKED')::text AS blocked
        FROM advertisement_clients`);
      const counts = result.rows[0];
      res.json({
        success: true,
        data: {
          total: Number(counts?.total ?? 0),
          active: Number(counts?.active ?? 0),
          inactive: Number(counts?.inactive ?? 0),
          blocked: Number(counts?.blocked ?? 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/news", authorize("NEWS", "news", "read"), handler("news"));
router.get("/users", authorize("SECURITY", "users", "read"), handler("users"));
router.get("/roles", authorize("SECURITY", "roles", "read"), handler("roles"));
router.get(
  "/permissions",
  authorize("SECURITY", "permissions", "read"),
  handler("permissions")
);
router.get(
  "/advertisements",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  handler("advertisements")
);

export default router;
