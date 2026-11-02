import { env } from "cloudflare:workers";
import { getSchedule, type ScheduleRange, type ScheduleResult } from "./calendar";

export function loadSchedule(range: ScheduleRange): Promise<ScheduleResult> {
  return getSchedule(range, {
    apiKey: env.GOOGLE_CALENDAR_API_KEY,
    calendarId: env.GOOGLE_CALENDAR_ID,
    cache: env.SCHEDULE_CACHE,
    fetch: (...args) => fetch(...args),
    now: new Date(),
  });
}
