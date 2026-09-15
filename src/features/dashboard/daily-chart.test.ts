import { describe, expect, it } from "vitest";
import { formatTrendDate, trendLabelIndices } from "./daily-chart";

describe("formatTrendDate", () => {
  it("formats Japanese dates with the weekday", () => {
    expect(formatTrendDate("2026-09-14", "ja")).toBe("9月14日(月)");
  });

  it("formats English dates with the weekday", () => {
    expect(formatTrendDate("2026-09-14", "en")).toBe("Mon, Sep 14");
  });
});

describe("trendLabelIndices", () => {
  it("keeps the newest date and spaces labels across 30- and 90-day views", () => {
    for (const length of [30, 90]) {
      const indices = trendLabelIndices(length);
      const step = (900 - 28 * 2) / (length - 1);
      expect(indices[0]).toBe(length - 1);
      expect(indices.every((index, position) => position === 0 || (indices[position - 1] - index) * step >= 160)).toBe(true);
    }
  });
});
