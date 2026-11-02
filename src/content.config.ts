import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const item = z.object({ label: z.string(), value: z.string() });

const profile = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/profile" }),
  schema: z.object({
    items: z.array(item),
    members: z.array(
      z.object({ name: z.string(), position: z.string(), items: z.array(item) }),
    ),
  }),
});

export const collections = { profile };
