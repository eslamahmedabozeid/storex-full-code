import { z } from "zod";
import { eq } from "drizzle-orm";
import { seoSettings } from "@db/schema";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";

const seoInput = z.object({
  pageKey: z.string().min(1).max(100),
  title: z.string().max(255).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  keywords: z.string().max(500).optional().nullable(),
  ogImage: z.string().optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  robots: z.string().max(100).optional().nullable(),
});

export const seoRouter = createRouter({
  // ---- Public ----
  get: publicQuery
    .input(z.object({ pageKey: z.string() }))
    .query(async ({ input }) => {
      const row = await getDb().query.seoSettings.findFirst({
        where: eq(seoSettings.pageKey, input.pageKey),
      });
      return row ?? null;
    }),

  // ---- Admin ----
  listAll: adminQuery.query(async () => {
    return getDb().select().from(seoSettings);
  }),

  upsert: adminQuery.input(seoInput).mutation(async ({ input }) => {
    await getDb()
      .insert(seoSettings)
      .values({
        pageKey: input.pageKey,
        title: input.title ?? null,
        description: input.description ?? null,
        keywords: input.keywords ?? null,
        ogImage: input.ogImage ?? null,
        canonicalUrl: input.canonicalUrl ?? null,
        robots: input.robots ?? "index,follow",
      })
      .onDuplicateKeyUpdate({
        set: {
          title: input.title ?? null,
          description: input.description ?? null,
          keywords: input.keywords ?? null,
          ogImage: input.ogImage ?? null,
          canonicalUrl: input.canonicalUrl ?? null,
          robots: input.robots ?? "index,follow",
        },
      });
    return getDb().query.seoSettings.findFirst({
      where: eq(seoSettings.pageKey, input.pageKey),
    });
  }),

  remove: adminQuery
    .input(z.object({ pageKey: z.string() }))
    .mutation(async ({ input }) => {
      await getDb()
        .delete(seoSettings)
        .where(eq(seoSettings.pageKey, input.pageKey));
      return { ok: true };
    }),
});
