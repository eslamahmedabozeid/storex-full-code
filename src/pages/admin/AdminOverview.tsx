import { Link } from "react-router";
import { FileText, FileEdit, Globe, Settings2, Users, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function AdminOverview() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  const cards = [
    { icon: FileText, label: "Published Posts", value: stats?.published, color: "#2E7D32", bg: "#E8F5E9" },
    { icon: FileEdit, label: "Drafts", value: stats?.drafts, color: "#FB8C00", bg: "#FFF3E0" },
    { icon: Globe, label: "SEO Pages", value: stats?.seoPages, color: "#E53935", bg: "#FFEBEE" },
    { icon: Settings2, label: "Content Keys", value: stats?.contentKeys, color: "#1976D2", bg: "#E3F2FD" },
    { icon: Users, label: "Users", value: stats?.users, color: "#6A1B9A", bg: "#F3E5F5" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-[#666] mt-1">
            Manage your blog, SEO and site content from one place.
          </p>
        </div>
        <Link
          to="/admin/posts/new"
          className="flex items-center gap-2 bg-[#E53935] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#C62828] transition-colors"
        >
          <Plus size={16} />
          New Post
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: c.bg }}
            >
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <p className="text-2xl font-extrabold mt-3">
              {isLoading ? "—" : (c.value ?? 0)}
            </p>
            <p className="text-xs text-[#999] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Recently Updated Posts</h2>
          <Link to="/admin/posts" className="text-sm font-semibold text-[#E53935]">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-[#F0F0F0]">
          {isLoading ? (
            <div className="p-6 text-sm text-[#999]">Loading…</div>
          ) : !stats?.recentPosts.length ? (
            <div className="p-6 text-sm text-[#999]">No posts yet.</div>
          ) : (
            stats.recentPosts.map((p) => (
              <Link
                key={p.id}
                to={`/admin/posts/${p.id}/edit`}
                className="flex items-center gap-4 p-4 hover:bg-[#FAFAFA] transition-colors"
              >
                {p.coverImage && (
                  <img
                    src={p.coverImage}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{p.title}</p>
                  <p className="text-xs text-[#999] mt-0.5 truncate">/blog/{p.slug}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    p.status === "published"
                      ? "bg-[#E8F5E9] text-[#2E7D32]"
                      : "bg-[#FFF3E0] text-[#FB8C00]"
                  }`}
                >
                  {p.status}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
