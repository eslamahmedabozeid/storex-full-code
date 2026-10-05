import { count, desc, eq } from "drizzle-orm";
import { blogPosts, seoSettings, siteContent, users } from "@db/schema";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [[published], [drafts], [seoPages], [contentKeys], [userCount]] =
      await Promise.all([
        db
          .select({ n: count() })
          .from(blogPosts)
          .where(eq(blogPosts.status, "published")),
        db
          .select({ n: count() })
          .from(blogPosts)
          .where(eq(blogPosts.status, "draft")),
        db.select({ n: count() }).from(seoSettings),
        db.select({ n: count() }).from(siteContent),
        db.select({ n: count() }).from(users),
      ]);
    const recentPosts = await db
      .select()
      .from(blogPosts)
      .orderBy(desc(blogPosts.updatedAt))
      .limit(5);
    return {
      published: published.n,
      drafts: drafts.n,
      seoPages: seoPages.n,
      contentKeys: contentKeys.n,
      users: userCount.n,
      recentPosts,
    };
  }),
});
