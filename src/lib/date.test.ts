import { describe, expect, it } from "vitest";
import {
  currentMonth,
  formatDate,
  formatTime,
  isAllowedMonth,
  monthRange,
  shiftMonth,
  toTimestamp,
} from "./date";

const NOW = new Date("2026-11-02T03:00:00.000Z");

describe("formatDate", () => {
  it("東京時間の日付と曜日を返す", () => {
    expect(formatDate("2026-11-03T19:00:00+09:00")).toBe("11/3（火）");
    expect(formatDate("2026-11-02T15:30:00Z")).toBe("11/3（火）");
  });

  it("終日の予定の日付を扱う", () => {
    expect(formatDate("2026-11-03")).toBe("11/3（火）");
  });
});

it("formatTime は東京時間の時刻を返す", () => {
  expect(formatTime("2026-11-03T10:00:00Z")).toBe("19:00");
});

it("toTimestamp は終日の予定を東京の 0 時として扱う", () => {
  expect(toTimestamp("2026-11-03")).toBe(Date.parse("2026-11-03T00:00:00+09:00"));
});

describe("月の計算", () => {
  it("月末の深夜は東京時間で月を判定する", () => {
    expect(currentMonth(new Date("2026-11-30T15:00:00Z"))).toBe("2026-12");
  });

  it("年をまたいで月を移動する", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("月の範囲を東京時間で返す", () => {
    expect(monthRange("2026-12")).toEqual({
      timeMin: "2026-12-01T00:00:00+09:00",
      timeMax: "2027-01-01T00:00:00+09:00",
    });
  });
});

describe("isAllowedMonth", () => {
  it.each(["2026-11", "2025-11", "2027-11"])("%s を受け付ける", (month) => {
    expect(isAllowedMonth(month, NOW)).toBe(true);
  });

  it.each(["2025-10", "2027-12", "2026-13", "2026-00", "2026-1", "abc", "", "2026-11-01"])(
    "%s を受け付けない",
    (month) => {
      expect(isAllowedMonth(month, NOW)).toBe(false);
    },
  );
});
