import { Link } from "react-router";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPosts() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.blog.listAll.useQuery();

  const toggleStatus = trpc.blog.update.useMutation({
    onSuccess: () => {
      utils.blog.listAll.invalidate();
      utils.admin.stats.invalidate();
      toast.success("Post status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.blog.remove.useMutation({
    onSuccess: () => {
      utils.blog.listAll.invalidate();
      utils.admin.stats.invalidate();
      toast.success("Post deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">Blog Posts</h1>
          <p className="text-sm text-[#666] mt-1">
            Create, edit and publish articles for the StoreX blog.
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

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-[#999]">Loading…</div>
        ) : !posts?.length ? (
          <div className="p-12 text-center">
            <p className="text-[#999]">No posts yet.</p>
            <Link
              to="/admin/posts/new"
              className="inline-block mt-3 text-sm font-semibold text-[#E53935]"
            >
              Write your first post
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#999] border-b border-[#F0F0F0]">
                <th className="px-5 py-3 font-medium">Post</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Status</th>
                <th className="px-5 py-3 font-medium hidden lg:table-cell">Published</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F5]">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAFAFA]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.coverImage && (
                        <img
                          src={p.coverImage}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate max-w-[280px]">{p.title}</p>
                        <p className="text-xs text-[#999] truncate">/blog/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <button
                      onClick={() =>
                        toggleStatus.mutate({
                          id: p.id,
                          title: p.title,
                          slug: p.slug,
                          excerpt: p.excerpt,
                          content: p.content,
                          coverImage: p.coverImage,
                          tags: p.tags,
                          seoTitle: p.seoTitle,
                          seoDescription: p.seoDescription,
                          status: p.status === "published" ? "draft" : "published",
                        })
                      }
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        p.status === "published"
                          ? "bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9]"
                          : "bg-[#FFF3E0] text-[#FB8C00] hover:bg-[#FFE0B2]"
                      }`}
                      title="Click to toggle"
                    >
                      {p.status}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-[#666] hidden lg:table-cell">
                    {formatDate(p.publishedAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === "published" && (
                        <Link
                          to={`/blog/${p.slug}`}
                          target="_blank"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#999] hover:text-[#1A1A1A] hover:bg-[#F0F0F0]"
                          title="View"
                        >
                          <ExternalLink size={15} />
                        </Link>
                      )}
                      <Link
                        to={`/admin/posts/${p.id}/edit`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#999] hover:text-[#1A1A1A] hover:bg-[#F0F0F0]"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${p.title}"? This cannot be undone.`)) {
                            remove.mutate({ id: p.id });
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#999] hover:text-[#E53935] hover:bg-[#FFEBEE]"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
