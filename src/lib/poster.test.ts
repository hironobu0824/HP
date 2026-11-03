import { describe, expect, it } from "vitest";
import type { LiveEvent } from "./calendar";
import { detailTexts, paginate, wrapText } from "./poster";

const measure = (text: string) => text.length * 30;

const event = (overrides: Partial<LiveEvent> = {}): LiveEvent => ({
  id: "a",
  title: "ネタライブ",
  allDay: false,
  start: "2026-11-03T19:00:00+09:00",
  end: "2026-11-03T21:00:00+09:00",
  venue: "下北沢",
  doorsAt: "18:45",
  openAt: "19:00",
  closesAt: null,
  price: "1,500円",
  ticketUrl: null,
  description: null,
  ...overrides,
});

describe("wrapText", () => {
  it("幅に収まるように折り返す", () => {
    expect(wrapText("あいうえおか", "", 90, measure)).toEqual(["あいう", "えおか"]);
  });

  it("空文字は行を作らない", () => {
    expect(wrapText("", "", 90, measure)).toEqual([]);
  });
});

describe("detailTexts", () => {
  it("項目名を付けて書き出す", () => {
    expect(detailTexts(event())).toEqual([
      "場所: 下北沢",
      "開場: 18:45 / 開演: 19:00",
      "料金: 1,500円",
    ]);
  });

  it("終演があれば時間の行に加える", () => {
    expect(detailTexts(event({ closesAt: "21:00" }))).toContain(
      "開場: 18:45 / 開演: 19:00 / 終演: 21:00",
    );
  });

  it("場所と料金がなければ未定にする", () => {
    expect(detailTexts(event({ venue: null, doorsAt: null, price: null }))).toEqual([
      "場所: 未定",
      "開演: 19:00",
      "料金: 未定",
    ]);
  });

  it("開場と開演がなければ時間未定にする", () => {
    expect(detailTexts(event({ doorsAt: null, openAt: null, closesAt: null }))).toEqual([
      "場所: 下北沢",
      "時間未定",
      "料金: 1,500円",
    ]);
  });
});

describe("paginate", () => {
  it("予定がなければ 0 枚にする", () => {
    expect(paginate([], measure)).toEqual([]);
  });

  it("高さに収まる件数で次の画像に分ける", () => {
    const pages = paginate(Array.from({ length: 7 }, () => event()), measure);
    expect(pages.map((page) => page.length)).toEqual([5, 2]);
  });

  it("場所と料金が未定の行も高さに含めて分ける", () => {
    const pages = paginate(
      Array.from({ length: 7 }, () => event({ venue: null, price: null })),
      measure,
    );
    expect(pages[0]).toHaveLength(5);
    expect(pages[1]).toHaveLength(2);
  });

  it("長いライブ名で収まらなければ件数を減らす", () => {
    const pages = paginate(
      Array.from({ length: 5 }, () => event({ title: "長".repeat(80) })),
      measure,
    );
    expect(pages[0]?.length).toBeLessThan(5);
  });
});
