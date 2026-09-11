import { describe, expect, it } from "vitest";
import { aggregateDaily, aggregateMetrics } from "./aggregate";
import { calculateActivityScore } from "./activity-score";
import { getJstStart, isWithinPeriod, toJstDateKey } from "./date-range";
import type { CommitActivity } from "@/types/activity";

const commit = (authoredAt: string, additions = 10, deletions = 2, changedFiles = 1): CommitActivity => ({ sha: authoredAt, repository: "owner/repo", authoredAt, message: "test", additions, deletions, changedFiles, url: "https://github.com/owner/repo/commit/a" });

describe("activity score", () => {
  it("returns zero without commits", () => expect(calculateActivityScore({ commits: 0, activeDays: 0, changedLines: 100, changedFiles: 2 })).toBe(0));
  it("rewards activity signals", () => expect(calculateActivityScore({ commits: 2, activeDays: 1, changedLines: 12, changedFiles: 1 })).toBe(29.1));
});

describe("Asia/Tokyo ranges", () => {
  const now = new Date("2026-09-11T01:00:00.000Z");
  it("converts dates around the JST boundary", () => {
    expect(toJstDateKey("2026-09-10T14:59:59.000Z")).toBe("2026-09-10");
    expect(toJstDateKey("2026-09-10T15:00:00.000Z")).toBe("2026-09-11");
  });
  it("starts today at midnight JST", () => expect(getJstStart("today", now).toISOString()).toBe("2026-09-10T15:00:00.000Z"));
  it("uses an inclusive seven-day calendar window", () => {
    expect(isWithinPeriod("2026-09-04T15:00:00.000Z", "week", now)).toBe(true);
    expect(isWithinPeriod("2026-09-04T14:59:59.000Z", "week", now)).toBe(false);
  });
});

describe("aggregation", () => {
  const now = new Date("2026-09-11T01:00:00.000Z");
  it("aggregates values and distinct JST days", () => {
    const result = aggregateMetrics([commit("2026-09-10T15:00:00.000Z"), commit("2026-09-10T23:00:00.000Z", 3, 1, 2)], "today", now);
    expect(result).toMatchObject({ commits: 2, activeDays: 1, additions: 13, deletions: 3, changedLines: 16, changedFiles: 3 });
  });
  it("returns empty metrics", () => expect(aggregateMetrics([], "month", now)).toEqual({ commits: 0, activeDays: 0, additions: 0, deletions: 0, changedLines: 0, changedFiles: 0, score: 0 }));
  it("creates a zero-filled 30-day series", () => {
    const result = aggregateDaily([commit("2026-09-10T15:00:00.000Z")], now);
    expect(result).toHaveLength(30);
    expect(result.at(-1)).toEqual({ date: "2026-09-11", commits: 1 });
  });
});
