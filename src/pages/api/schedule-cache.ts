import type { APIRoute } from "astro";
import { clearScheduleCache } from "../../lib/schedule";

export const prerender = false;

export const DELETE: APIRoute = async () => {
  const result = await clearScheduleCache();
  if (result.status === "too-soon") {
    return Response.json(result, {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    });
  }
  return Response.json(result);
};
