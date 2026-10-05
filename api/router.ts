import { authRouter } from "./auth-router";
import { blogRouter } from "./blog-router";
import { seoRouter } from "./seo-router";
import { contentRouter } from "./content-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  blog: blogRouter,
  seo: seoRouter,
  content: contentRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
