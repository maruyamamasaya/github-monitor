import type { PeriodKey } from "@/types/activity";

export const TIME_ZONE = "Asia/Tokyo";

export function toJstDateKey(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function getJstStart(period: PeriodKey, now = new Date()): Date {
  const today = toJstDateKey(now);
  const [year, month, day] = today.split("-").map(Number);
  const daysBack = period === "today" ? 0 : period === "week" ? 6 : 29;
  return new Date(Date.UTC(year, month - 1, day - daysBack, -9, 0, 0, 0));
}

export function isWithinPeriod(value: Date | string, period: PeriodKey, now = new Date()): boolean {
  const date = new Date(value);
  return date >= getJstStart(period, now) && date <= now;
}

export function getLastJstDateKeys(days: number, now = new Date()): string[] {
  const today = toJstDateKey(now);
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: days }, (_, index) => {
    const cursor = new Date(Date.UTC(year, month - 1, day - (days - 1 - index), 12));
    return cursor.toISOString().slice(0, 10);
  });
}
