import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { orderEligibleCards } from "./batch-order.js";
import { normalizeCardUrl } from "./card-url.js";
import { randomUUID } from "node:crypto";
import { signReceipt, type FeedReceipt } from "./public-feed.token.js";

// Pricing placements are deliberately disabled for conventional delivery.
const eligibleSql = `SELECT a.id::text AS "advertisementId", b.id::text AS "batchId",
 b.capacity, b.code, b.display_name AS "displayName", b.batch_order AS "batchOrder",
 f.batch_assigned_at::text AS "batchAssignedAt", f.activated_at::text AS "activatedAt",
 c.headline,c.description,c.sponsor_display_name AS "sponsorDisplayName",c.cta_label AS "ctaLabel",
 c.image_url AS "imageUrl",c.headline_url AS "headlineUrl",c.description_url AS "descriptionUrl",
 c.sponsor_url AS "sponsorUrl",c.cta_url AS "ctaUrl",a.destination_url AS "destinationUrl",
 a.is_clickable AS clickable,a.open_in_new_tab AS "openInNewTab"
 FROM advertisement_feed_assignments f JOIN advertisements a ON a.id=f.advertisement_id
 JOIN advertisement_feed_batches b ON b.id=f.batch_id JOIN advertisement_card_contents c ON c.advertisement_id=a.id
 JOIN advertisement_clients cl ON cl.id=a.client_id
 JOIN news n ON n.id=$1 AND n.status='PUBLISHED' AND n.published_at<=now()
 JOIN categories cat ON cat.id=n.category_id LEFT JOIN states st ON st.id=n.state_id
 LEFT JOIN districts d ON d.id=n.district_id LEFT JOIN countries co ON co.id=n.country_id
 WHERE b.is_enabled AND a.advertisement_type='NATIVE' AND NOT a.is_house_ad
 AND a.status='ACTIVE' AND a.workflow_status='APPROVED' AND cl.status='ACTIVE'
 AND f.activated_at IS NOT NULL AND f.activated_at<=now()
 AND a.start_at<=now() AND a.end_at>now() AND f.reserved_start_at<=now() AND f.reserved_end_at>now()
 AND f.rate_card_id IS NOT NULL AND f.assigned_rate_amount>0 AND a.advertisement_amount>0
 AND (GREATEST(0,a.advertisement_amount-a.adjustment_amount-GREATEST(0,
 COALESCE((SELECT sum(p.amount) FROM advertisement_payments p WHERE p.advertisement_id=a.id AND p.payment_status IN ('VERIFIED','REFUNDED')),0)-
 COALESCE((SELECT sum(r.amount) FROM advertisement_payment_refunds r JOIN advertisement_payments p ON p.id=r.payment_id WHERE p.advertisement_id=a.id),0))) <=
 COALESCE((SELECT CASE WHEN fa.status='APPROVED' AND fa.revoked_at IS NULL AND fa.expected_payment_due_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date THEN fa.approved_amount ELSE 0 END FROM advertisement_financial_approvals fa WHERE fa.advertisement_id=a.id AND fa.approval_type='CREDIT_EXCEPTION' ORDER BY fa.requested_at DESC,fa.id DESC LIMIT 1),0))
 AND NOT EXISTS (SELECT 1 FROM advertisement_feed_upgrades u WHERE u.advertisement_id=a.id AND u.status='PENDING' AND u.charged_at IS NOT NULL)
 AND NOT EXISTS (SELECT 1 FROM advertisement_financial_approvals fa WHERE fa.advertisement_id=a.id AND fa.approval_type IN ('DISCOUNT','ADJUSTMENT') AND fa.status IN ('SUBMITTED','HOLD'))
 AND NOT EXISTS (SELECT 1 FROM advertisement_targets t WHERE t.advertisement_id=a.id AND NOT t.is_include AND lower(trim(t.target_value)) IN (lower(CASE t.target_type WHEN 'SITE' THEN 'thenewstime.in' WHEN 'NEWS' THEN n.id::text WHEN 'CATEGORY' THEN cat.code WHEN 'STATE' THEN st.code WHEN 'DISTRICT' THEN d.code WHEN 'COUNTRY' THEN co.code END),lower(CASE t.target_type WHEN 'CATEGORY' THEN cat.display_name WHEN 'STATE' THEN st.display_name WHEN 'DISTRICT' THEN d.display_name WHEN 'COUNTRY' THEN co.display_name END),lower(CASE t.target_type WHEN 'CATEGORY' THEN cat.url_name WHEN 'STATE' THEN st.url_name WHEN 'DISTRICT' THEN d.url_name WHEN 'COUNTRY' THEN co.url_name END)))
 AND (NOT EXISTS (SELECT 1 FROM advertisement_targets t WHERE t.advertisement_id=a.id AND t.is_include) OR EXISTS (SELECT 1 FROM advertisement_targets t WHERE t.advertisement_id=a.id AND t.is_include AND lower(trim(t.target_value)) IN (lower(CASE t.target_type WHEN 'SITE' THEN 'thenewstime.in' WHEN 'NEWS' THEN n.id::text WHEN 'CATEGORY' THEN cat.code WHEN 'STATE' THEN st.code WHEN 'DISTRICT' THEN d.code WHEN 'COUNTRY' THEN co.code END),lower(CASE t.target_type WHEN 'CATEGORY' THEN cat.display_name WHEN 'STATE' THEN st.display_name WHEN 'DISTRICT' THEN d.display_name WHEN 'COUNTRY' THEN co.display_name END),lower(CASE t.target_type WHEN 'CATEGORY' THEN cat.url_name WHEN 'STATE' THEN st.url_name WHEN 'DISTRICT' THEN d.url_name WHEN 'COUNTRY' THEN co.url_name END))))
 ORDER BY b.batch_order,f.batch_assigned_at,a.id`;

