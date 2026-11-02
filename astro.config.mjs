import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// 公開 URL。独自ドメインへ移行するときも SITE_URL の変更だけで済むようにする
const site = process.env.SITE_URL ?? "http://localhost:4321";

export default defineConfig({
  site,
  trailingSlash: "never",
  build: { format: "file" },
  session: false,
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith("/schedule/poster"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
