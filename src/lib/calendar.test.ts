import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSchedule,
  getSchedule,
  toLiveEvent,
  type ScheduleCache,
  type ScheduleDeps,
} from "./calendar";

const NOW = new Date("2026-11-02T03:00:00.000Z");

const googleEvent = (overrides: object = {}) => ({
  id: "a",
  summary: "ネタライブ",
  location: "下北沢",
  description: "開場: 18:45\n開演: 19:00\n料金: 1,500円",
  start: { dateTime: "2026-11-03T19:00:00+09:00" },
  end: { dateTime: "2026-11-03T21:00:00+09:00" },
  ...overrides,
});

function memoryCache(initial: Record<string, string> = {}): ScheduleCache {
  const store = new Map(Object.entries(initial));
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => void store.set(key, value),
  };
}

function deps(overrides: Partial<ScheduleDeps> = {}): ScheduleDeps {
  return {
    apiKey: "secret-key",
    calendarId: "calendar@example.com",
    cache: memoryCache(),
    fetch: vi.fn(async () => Response.json({ items: [googleEvent()] })),
    now: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("toLiveEvent", () => {
  it("説明欄の項目を読み取る", () => {
    expect(toLiveEvent(googleEvent())).toMatchObject({
      title: "ネタライブ",
      allDay: false,
      venue: "下北沢",
      doorsAt: "18:45",
      openAt: "19:00",
      price: "1,500円",
    });
  });

  it.each(["private", "confidential"])("公開設定が %s の予定を除外する", (visibility) => {
    expect(toLiveEvent(googleEvent({ visibility }))).toBeNull();
  });

  it("カレンダーの場所が空なら説明欄の会場を使う", () => {
    expect(
      toLiveEvent(googleEvent({ location: undefined, description: "会場: 下北沢某劇場" }))?.venue,
    ).toBe("下北沢某劇場");
    expect(toLiveEvent(googleEvent({ description: "会場: 新宿某劇場" }))?.venue).toBe("下北沢");
  });

  it("説明欄に料金がなければライブ名から料金を補う", () => {
    expect(toLiveEvent(googleEvent({ summary: "下北GRIP", description: "" }))?.price).toBe("無料");
    expect(toLiveEvent(googleEvent({ summary: "下北ＧＲＩＰ vol.3", description: "" }))?.price).toBe(
      "無料",
    );
    expect(toLiveEvent(googleEvent({ summary: "Rags to Riches", description: "" }))?.price).toBe(
      "500円",
    );
    expect(toLiveEvent(googleEvent({ description: "" }))?.price).toBeNull();
  });

  it("説明欄の料金をライブ名の料金より優先する", () => {
    expect(toLiveEvent(googleEvent({ summary: "下北GRIP 特別編" }))?.price).toBe("1,500円");
  });

  it("Google マップの場所は名前だけにする", () => {
    expect(
      toLiveEvent(googleEvent({ location: "下北ZAWAZAWA, 日本、〒155-0031 東京都世田谷区" }))?.venue,
    ).toBe("下北ZAWAZAWA");
    expect(toLiveEvent(googleEvent({ location: "日本、〒155-0031 東京都" }))?.venue).toBe(
      "日本、〒155-0031 東京都",
    );
  });

  it("タイトルのない予定を除外する", () => {
    expect(toLiveEvent(googleEvent({ summary: undefined }))).toBeNull();
    expect(toLiveEvent(googleEvent({ summary: "  " }))).toBeNull();
  });

  it("中止された予定を除外する", () => {
    expect(toLiveEvent(googleEvent({ status: "cancelled" }))).toBeNull();
  });

  it("終日の予定を日付のまま保持する", () => {
    const event = toLiveEvent(
      googleEvent({ start: { date: "2026-11-03" }, end: { date: "2026-11-04" } }),
    );
    expect(event).toMatchObject({ allDay: true, start: "2026-11-03", end: "2026-11-04" });
  });
});

describe("getSchedule", () => {
  it("取得結果をキャッシュし、10 分以内は Google を呼ばない", async () => {
    const d = deps();
    await getSchedule("upcoming", d);
    const result = await getSchedule("upcoming", {
      ...d,
      now: new Date(NOW.getTime() + 9 * 60 * 1000),
    });
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", stale: false });
  });

  it("10 分を過ぎたら取得し直す", async () => {
    const d = deps();
    await getSchedule("upcoming", d);
    await getSchedule("upcoming", { ...d, now: new Date(NOW.getTime() + 10 * 60 * 1000) });
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it("取得に失敗したら古いキャッシュを stale として返す", async () => {
    const d = deps();
    await getSchedule("upcoming", d);
    const result = await getSchedule("upcoming", {
      ...d,
      fetch: vi.fn(async () => new Response("", { status: 500 })),
      now: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
    expect(result).toMatchObject({ status: "ok", stale: true });
  });

  it("取得に失敗してキャッシュもなければエラーを返す", async () => {
    const result = await getSchedule(
      "upcoming",
      deps({ fetch: vi.fn(async () => new Response("", { status: 500 })) }),
    );
    expect(result).toEqual({ status: "error" });
  });

  it("エラーのログに API キーを含めない", async () => {
    const log = vi.spyOn(console, "error");
    await getSchedule(
      "upcoming",
      deps({
        fetch: vi.fn(async () => {
          throw new Error("network down");
        }),
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-key");
  });

  it("キャッシュの読み書きに失敗しても予定を返す", async () => {
    const result = await getSchedule(
      "upcoming",
      deps({
        cache: {
          get: async () => {
            throw new Error("read failed");
          },
          put: async () => {
            throw new Error("limit exceeded");
          },
        },
      }),
    );
    expect(result).toMatchObject({ status: "ok", stale: false });
  });

  it("古いキャッシュでも終わったライブを今後の一覧に出さない", async () => {
    const d = deps();
    await getSchedule("upcoming", d);
    const result = await getSchedule("upcoming", {
      ...d,
      fetch: vi.fn(async () => new Response("", { status: 500 })),
      now: new Date("2026-11-04T00:00:00+09:00"),
    });
    expect(result).toMatchObject({ status: "ok", stale: true, events: [] });
  });

  it("過去のライブを新しい順に返し、開催中のものを含めない", async () => {
    const result = await getSchedule(
      "past",
      deps({
        fetch: vi.fn(async () =>
          Response.json({
            items: [
              googleEvent({
                id: "old",
                start: { dateTime: "2026-10-01T19:00:00+09:00" },
                end: { dateTime: "2026-10-01T21:00:00+09:00" },
              }),
              googleEvent({
                id: "new",
                start: { dateTime: "2026-10-20T19:00:00+09:00" },
                end: { dateTime: "2026-10-20T21:00:00+09:00" },
              }),
              googleEvent({
                id: "ongoing",
                start: { dateTime: "2026-11-02T11:00:00+09:00" },
                end: { dateTime: "2026-11-02T13:00:00+09:00" },
              }),
            ],
          }),
        ),
      }),
    );
    expect(result.status === "ok" && result.events.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("指定した月の範囲を東京時間で問い合わせる", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ items: [] }));
    await getSchedule({ month: "2026-12" }, deps({ fetch: fetchMock }));
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.searchParams.get("timeMin")).toBe("2026-12-01T00:00:00+09:00");
    expect(url.searchParams.get("timeMax")).toBe("2027-01-01T00:00:00+09:00");
    expect(url.searchParams.get("singleEvents")).toBe("true");
  });

  it("続きのページも取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [googleEvent()], nextPageToken: "next" }))
      .mockResolvedValueOnce(Response.json({ items: [googleEvent({ id: "b" })] }));
    const result = await getSchedule("upcoming", deps({ fetch: fetchMock }));
    expect(result.status === "ok" && result.events).toHaveLength(2);
  });
});

describe("clearSchedule", () => {
  it("消去したあとは 10 分以内でも取得し直す", async () => {
    const d = deps();
    await getSchedule("upcoming", d);
    const later = new Date(NOW.getTime() + 60 * 1000);
    expect(await clearSchedule({ ...d, now: later })).toEqual({ status: "cleared" });
    await getSchedule("upcoming", { ...d, now: later });
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it("5 分以内は続けて消去できない", async () => {
    const d = deps();
    await clearSchedule(d);
    expect(await clearSchedule({ ...d, now: new Date(NOW.getTime() + 4 * 60 * 1000) })).toEqual({
      status: "too-soon",
      retryAfterSeconds: 60,
    });
    expect(await clearSchedule({ ...d, now: new Date(NOW.getTime() + 5 * 60 * 1000) })).toEqual({
      status: "cleared",
    });
  });
});
