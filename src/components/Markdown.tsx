import React from "react";

/** Render inline **bold** and *italic* markers */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#1A1A1A]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Minimal markdown renderer: headings, lists, quotes, paragraphs, bold/italic */
export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key++} className="list-disc pl-6 space-y-2 my-4 text-[#444]">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }
    flushList();

    if (!trimmed) continue;

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="text-xl font-bold mt-8 mb-3 text-[#1A1A1A]">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="text-2xl font-extrabold mt-10 mb-4 text-[#1A1A1A]">
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="text-3xl font-extrabold mt-10 mb-4 text-[#1A1A1A]">
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
    } else if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-4 border-[#E53935] pl-4 my-4 text-[#666] italic"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={key++} className="my-4 leading-relaxed text-[#444]">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }
  flushList();

  return <div>{blocks}</div>;
}
