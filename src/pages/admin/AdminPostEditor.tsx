import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

const SITE_IMAGES = [
  "/images/banner-ramadan.jpg",
  "/images/banner-fresh.jpg",
  "/images/banner-delivery.jpg",
  "/images/delivery-hero.jpg",
  "/images/fresh-groceries.jpg",
  "/images/cat-baby.jpg",
  "/images/cat-beverages.jpg",
  "/images/cat-breakfast.jpg",
  "/images/cat-dairy.jpg",
  "/images/cat-food.jpg",
  "/images/cat-fresh.jpg",
  "/images/cat-household.jpg",
  "/images/cat-snacks.jpg",
];

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

const inputCls =
  "w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] bg-white";
const labelCls = "block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wide";

export default function AdminPostEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: existing, isLoading } = trpc.blog.byId.useQuery(
    { id: Number(id) },
    { enabled: !isNew },
  );

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setSlugTouched(true);
      setExcerpt(existing.excerpt ?? "");
      setContent(existing.content ?? "");
      setCoverImage(existing.coverImage ?? "");
      setTags(existing.tags ?? "");
      setStatus(existing.status);
      setSeoTitle(existing.seoTitle ?? "");
      setSeoDescription(existing.seoDescription ?? "");
    }
  }, [existing]);

  const onSaved = () => {
    utils.blog.listAll.invalidate();
    utils.blog.list.invalidate();
    utils.admin.stats.invalidate();
    toast.success(isNew ? "Post created" : "Post saved");
    navigate("/admin/posts");
  };

  const create = trpc.blog.create.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.blog.update.useMutation({
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  });

  const saving = create.isPending || update.isPending;

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const save = () => {
    if (title.trim().length < 3) {
      toast.error("Title must be at least 3 characters");
      return;
    }
    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || null,
      content: content || null,
      coverImage: coverImage.trim() || null,
      tags: tags.trim() || null,
      status,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
    };
    if (isNew) create.mutate(payload);
    else update.mutate({ id: Number(id), ...payload });
  };

  if (!isNew && isLoading) {
    return <div className="text-sm text-[#999]">Loading post…</div>;
  }

  return (
    <div className="max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/posts"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm text-[#666] hover:text-[#1A1A1A]"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold">{isNew ? "New Post" : "Edit Post"}</h1>
            {!isNew && existing && (
              <p className="text-xs text-[#999] mt-0.5">/blog/{existing.slug}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && existing?.status === "published" && (
            <Link
              to={`/blog/${existing.slug}`}
              target="_blank"
              className="flex items-center gap-2 text-sm font-semibold text-[#666] bg-white shadow-sm px-4 py-2.5 rounded-xl hover:text-[#1A1A1A]"
            >
              <Eye size={15} />
              Preview
            </Link>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-[#E53935] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#C62828] transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <label className={labelCls}>Title</label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Post title"
              />
            </div>
            <div>
              <label className={labelCls}>Slug (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#999] whitespace-nowrap">/blog/</span>
                <input
                  className={inputCls}
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="post-url-slug"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Excerpt</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                maxLength={500}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary shown on the blog list and used as default meta description"
              />
            </div>
            <div>
              <label className={labelCls}>Content (Markdown)</label>
              <textarea
                className={`${inputCls} font-mono text-[13px] leading-relaxed`}
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"# Heading\n\nWrite your article here…\n\n## Section\n\n- List item\n- **Bold** works too"}
              />
              <p className="text-xs text-[#999] mt-1.5">
                Supports # headings, - lists, **bold**, *italic*, &gt; quotes.
              </p>
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-sm">SEO (optional overrides)</h2>
            <div>
              <label className={labelCls}>SEO Title</label>
              <input
                className={inputCls}
                maxLength={255}
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={title || "Defaults to the post title"}
              />
              <p className="text-xs text-[#999] mt-1">{seoTitle.length}/60 recommended</p>
            </div>
            <div>
              <label className={labelCls}>SEO Description</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                maxLength={500}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder={excerpt || "Defaults to the excerpt"}
              />
              <p className="text-xs text-[#999] mt-1">{seoDescription.length}/160 recommended</p>
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <label className={labelCls}>Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(["draft", "published"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
                      status === s
                        ? s === "published"
                          ? "bg-[#2E7D32] text-white"
                          : "bg-[#FB8C00] text-white"
                        : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Tags (comma separated)</label>
              <input
                className={inputCls}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ramadan, guides, tips"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <label className={labelCls}>Cover Image</label>
            {coverImage && (
              <img
                src={coverImage}
                alt="Cover"
                className="w-full h-36 object-cover rounded-xl mb-3"
              />
            )}
            <input
              className={inputCls}
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="/images/… or https://…"
            />
            <p className="text-xs text-[#999] mt-2 mb-2">Or pick a site image:</p>
            <div className="grid grid-cols-4 gap-2">
              {SITE_IMAGES.map((img) => (
                <button
                  key={img}
                  onClick={() => setCoverImage(img)}
                  className={`rounded-lg overflow-hidden border-2 transition-colors ${
                    coverImage === img ? "border-[#E53935]" : "border-transparent hover:border-[#DDD]"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-12 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
