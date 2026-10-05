import { useEffect } from "react";
import { trpc } from "@/providers/trpc";

function setMeta(
  attr: "name" | "property",
  key: string,
  content: string | null | undefined,
) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string | null | undefined) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export type SeoOverrides = {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
};

/**
 * Applies SEO meta to the document head.
 * - `pageKey` loads CMS-configured SEO from the database (e.g. "home", "blog")
 * - `overrides` (e.g. from a blog post's own SEO fields) win over page settings
 * - `fallbacks` are used when nothing is configured in the CMS
 */
export function Seo({
  pageKey,
  overrides,
  fallbacks,
}: {
  pageKey: string;
  overrides?: SeoOverrides;
  fallbacks?: SeoOverrides;
}) {
  const { data } = trpc.seo.get.useQuery({ pageKey });

  useEffect(() => {
    const merged: SeoOverrides = {
      title: overrides?.title ?? data?.title ?? fallbacks?.title,
      description:
        overrides?.description ?? data?.description ?? fallbacks?.description,
      keywords: overrides?.keywords ?? data?.keywords ?? fallbacks?.keywords,
      ogImage: overrides?.ogImage ?? data?.ogImage ?? fallbacks?.ogImage,
      canonicalUrl:
        overrides?.canonicalUrl ?? data?.canonicalUrl ?? fallbacks?.canonicalUrl,
      robots: overrides?.robots ?? data?.robots ?? fallbacks?.robots,
    };

    if (merged.title) document.title = merged.title;
    setMeta("name", "description", merged.description);
    setMeta("name", "keywords", merged.keywords);
    setMeta("name", "robots", merged.robots);
    setMeta("property", "og:title", merged.title);
    setMeta("property", "og:description", merged.description);
    setMeta("property", "og:image", merged.ogImage);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", merged.title);
    setMeta("name", "twitter:description", merged.description);
    setMeta("name", "twitter:image", merged.ogImage);
    setCanonical(merged.canonicalUrl);
  }, [data, overrides, fallbacks]);

  return null;
}
