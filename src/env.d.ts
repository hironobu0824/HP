// シークレットは wrangler.jsonc に書かないため、型をここで宣言する
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CALENDAR_API_KEY: string;
    GOOGLE_CALENDAR_ID: string;
  }
}
