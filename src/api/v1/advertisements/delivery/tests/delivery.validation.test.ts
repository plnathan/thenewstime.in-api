import { describe, expect, it } from "vitest";

import { advertisementDeliveryQuerySchema } from "../delivery.validation.js";

describe("advertisementDeliveryQuerySchema", () => {
  describe("valid base queries", () => {
    it("should accept HOME with HOME_TOP", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          pageType: "HOME",
          placementType: "HOME_TOP"
        });
      }
    });

    it("should accept NEWS_LIST with NEWS_LIST_TOP", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP"
      });

      expect(result.success).toBe(true);
    });

    it("should accept NEWS_DETAIL with NEWS_DETAIL_TOP", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP"
      });

      expect(result.success).toBe(true);
    });
  });

  describe("pageType validation", () => {
    it("should accept every supported page type", () => {
      const pageTypes = ["HOME", "NEWS_LIST", "NEWS_DETAIL"] as const;

      for (const pageType of pageTypes) {
        const result = advertisementDeliveryQuerySchema.safeParse({
          pageType,
          placementType:
            pageType === "HOME"
              ? "HOME_TOP"
              : pageType === "NEWS_LIST"
                ? "NEWS_LIST_TOP"
                : "NEWS_DETAIL_TOP"
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject a missing pageType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        placementType: "HOME_TOP"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported pageType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "INVALID",
        placementType: "HOME_TOP"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a lowercase pageType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "home",
        placementType: "HOME_TOP"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("placementType validation", () => {
    it("should accept every supported placement type", () => {
      const placementTypes = [
        "HOME_BANNER",
        "HOME_TOP",
        "HOME_BETWEEN_SECTIONS",
        "HOME_SIDEBAR",
        "NEWS_LIST_TOP",
        "NEWS_LIST_BETWEEN",
        "NEWS_LIST_BOTTOM",
        "NEWS_DETAIL_TOP",
        "NEWS_DETAIL_BETWEEN",
        "NEWS_DETAIL_SIDEBAR",
        "NEWS_DETAIL_BOTTOM",
        "NEWS_DETAIL_MODAL"
      ] as const;

      const pageTypeByPlacement: Record<
        (typeof placementTypes)[number],
        "HOME" | "NEWS_LIST" | "NEWS_DETAIL"
      > = {
        HOME_BANNER: "HOME",
        HOME_TOP: "HOME",
        HOME_BETWEEN_SECTIONS: "HOME",
        HOME_SIDEBAR: "HOME",
        NEWS_LIST_TOP: "NEWS_LIST",
        NEWS_LIST_BETWEEN: "NEWS_LIST",
        NEWS_LIST_BOTTOM: "NEWS_LIST",
        NEWS_DETAIL_TOP: "NEWS_DETAIL",
        NEWS_DETAIL_BETWEEN: "NEWS_DETAIL",
        NEWS_DETAIL_SIDEBAR: "NEWS_DETAIL",
        NEWS_DETAIL_BOTTOM: "NEWS_DETAIL",
        NEWS_DETAIL_MODAL: "NEWS_DETAIL"
      };

      for (const placementType of placementTypes) {
        const result = advertisementDeliveryQuerySchema.safeParse({
          pageType: pageTypeByPlacement[placementType],
          placementType
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject a missing placementType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported placementType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a lowercase placementType", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "home_top"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("placementId", () => {
    it("should coerce a numeric string to a number", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: "12"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
        expect(typeof result.data.placementId).toBe("number");
      }
    });

    it("should accept a numeric placementId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: 12
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
      }
    });

    it("should reject zero placementId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative placementId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-integer placementId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric placementId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        placementId: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should allow placementId to be omitted", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBeUndefined();
      }
    });
  });

  describe("optional targeting context", () => {
    it("should accept site", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        site: "thenewstime.in"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.site).toBe("thenewstime.in");
      }
    });

    it("should accept newsId and coerce it to a number", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        newsId: "123"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.newsId).toBe(123);
        expect(typeof result.data.newsId).toBe("number");
      }
    });

    it("should accept category", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        category: "tamil-nadu"
      });

      expect(result.success).toBe(true);
    });

    it("should accept state", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        state: "tamil-nadu"
      });

      expect(result.success).toBe(true);
    });

    it("should accept district", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        district: "tiruppur"
      });

      expect(result.success).toBe(true);
    });

    it("should accept country", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        country: "india"
      });

      expect(result.success).toBe(true);
    });

    it("should accept all targeting context fields together", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        site: "thenewstime.in",
        newsId: "123",
        category: "politics",
        state: "tamil-nadu",
        district: "tiruppur",
        country: "india"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          pageType: "NEWS_DETAIL",
          placementType: "NEWS_DETAIL_TOP",
          site: "thenewstime.in",
          newsId: 123,
          category: "politics",
          state: "tamil-nadu",
          district: "tiruppur",
          country: "india"
        });
      }
    });
  });

  describe("string trimming", () => {
    it("should trim site", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        site: "  thenewstime.in  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.site).toBe("thenewstime.in");
      }
    });

    it("should trim category", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        category: "  tamil-nadu  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.category).toBe("tamil-nadu");
      }
    });

    it("should trim state", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        state: "  tamil-nadu  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.state).toBe("tamil-nadu");
      }
    });

    it("should trim district", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        district: "  tiruppur  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.district).toBe("tiruppur");
      }
    });

    it("should trim country", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        country: "  india  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.country).toBe("india");
      }
    });
  });

  describe("empty string validation", () => {
    it("should reject an empty site", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        site: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only site", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        site: "   "
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty category", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        category: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty state", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        state: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty district", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_TOP",
        district: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty country", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        country: ""
      });

      expect(result.success).toBe(false);
    });
  });

  describe("newsId validation", () => {
    it("should reject zero newsId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        newsId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative newsId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        newsId: -10
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-integer newsId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        newsId: 1.25
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric newsId", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        newsId: "not-a-number"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("complete query", () => {
    it("should accept a fully populated delivery query", () => {
      const input = {
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_MODAL",
        placementId: "25",
        site: "  thenewstime.in  ",
        newsId: "456",
        category: "  tamil-nadu  ",
        state: "  tamil-nadu  ",
        district: "  tiruppur  ",
        country: "  india  "
      };

      const result = advertisementDeliveryQuerySchema.safeParse(input);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          pageType: "NEWS_DETAIL",
          placementType: "NEWS_DETAIL_MODAL",
          placementId: 25,
          site: "thenewstime.in",
          newsId: 456,
          category: "tamil-nadu",
          state: "tamil-nadu",
          district: "tiruppur",
          country: "india"
        });
      }
    });
  });

  describe("unexpected fields", () => {
    it("should ignore unknown fields by default", () => {
      const result = advertisementDeliveryQuerySchema.safeParse({
        pageType: "HOME",
        placementType: "HOME_TOP",
        unknownField: "ignored"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect("unknownField" in result.data).toBe(false);
      }
    });
  });
});