export const elements = [
  "IMAGE",
  "HEADLINE",
  "DESCRIPTION",
  "SPONSOR",
  "CTA"
] as const;
export type FeedElement = (typeof elements)[number];
async function cards(newsId: string) {
  type Row = {
    advertisementId: string;
    batchId: string;
    batchAssignedAt: string;
    activatedAt: string;
    code: string;
    displayName: string;
    batchOrder: number;
    capacity: number;
    headline: string | null;
    description: string | null;
    sponsorDisplayName: string | null;
    ctaLabel: string | null;
    imageUrl: string | null;
    headlineUrl: string | null;
    descriptionUrl: string | null;
    sponsorUrl: string | null;
    ctaUrl: string | null;
    destinationUrl: string | null;
    clickable: boolean;
    openInNewTab: boolean;
  };
  const rows = (await pool.query<Row>(eligibleSql, [newsId])).rows;
  const batchIds = [...new Set<string>(rows.map((r) => r.batchId))];
  return batchIds.flatMap((batchId) => {
    const group = rows.filter((r) => r.batchId === batchId);
    // Fail closed on corrupted capacity, without hiding unrelated batches.
    if (group.length > (group[0]?.capacity ?? 0)) return [];
    return orderEligibleCards(batchId, group, group[0]?.capacity ?? 0)
      .flatMap((r) => {
        try {
          const imageUrl = normalizeCardUrl(r.imageUrl);
          if (!imageUrl || !r.headline?.trim() || !r.sponsorDisplayName?.trim())
            return [];
          // Sponsored cards use their own element-specific destinations.
          // Conventional advertisement clickability and destination_url do not apply.
          const links: Record<FeedElement, string | null> = {
            IMAGE: normalizeCardUrl(r.headlineUrl),
            HEADLINE: normalizeCardUrl(r.headlineUrl),
            DESCRIPTION: r.description
              ? normalizeCardUrl(r.descriptionUrl)
              : null,
            SPONSOR: normalizeCardUrl(r.sponsorUrl),
            CTA: normalizeCardUrl(r.ctaUrl)
          };
          return [
            {
              advertisementId: String(r.advertisementId),
              batchId,
              code: String(r.code),
              displayName: String(r.displayName),
              batchOrder: Number(r.batchOrder),
              position: r.position,
              headline: String(r.headline),
              description: r.description as string | null,
              sponsorDisplayName: String(r.sponsorDisplayName),
              ctaLabel: r.ctaLabel as string | null,
              imageUrl,
              links,
              openInNewTab: Boolean(r.openInNewTab)
            }
          ];
        } catch {
          return [];
        }
      })
      .map((r, i) => ({ ...r, position: i + 1 }));
  });
}
export async function deliver(newsId: string) {
  const eligible = await cards(newsId);
  return [...new Set(eligible.map((c) => c.batchId))].map((batchId) => {
    const group = eligible.filter((c) => c.batchId === batchId);
    const batchViewId = randomUUID();
    return {
      batchId,
      code: group[0]!.code,
      displayName: group[0]!.displayName,
      batchOrder: group[0]!.batchOrder,
      cards: group.map((c) => ({
        ...c,
        trackingToken: signReceipt({
          newsId,
          batchId,
          advertisementId: c.advertisementId,
          position: c.position,
          batchViewId,
          eventId: randomUUID(),
          expiresAt: Date.now() + 30 * 60 * 1000
        })
      }))
    };
  });
}
export async function track(receipt: FeedReceipt, element?: FeedElement) {
  const matching = (await cards(receipt.newsId)).find(
    (c) =>
      c.advertisementId === receipt.advertisementId &&
      c.batchId === receipt.batchId
  );
  if (!matching || (element && !matching.links[element]))
    throw new ApiError(409, "Sponsored card is no longer eligible.");
  const args = [
    receipt.advertisementId,
    receipt.batchId,
    receipt.position,
    receipt.batchViewId,
    receipt.eventId
  ];
  const result = element
    ? await pool.query(
        `INSERT INTO advertisement_clicks(advertisement_id,page_type,feed_batch_id,feed_position,feed_view_id,feed_event_id,feed_element) VALUES($1,'NEWS_DETAIL',$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
        [...args, element]
      )
    : await pool.query(
        `INSERT INTO advertisement_impressions(advertisement_id,page_type,feed_batch_id,feed_position,feed_view_id,client_event_id) VALUES($1,'NEWS_DETAIL',$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
        args
      );
  return { tracked: true, duplicate: !result.rowCount };
}
/** Each signed receipt is verified individually. Existing eligibility checks and
 * database uniqueness constraints are reused, including for duplicate events.
 * Invalid events do not suppress valid events in the same request. */
export async function trackBatch(
  events: Array<{ token: string; element?: FeedElement }>
) {
  const { verifyReceipt } = await import("./public-feed.token.js");
  const results: Array<{
    index: number;
    tracked: boolean;
    duplicate?: boolean;
    error?: string;
  }> = [];
  for (const [index, event] of events.entries()) {
    try {
      const result = await track(verifyReceipt(event.token), event.element);
      results.push({ index, ...result });
    } catch (error) {
      results.push({
        index,
        tracked: false,
        error: error instanceof Error ? error.message : "Tracking rejected"
      });
    }
  }
  return {
    received: events.length,
    accepted: results.filter((r) => r.tracked).length,
    rejected: results.filter((r) => !r.tracked).length,
    results
  };
}
export async function metrics(from: string, to: string) {
  const result = await pool.query(
    `WITH i AS (SELECT feed_batch_id,count(*)::int impressions,count(DISTINCT feed_view_id)::int views FROM advertisement_impressions WHERE feed_batch_id IS NOT NULL AND impression_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND impression_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata') GROUP BY feed_batch_id), c AS (SELECT feed_batch_id, count(*)::int clicks FROM advertisement_clicks WHERE feed_batch_id IS NOT NULL AND click_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND click_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata') GROUP BY feed_batch_id), e AS (SELECT feed_batch_id,feed_element,count(*)::int total FROM advertisement_clicks WHERE feed_batch_id IS NOT NULL AND click_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND click_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata') GROUP BY feed_batch_id,feed_element) SELECT b.id::text AS "batchId",b.code,coalesce(i.impressions,0) AS "cardImpressions",coalesce(i.views,0) AS "batchImpressions",coalesce(c.clicks,0) clicks,coalesce((SELECT jsonb_object_agg(e.feed_element,e.total) FROM e WHERE e.feed_batch_id=b.id),'{}'::jsonb) AS "elementClicks" FROM advertisement_feed_batches b LEFT JOIN i ON i.feed_batch_id=b.id LEFT JOIN c ON c.feed_batch_id=b.id ORDER BY b.batch_order`,
    [from, to]
  );
  const breakdown = await pool.query(
    `WITH events AS (SELECT feed_batch_id,advertisement_id,feed_position,'IMPRESSION'::text kind FROM advertisement_impressions WHERE feed_batch_id IS NOT NULL AND impression_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND impression_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata') UNION ALL SELECT feed_batch_id,advertisement_id,feed_position,feed_element FROM advertisement_clicks WHERE feed_batch_id IS NOT NULL AND click_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND click_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) SELECT feed_batch_id::text AS "batchId",advertisement_id::text AS "advertisementId",feed_position AS position,kind,count(*)::int total FROM events GROUP BY feed_batch_id,advertisement_id,feed_position,kind ORDER BY feed_batch_id,advertisement_id,feed_position,kind`,
    [from, to]
  );
  return result.rows.map((b) => ({
    ...b,
    cardMetrics: breakdown.rows.filter((r) => r.batchId === b.batchId)
  }));
}
