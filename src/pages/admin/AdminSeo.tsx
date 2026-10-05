import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

const inputCls =
  "w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] bg-white";
const labelCls = "block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wide";

type SeoForm = {
  pageKey: string;
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  canonicalUrl: string;
  robots: string;
};

const EMPTY: SeoForm = {
  pageKey: "",
  title: "",
  description: "",
  keywords: "",
  ogImage: "",
  canonicalUrl: "",
  robots: "index,follow",
};

function SeoCard({
  initial,
  isNew,
  onDone,
}: {
  initial: SeoForm;
  isNew?: boolean;
  onDone: () => void;
}) {
  const [form, setForm] = useState<SeoForm>(initial);
  useEffect(() => setForm(initial), [initial]);

  const upsert = trpc.seo.upsert.useMutation({
    onSuccess: () => {
      toast.success(`SEO saved for "${form.pageKey}"`);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.seo.remove.useMutation({
    onSuccess: () => {
      toast.success("SEO entry deleted");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (k: keyof SeoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#FFEBEE] rounded-xl flex items-center justify-center">
            <Globe size={16} className="text-[#E53935]" />
          </div>
          {isNew ? (
            <input
              className={`${inputCls} !w-56 font-semibold`}
              placeholder="page-key e.g. home, blog"
              value={form.pageKey}
              onChange={set("pageKey")}
            />
          ) : (
            <div>
              <p className="font-bold">{form.pageKey}</p>
              <p className="text-xs text-[#999]">
                {form.pageKey === "home" ? "/" : `/${form.pageKey}`}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => {
                if (window.confirm(`Delete SEO settings for "${form.pageKey}"?`))
                  remove.mutate({ pageKey: form.pageKey });
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-[#999] hover:text-[#E53935] hover:bg-[#FFEBEE]"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => {
              if (!form.pageKey.trim()) {
                toast.error("Page key is required");
                return;
              }
              upsert.mutate({
                pageKey: form.pageKey.trim(),
                title: form.title || null,
                description: form.description || null,
                keywords: form.keywords || null,
                ogImage: form.ogImage || null,
                canonicalUrl: form.canonicalUrl || null,
                robots: form.robots || "index,follow",
              });
            }}
            disabled={upsert.isPending}
            className="flex items-center gap-2 bg-[#E53935] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#C62828] disabled:opacity-50"
          >
            <Save size={15} />
            Save
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Meta Title</label>
          <input className={inputCls} value={form.title} onChange={set("title")} maxLength={255} />
          <p className="text-xs text-[#999] mt-1">{form.title.length}/60 recommended</p>
        </div>
        <div>
          <label className={labelCls}>Keywords</label>
          <input className={inputCls} value={form.keywords} onChange={set("keywords")} placeholder="comma, separated, keywords" />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Meta Description</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={set("description")} maxLength={500} />
          <p className="text-xs text-[#999] mt-1">{form.description.length}/160 recommended</p>
        </div>
        <div>
          <label className={labelCls}>OG Image URL</label>
          <input className={inputCls} value={form.ogImage} onChange={set("ogImage")} placeholder="/images/banner-delivery.jpg" />
        </div>
        <div>
          <label className={labelCls}>Canonical URL</label>
          <input className={inputCls} value={form.canonicalUrl} onChange={set("canonicalUrl")} placeholder="https://storex.example.com/" />
        </div>
        <div>
          <label className={labelCls}>Robots</label>
          <select className={inputCls} value={form.robots} onChange={set("robots")}>
            <option value="index,follow">index, follow</option>
            <option value="noindex,follow">noindex, follow</option>
            <option value="index,nofollow">index, nofollow</option>
            <option value="noindex,nofollow">noindex, nofollow</option>
          </select>
        </div>
      </div>

      {/* Search preview */}
      {form.title && (
        <div className="mt-5 bg-[#FAFAFA] rounded-xl p-4 border border-[#F0F0F0]">
          <p className="text-xs text-[#999] mb-1.5 font-semibold uppercase tracking-wide">Search preview</p>
          <p className="text-[#1a0dab] text-base leading-snug">{form.title}</p>
          <p className="text-[#006621] text-xs mt-0.5">storex.eg {form.pageKey === "home" ? "" : `› ${form.pageKey}`}</p>
          <p className="text-[#545454] text-xs mt-1 leading-relaxed">{form.description}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminSeo() {
  const utils = trpc.useUtils();
  const { data: pages, isLoading } = trpc.seo.listAll.useQuery();
  const [showNew, setShowNew] = useState(false);

  const refresh = () => {
    utils.seo.listAll.invalidate();
    setShowNew(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">SEO Settings</h1>
          <p className="text-sm text-[#666] mt-1">
            Configure meta titles, descriptions and social cards per page. Blog
            posts can override these individually.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#E53935] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#C62828]"
        >
          <Plus size={16} />
          Add Page
        </button>
      </div>

      <div className="space-y-5">
        {showNew && <SeoCard initial={EMPTY} isNew onDone={refresh} />}
        {isLoading ? (
          <p className="text-sm text-[#999]">Loading…</p>
        ) : (
          pages?.map((p) => (
            <SeoCard
              key={p.id}
              initial={{
                pageKey: p.pageKey,
                title: p.title ?? "",
                description: p.description ?? "",
                keywords: p.keywords ?? "",
                ogImage: p.ogImage ?? "",
                canonicalUrl: p.canonicalUrl ?? "",
                robots: p.robots ?? "index,follow",
              }}
              onDone={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
