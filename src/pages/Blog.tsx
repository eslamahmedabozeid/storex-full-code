import { Link } from "react-router";
import { Calendar, Tag, ArrowRight, ArrowLeft } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Seo } from "@/components/Seo";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Blog() {
  const { data: posts, isLoading } = trpc.blog.list.useQuery();
  const { data: content } = trpc.content.all.useQuery();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] font-sans antialiased">
      <Seo
        pageKey="blog"
        fallbacks={{
          title: "StoreX Blog — Grocery Tips, Guides & Cairo Life",
          description:
            "Practical grocery guides, savings tips and stories from Cairo's fastest grocery delivery.",
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-[#F0F0F0] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/storex-logo.png" alt="StoreX" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-[#666] hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to StoreX
          </Link>
        </div>
      </header>

      {/* Announcement */}
      {content?.announcement_bar && (
        <div className="bg-[#E53935] text-white text-center text-sm py-2 px-4">
          {content.announcement_bar}
        </div>
      )}

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-12 pb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          {content?.blog_hero_title || "The StoreX Blog"}
        </h1>
        <p className="text-lg text-[#666] mt-3 max-w-2xl">
          {content?.blog_hero_subtitle ||
            "Grocery hacks, Cairo stories, and everything happening inside your favorite delivery app."}
        </p>
      </section>

      {/* Posts */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-20">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-[#EEE]" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-[#EEE] rounded w-3/4" />
                  <div className="h-3 bg-[#EEE] rounded w-full" />
                  <div className="h-3 bg-[#EEE] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-20 text-[#999]">
            <p className="text-lg font-medium">No posts yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 group flex flex-col"
              >
                {post.coverImage ? (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-[#FFEBEE] to-[#FFF3E0] flex items-center justify-center">
                    <img src="/images/storex-logo.png" alt="" className="h-12 opacity-40" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-xs text-[#999] mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(post.publishedAt)}
                    </span>
                    {post.tags && (
                      <span className="flex items-center gap-1 text-[#E53935]">
                        <Tag size={12} />
                        {post.tags.split(",")[0]}
                      </span>
                    )}
                  </div>
                  <h2 className="font-bold text-lg leading-snug group-hover:text-[#E53935] transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-[#666] mt-2 leading-relaxed line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#E53935]">
                    Read more
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white/50 text-sm py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© 2026 StoreX Grocery. Cairo, Egypt.</p>
          <Link to="/" className="hover:text-white transition-colors">
            storex — groceries in 30-60 minutes
          </Link>
        </div>
      </footer>
    </div>
  );
}
