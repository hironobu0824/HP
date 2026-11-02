const TIME_ZONE = "Asia/Tokyo";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTH_LIMIT = 12;

function tokyoParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

// 終日の予定は YYYY-MM-DD で届くため、東京の 0 時として扱う
function toDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value);
}

export function toTimestamp(value: string): number {
  return toDate(value).getTime();
}

export function formatDate(value: string): string {
  const { month, day, weekday } = tokyoParts(toDate(value));
  return `${month}/${day}（${WEEKDAYS[weekday]}）`;
}

export function formatYear(value: string): number {
  return tokyoParts(toDate(value)).year;
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

function monthIndex(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return (year ?? 0) * 12 + (m ?? 1) - 1;
}

function fromMonthIndex(index: number): string {
  const year = Math.floor(index / 12);
  return `${year}-${String(index - year * 12 + 1).padStart(2, "0")}`;
}

export function currentMonth(now: Date): string {
  const { year, month } = tokyoParts(now);
  return fromMonthIndex(year * 12 + month - 1);
}

export function shiftMonth(month: string, delta: number): string {
  return fromMonthIndex(monthIndex(month) + delta);
}

// 任意の月の指定で Google API の呼び出しを増やされないよう、当月の前後 12 か月に制限する
export function isAllowedMonth(month: string, now: Date): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  return Math.abs(monthIndex(month) - monthIndex(currentMonth(now))) <= MONTH_LIMIT;
}

export function monthRange(month: string): { timeMin: string; timeMax: string } {
  return {
    timeMin: `${month}-01T00:00:00+09:00`,
    timeMax: `${shiftMonth(month, 1)}-01T00:00:00+09:00`,
  };
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${year}年${m}月`;
}
