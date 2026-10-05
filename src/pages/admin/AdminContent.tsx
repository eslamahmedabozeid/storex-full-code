import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

const inputCls =
  "w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E53935]/30 focus:border-[#E53935] bg-white";
const labelCls = "block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wide";

function ContentRow({
  cKey,
  label,
  value,
  isNew,
  onDone,
}: {
  cKey: string;
  label: string;
  value: string;
  isNew?: boolean;
  onDone: () => void;
}) {
  const [k, setK] = useState(cKey);
  const [l, setL] = useState(label);
  const [v, setV] = useState(value);

  const upsert = trpc.content.upsert.useMutation({
    onSuccess: () => {
      toast.success(`Saved "${k}"`);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.content.remove.useMutation({
    onSuccess: () => {
      toast.success("Content key deleted");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-start">
        <div>
          <label className={labelCls}>Key</label>
          <input
            className={`${inputCls} font-mono text-[13px]`}
            value={k}
            onChange={(e) => setK(e.target.value)}
            placeholder="announcement_bar"
            disabled={!isNew}
          />
          <input
            className={`${inputCls} mt-2`}
            value={l}
            onChange={(e) => setL(e.target.value)}
            placeholder="Human-friendly label"
          />
        </div>
        <div>
          <label className={labelCls}>Value</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
        </div>
        <div className="flex md:flex-col gap-2">
          <button
            onClick={() => {
              if (!/^[a-z0-9_]+$/.test(k.trim())) {
                toast.error("Key: lowercase letters, numbers, underscores only");
                return;
              }
              upsert.mutate({ key: k.trim(), label: l || null, value: v || null });
            }}
            disabled={upsert.isPending}
            className="flex items-center gap-1.5 bg-[#E53935] text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-[#C62828] disabled:opacity-50"
          >
            <Save size={13} />
            Save
          </button>
          {!isNew && (
            <button
              onClick={() => {
                if (window.confirm(`Delete content key "${k}"?`)) remove.mutate({ key: k });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl text-[#999] hover:text-[#E53935] hover:bg-[#FFEBEE]"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminContent() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.content.listAll.useQuery();
  const [showNew, setShowNew] = useState(false);

  const refresh = () => {
    utils.content.listAll.invalidate();
    utils.content.all.invalidate();
    setShowNew(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">Site Content</h1>
          <p className="text-sm text-[#666] mt-1">
            Editable text snippets used across the site — announcement bars,
            contact numbers, page headings.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#E53935] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#C62828]"
        >
          <Plus size={16} />
          Add Key
        </button>
      </div>

      <div className="space-y-4">
        {showNew && <ContentRow cKey="" label="" value="" isNew onDone={refresh} />}
        {isLoading ? (
          <p className="text-sm text-[#999]">Loading…</p>
        ) : (
          items?.map((c) => (
            <ContentRow
              key={c.id}
              cKey={c.key}
              label={c.label ?? ""}
              value={c.value ?? ""}
              onDone={refresh}
            />
          ))
        )}
      </div>
    </div>
  );
}
