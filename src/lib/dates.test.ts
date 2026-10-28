import { describe, expect, it } from "vitest";
import { formatSyncDate, isToday } from "./dates";

describe("formatSyncDate", () => {
  const now = new Date(2026, 9, 28, 22, 0);
  it("says today and yesterday in words", () => {
    expect(formatSyncDate(new Date(2026, 9, 28, 8, 40).toISOString(), now)).toBe("Aujourd'hui 08:40");
    expect(formatSyncDate(new Date(2026, 9, 27, 18, 5).toISOString(), now)).toBe("Hier 18:05");
  });
  it("gives the full date otherwise", () => {
    expect(formatSyncDate(new Date(2026, 9, 25, 17, 12).toISOString(), now)).toBe("25/10/2026 17:12");
  });
  it("knows when a sync happened today", () => {
    expect(isToday(new Date(2026, 9, 28, 1, 0).toISOString(), now)).toBe(true);
    expect(isToday(null, now)).toBe(false);
  });
});
