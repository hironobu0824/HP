import { monthRange, toTimestamp } from "./date";
import { parseDescription } from "./description";

export type LiveEvent = {
  id: string;
  title: string;
  allDay: boolean;
  start: string; // 終日: YYYY-MM-DD、それ以外: ISO 8601
  end: string; // 終日: YYYY-MM-DD（翌日）、それ以外: ISO 8601
  venue: string | null;
  doorsAt: string | null; // 開場時刻 HH:mm
  openAt: string | null; // 開演時刻 HH:mm（カレンダーの開始は入り時間のため説明欄から読む）
  closesAt: string | null; // 終演時刻 HH:mm
  price: string | null;
  ticketUrl: string | null; // http または https のみ
  description: string | null; // 上記以外の説明欄のプレーンテキスト
};

export type ScheduleRange = "upcoming" | "past" | { month: string };

export type ScheduleResult =
  | { status: "ok"; events: LiveEvent[]; fetchedAt: string; stale: boolean }
  | { status: "error" };

type CacheEntry = { events: LiveEvent[]; fetchedAt: string };

export type ScheduleCache = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
};

export type ScheduleDeps = {
  apiKey: string;
  calendarId: string;
  cache: ScheduleCache;
  fetch: typeof fetch;
  now: Date;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  visibility?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

const FRESH_MS = 10 * 60 * 1000;
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_PAGES = 4;
const REQUEST_TIMEOUT_MS = 5000;

// Google マップから選んだ場所は「名前, 日本、〒...」になるため、名前だけを表示する
function toVenue(location: string | undefined): string | null {
  const value = location?.trim();
  if (!value) return null;
  return value.split(/,\s*日本/)[0]?.trim() || value;
}

// 未発表のライブを出さないよう、非公開の予定とタイトルのない予定は除外する
export function toLiveEvent(item: GoogleEvent): LiveEvent | null {
  if (item.status === "cancelled") return null;
  if (item.visibility === "private" || item.visibility === "confidential") return null;

  const title = item.summary?.trim();
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;
  if (!item.id || !title || !start || !end) return null;

  const parsed = parseDescription(item.description);
  return {
    id: item.id,
    title,
    allDay: !item.start?.dateTime,
    start,
    end,
    ...parsed,
    // カレンダーの場所が空のときは、説明欄の「会場:」の行を使う
    venue: toVenue(item.location) ?? parsed.venue,
  };
}

function cacheKey(range: ScheduleRange): string {
  return typeof range === "string" ? `schedule:v6:${range}` : `schedule:v6:month:${range.month}`;
}

function timeWindow(range: ScheduleRange, now: Date): { timeMin: string; timeMax?: string } {
  if (range === "upcoming") return { timeMin: now.toISOString() };
  if (range === "past") {
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    return { timeMin: oneYearAgo.toISOString(), timeMax: now.toISOString() };
  }
  return monthRange(range.month);
}

async function fetchEvents(range: ScheduleRange, deps: ScheduleDeps): Promise<LiveEvent[]> {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(deps.calendarId)}/events`,
    );
    url.search = new URLSearchParams({
      key: deps.apiKey,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeZone: "Asia/Tokyo",
      ...timeWindow(range, deps.now),
      ...(pageToken ? { pageToken } : {}),
    }).toString();

    const response = await deps.fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Google Calendar API responded with ${response.status}`);

    const body = (await response.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    items.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }

  return items.flatMap((item) => toLiveEvent(item) ?? []);
}

// 古いキャッシュを返すときも、終わったライブが今後の一覧に残らないようにする
function selectEvents(events: LiveEvent[], range: ScheduleRange, now: Date): LiveEvent[] {
  if (range === "upcoming") return events.filter((e) => toTimestamp(e.end) > now.getTime());
  if (range === "past") {
    return events.filter((e) => toTimestamp(e.end) <= now.getTime()).reverse();
  }
  return events;
}

async function readCache(key: string, cache: ScheduleCache): Promise<CacheEntry | null> {
  try {
    const value = await cache.get(key);
    return value ? (JSON.parse(value) as CacheEntry) : null;
  } catch (error) {
    console.error("Failed to read the schedule cache", error);
    return null;
  }
}

export async function getSchedule(
  range: ScheduleRange,
  deps: ScheduleDeps,
): Promise<ScheduleResult> {
  const key = cacheKey(range);
  const cached = await readCache(key, deps.cache);
  const toResult = (entry: CacheEntry, stale: boolean): ScheduleResult => ({
    status: "ok",
    events: selectEvents(entry.events, range, deps.now),
    fetchedAt: entry.fetchedAt,
    stale,
  });

  if (cached && deps.now.getTime() - toTimestamp(cached.fetchedAt) < FRESH_MS) {
    return toResult(cached, false);
  }

  let entry: CacheEntry;
  try {
    entry = { events: await fetchEvents(range, deps), fetchedAt: deps.now.toISOString() };
  } catch (error) {
    // URL に API キーが含まれるため、エラーの内容だけを記録する
    console.error("Failed to fetch the schedule", error instanceof Error ? error.message : "");
    return cached ? toResult(cached, true) : { status: "error" };
  }

  try {
    await deps.cache.put(key, JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
  } catch (error) {
    // KV の書き込み上限に達しても、取得できた予定は表示する
    console.error("Failed to write the schedule cache", error);
  }
  return toResult(entry, false);
}
