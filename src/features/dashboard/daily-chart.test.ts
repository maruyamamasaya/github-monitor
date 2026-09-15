import { describe, expect, it } from "vitest";
import { formatTrendDate } from "./daily-chart";

describe("formatTrendDate", () => {
  it("formats Japanese dates with the weekday", () => {
    expect(formatTrendDate("2026-09-14", "ja")).toBe("9月14日(月)");
  });

  it("formats English dates with the weekday", () => {
    expect(formatTrendDate("2026-09-14", "en")).toBe("Mon, Sep 14");
  });
});
