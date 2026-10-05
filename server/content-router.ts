import { z } from "zod";
import { eq } from "drizzle-orm";
import { siteContent } from "@db/schema";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";

export const contentRouter = createRouter({
  // ---- Public ----
  all: publicQuery.query(async () => {
    const rows = await getDb().select().from(siteContent);
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  }),

  // ---- Admin ----
  listAll: adminQuery.query(async () => {
    return getDb().select().from(siteContent);
  }),

  upsert: adminQuery
    .input(
      z.object({
        key: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
        label: z.string().max(255).optional().nullable(),
        value: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .insert(siteContent)
        .values({
          key: input.key,
          label: input.label ?? null,
          value: input.value ?? null,
        })
        .onDuplicateKeyUpdate({
          set: { label: input.label ?? null, value: input.value ?? null },
        });
      return getDb().query.siteContent.findFirst({
        where: eq(siteContent.key, input.key),
      });
    }),

  remove: adminQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      await getDb().delete(siteContent).where(eq(siteContent.key, input.key));
      return { ok: true };
    }),
});
