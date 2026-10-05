import { Link, useParams } from "react-router";
import { Calendar, Tag, ArrowLeft } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/components/Seo";
import { Markdown } from "@/components/Markdown";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = trpc.blog.bySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans antialiased">
      <Seo
        pageKey="blog"
        overrides={
          post
            ? {
                title: post.seoTitle || post.title,
                description: post.seoDescription || post.excerpt,
                ogImage: post.coverImage,
                keywords: post.tags,
              }
            : undefined
        }
        fallbacks={{ title: "StoreX Blog" }}
      />

      {/* Header */}
      <header className="bg-white border-b border-[#F0F0F0] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/storex-logo.png" alt="StoreX" className="h-8 w-auto" />
          </Link>
          <Link
            to="/blog"
            className="flex items-center gap-1.5 text-sm font-medium text-[#666] hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft size={16} />
            All posts
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12 animate-pulse space-y-4">
          <div className="h-8 bg-[#EEE] rounded w-3/4" />
          <div className="h-64 bg-[#EEE] rounded-2xl" />
          <div className="h-4 bg-[#EEE] rounded w-full" />
          <div className="h-4 bg-[#EEE] rounded w-5/6" />
        </div>
      ) : !post ? (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-24 text-center">
          <h1 className="text-2xl font-bold">Post not found</h1>
          <p className="text-[#666] mt-2">This article may have been unpublished or moved.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 mt-6 text-[#E53935] font-semibold"
          >
            <ArrowLeft size={16} />
            Back to the blog
          </Link>
        </div>
      ) : (
        <article className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <div className="flex items-center gap-3 text-sm text-[#999] mb-4">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(post.publishedAt)}
            </span>
            {post.tags && (
              <span className="flex items-center gap-1.5 text-[#E53935]">
                <Tag size={14} />
                {post.tags}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-lg text-[#666] mt-4 leading-relaxed">{post.excerpt}</p>
          )}

          {post.coverImage && (
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full rounded-2xl mt-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
            />
          )}

          <div className="mt-8">
            <Markdown content={post.content ?? ""} />
          </div>

          {/* CTA */}
          <div className="mt-14 bg-gradient-to-br from-[#FFF5F5] to-[#FFF8F0] rounded-2xl p-8 text-center border border-[#FFEBEE]">
            <h3 className="text-xl font-bold">Hungry yet?</h3>
            <p className="text-[#666] mt-2 text-sm">
              Groceries delivered across Cairo in 30-60 minutes. Cash on delivery.
            </p>
            <Link
              to="/"
              className="inline-block mt-4 bg-[#E53935] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#C62828] transition-colors"
            >
              Order with StoreX
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}
