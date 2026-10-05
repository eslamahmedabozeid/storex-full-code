import { sql } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { blogPosts, seoSettings, siteContent } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // ---- Blog posts ----
  await db
    .insert(blogPosts)
    .values([
      {
        title: "Ramadan Essentials: Your Complete Iftar Shopping Guide",
        slug: "ramadan-essentials-iftar-shopping-guide",
        excerpt:
          "From dates and qamar el din to last-minute dessert runs — here is how to stock your kitchen for the holy month without the supermarket chaos.",
        content: `# Ramadan Essentials: Your Complete Iftar Shopping Guide

Ramadan in Cairo means two things: beautiful family gatherings — and supermarket lines that stretch around the block an hour before Maghrib. This year, skip the chaos.

## Stock Up Early on the Staples

The smart move is ordering your non-perishables in the first week:

- **Dates** — Medjool, Agwa, or classic Siwi dates for iftar
- **Qamar El Din** — the apricot drink no Ramadan table is complete without
- **Rice, lentils, and pasta** — the backbone of every soup and main dish
- **Cooking oil and ghee** — you will go through more than you think

## The 5 PM Emergency

We have all been there. Guests are coming, the table is set, and you realize you forgot the konafa. With StoreX, essentials reach your door in **30-60 minutes** across Cairo — even during the pre-iftar rush.

## Fresh Daily, Even in Ramadan

Our teams restock fresh produce, baladi bread, and dairy every morning. Order before noon and your vegetables arrive crisp, cold, and ready for the pot.

**Pro tip:** build a weekly essentials list in the app and reorder with one tap every Sunday. Your future self will thank you.`,
        coverImage: "/images/banner-ramadan.jpg",
        tags: "ramadan,guides,seasonal",
        status: "published",
        seoTitle: "Ramadan Iftar Shopping Guide 2026 | StoreX Cairo",
        seoDescription:
          "Complete Ramadan grocery checklist for Cairo: dates, qamar el din, fresh produce and last-minute iftar essentials delivered in 30-60 minutes.",
        publishedAt: new Date("2026-02-20T10:00:00Z"),
      },
      {
        title: "5 Ways to Cut Your Weekly Grocery Bill in Cairo",
        slug: "5-ways-cut-weekly-grocery-bill-cairo",
        excerpt:
          "Smart bundling, app-only deals, and timing your orders right — practical tips that save the average Cairo household hundreds of pounds a month.",
        content: `# 5 Ways to Cut Your Weekly Grocery Bill in Cairo

Grocery prices keep climbing, but your bill does not have to. Here are five habits that consistently save our customers money.

## 1. Chase the Free Delivery Threshold

Delivery fees add up. Group smaller orders into one weekly order that clears the free-delivery minimum — most households save **200+ EGP a month** on fees alone.

## 2. Buy the Bundle, Not the Item

Water is the classic example: a single 1.5L bottle costs noticeably more per liter than a 6-pack. The same logic applies to rice, oil, and cleaning supplies.

## 3. Shop App-Only Flash Deals

Every day we discount 20-40 items exclusively in the app. Check the deals section before you checkout — swapping one brand for the deal alternative often cuts 10-15% off the total.

## 4. Fresh Does Not Mean Expensive

Local seasonal produce is cheaper **and** fresher than imported. Egyptian mangoes in summer, baladi oranges in winter — let the season set your fruit bowl.

## 5. Reorder, Do not Re-browse

Impulse adds are the silent budget killer. Use your order history to reorder exactly what you need — nothing more.`,
        coverImage: "/images/banner-fresh.jpg",
        tags: "savings,tips",
        status: "published",
        seoTitle: "Save Money on Groceries in Cairo — 5 Proven Tips | StoreX",
        seoDescription:
          "Cut your weekly grocery bill in Cairo with free-delivery thresholds, bundle buying, app flash deals, seasonal produce and smart reordering.",
        publishedAt: new Date("2026-02-27T10:00:00Z"),
      },
      {
        title: "Meet Your Rider: How 30-Minute Delivery Actually Works",
        slug: "meet-your-rider-30-minute-delivery",
        excerpt:
          "Behind every StoreX order is a dark store, a picker, and a rider racing the clock. Here is the journey your groceries take from shelf to doorstep.",
        content: `# Meet Your Rider: How 30-Minute Delivery Actually Works

You tap "checkout" and 34 minutes later a rider hands you cold milk and fresh bread. It feels like magic. It is actually logistics.

## Step 1: The Dark Store (0-3 min)

Your order pings the nearest StoreX micro-fulfillment center — small warehouses placed inside Cairo neighborhoods, stocked with the 10,000 products locals buy most.

## Step 2: Picking & Packing (3-10 min)

A picker walks a route optimized by our system, scanning every item. Cold chain products go into insulated bags last, so your ice cream survives July.

## Step 3: The Rider (10-30 min)

Our riders know their zones street by street. The app gives them the fastest route, and gives **you** a live map with a real ETA — no guessing.

## Why It Matters

Speed is not a gimmick. It means fresh food stays fresh, emergencies get solved, and grocery shopping fits into your day instead of consuming it.

Next time your order arrives, give your rider a smile — they earned it.`,
        coverImage: "/images/delivery-hero.jpg",
        tags: "behind-the-scenes,delivery",
        status: "published",
        seoTitle: "How StoreX Delivers Groceries in 30 Minutes | Cairo Q-Commerce",
        seoDescription:
          "Inside StoreX's 30-minute grocery delivery in Cairo: dark stores, smart picking routes, and riders with live tracking from checkout to doorstep.",
        publishedAt: new Date("2026-03-05T10:00:00Z"),
      },
      {
        title: "Baby Essentials Checklist for New Parents in Egypt",
        slug: "baby-essentials-checklist-new-parents-egypt",
        excerpt:
          "Diapers, formula, wipes and the things nobody tells you about — a practical checklist built with Cairo parents, delivered when you need it most.",
        content: `# Baby Essentials Checklist for New Parents in Egypt

Nothing tests a delivery service like a newborn. Here is the checklist Cairo parents actually use.

## The Non-Negotiables

- **Diapers** — size up sooner than you think; babies outgrow newborn sizes fast
- **Wipes** — buy the multipack, always
- **Formula & bottles** — keep one backup container sealed for emergencies
- **Diaper rash cream** — you will need it at 2 AM, not 2 PM

## The "Nobody Told Me" List

- Extra burp cloths (double whatever you planned)
- A second bottle brush
- Laundry detergent for sensitive skin

## The 2 AM Problem

Running out of diapers at midnight used to mean a desperate pharmacy run. With StoreX, baby essentials are a tap away with **Cash on Delivery** — no card, no stress, no leaving the baby.

Bookmark this checklist. Share it with a new parent. They will need it.`,
        coverImage: "/images/cat-baby.jpg",
        tags: "baby,family,guides",
        status: "draft",
        seoTitle: "Newborn Essentials Checklist Egypt | StoreX Baby Delivery",
        seoDescription:
          "Complete baby essentials checklist for new parents in Egypt: diapers, formula, wipes and midnight emergencies delivered fast with cash on delivery.",
        publishedAt: null,
      },
    ])
    .onDuplicateKeyUpdate({ set: { title: sql`values(title)` } });

  // ---- SEO settings ----
  await db
    .insert(seoSettings)
    .values([
      {
        pageKey: "home",
        title: "StoreX — Groceries Delivered in 30-60 Minutes | Cairo",
        description:
          "Order fresh produce, daily essentials and household items from StoreX. Fast grocery delivery across Cairo in 30-60 minutes. Cash on delivery available.",
        keywords:
          "grocery delivery cairo, online supermarket egypt, storex, fast delivery, fresh groceries",
        ogImage: "/images/banner-delivery.jpg",
        robots: "index,follow",
      },
      {
        pageKey: "blog",
        title: "StoreX Blog — Grocery Tips, Guides & Cairo Life",
        description:
          "Practical grocery guides, savings tips, seasonal shopping checklists and behind-the-scenes stories from Cairo's fastest grocery delivery.",
        keywords: "grocery tips cairo, shopping guide egypt, storex blog",
        ogImage: "/images/fresh-groceries.jpg",
        robots: "index,follow",
      },
    ])
    .onDuplicateKeyUpdate({ set: { title: sql`values(title)` } });

  // ---- Site content ----
  await db
    .insert(siteContent)
    .values([
      {
        key: "announcement_bar",
        label: "Announcement Bar (shown on blog header)",
        value: "Free delivery on your first order — download the StoreX app today",
      },
      {
        key: "whatsapp_number",
        label: "WhatsApp Support Number",
        value: "201000695651",
      },
      {
        key: "blog_hero_title",
        label: "Blog Page Title",
        value: "The StoreX Blog",
      },
      {
        key: "blog_hero_subtitle",
        label: "Blog Page Subtitle",
        value:
          "Grocery hacks, Cairo stories, and everything happening inside your favorite delivery app.",
      },
    ])
    .onDuplicateKeyUpdate({ set: { value: sql`values(value)` } });

  console.log("Done.");
  process.exit(0);
}

seed();
