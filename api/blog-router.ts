import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { blogPosts } from "@db/schema";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

const postInput = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]),
  seoTitle: z.string().max(255).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
});

export const blogRouter = createRouter({
  // ---- Public ----
  list: publicQuery.query(async () => {
    return getDb()
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .orderBy(desc(blogPosts.publishedAt));
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const post = await getDb().query.blogPosts.findFirst({
        where: eq(blogPosts.slug, input.slug),
      });
      if (!post || post.status !== "published") return null;
      return post;
    }),

  // ---- Admin ----
  listAll: adminQuery.query(async () => {
    return getDb().select().from(blogPosts).orderBy(desc(blogPosts.updatedAt));
  }),

  byId: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getDb().query.blogPosts.findFirst({
        where: eq(blogPosts.id, input.id),
      });
    }),

  create: adminQuery.input(postInput).mutation(async ({ input }) => {
    const slug = slugify(input.slug?.trim() || input.title);
    const [{ id }] = await getDb()
      .insert(blogPosts)
      .values({
        ...input,
        slug,
        excerpt: input.excerpt ?? null,
        content: input.content ?? null,
        coverImage: input.coverImage ?? null,
        tags: input.tags ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        publishedAt: input.status === "published" ? new Date() : null,
      })
      .$returningId();
    return getDb().query.blogPosts.findFirst({ where: eq(blogPosts.id, id) });
  }),

  update: adminQuery
    .input(postInput.extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getDb().query.blogPosts.findFirst({
        where: eq(blogPosts.id, id),
      });
      if (!existing) throw new Error("Post not found");
      const slug = slugify(data.slug?.trim() || data.title);
      await getDb()
        .update(blogPosts)
        .set({
          ...data,
          slug,
          excerpt: data.excerpt ?? null,
          content: data.content ?? null,
          coverImage: data.coverImage ?? null,
          tags: data.tags ?? null,
          seoTitle: data.seoTitle ?? null,
          seoDescription: data.seoDescription ?? null,
          publishedAt:
            data.status === "published"
              ? (existing.publishedAt ?? new Date())
              : existing.publishedAt,
        })
        .where(eq(blogPosts.id, id));
      return getDb().query.blogPosts.findFirst({ where: eq(blogPosts.id, id) });
    }),

  remove: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(blogPosts).where(eq(blogPosts.id, input.id));
      return { ok: true };
    }),
});
