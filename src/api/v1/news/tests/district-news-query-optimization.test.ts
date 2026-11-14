import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/config/db.js", () => ({
  pool: { query: vi.fn() }
}));

import { pool } from "../../../../shared/config/db.js";
import { findDistrictSections } from "../news.repository.js";

const query = vi.mocked(pool.query);

beforeEach(() => {
  query.mockReset();
});

describe("district section bounded query", () => {
  it("does not query news when there are no nonempty sections", async () => {
    query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await findDistrictSections(0, 8, 5);

    expect(result.sections).toEqual([]);
    expect(result.hasMoreSections).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("limits candidates per district before ranking and keeps one batched news query", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          key: "chennai-group",
          title: "சென்னை, செங்கல்பட்டு, காஞ்சிபுரம், திருவள்ளூர்",
          district_ids: [1, 2, 3, 4],
          sort_order: 1
        }
      ]
    } as never);
    query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await findDistrictSections(0, 8, 5);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual([9, 0]);
    expect(query.mock.calls[1]?.[1]).toEqual([[1, 2, 3, 4], 6]);
    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toMatch(/JOIN LATERAL/i);
    expect(sql).toMatch(/LIMIT \$2/);
    expect(sql).toMatch(/ROW_NUMBER\(\) OVER/i);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.news).toEqual([]);
  });
});
