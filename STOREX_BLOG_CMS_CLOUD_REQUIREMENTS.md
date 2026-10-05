# StoreX Blog/CMS — cloud requirements

**Audience:** client cloud / infrastructure team, and the team that administers the Kimi OAuth application  
**Send this file as-is.** When the work is finished, return `STOREX_BLOG_CMS_CLOUD_HANDOFF.md` as specified at the end. Do not reply with only “Done”.  
**Date of investigation:** 5 October 2026  
**This task does not change application code.** No code, `.env`, DNS, or database was modified to produce this document.

Verified facts come from the repository and from a non-destructive connectivity check of the current `DATABASE_URL`. Recommendations are labeled as such. Where the repository cannot answer a question, this document says so and assigns the decision to the cloud team.

---

## 1. Scope: static website vs Blog/CMS

The StoreX website is mostly static.

The public marketing pages (home and the sections inside it) are React pages compiled by Vite. Their visible copy, images, and layout do not come from MySQL. Those pages do not need a database in order to render.

The dynamic part of the project is the Blog/CMS:

| What | URL or procedure | Needs MySQL |
| --- | --- | --- |
| Public blog list | `/blog` → `blog.list` | Yes. This is the page that is failing now. |
| Public article | `/blog/:slug` → `blog.bySlug` | Yes |
| Admin sign-in | `/login` then `GET /api/oauth/callback` | Yes, to store the user |
| Admin area | `/admin` and child pages | Yes |
| Create a post | `blog.create` | Yes |
| Edit a post | `blog.update` | Yes |
| Save as draft | `status = draft` | Yes |
| Publish | `status = published` | Yes |
| Unpublish | Supported. The admin post list toggles `published` back to `draft`. Public `/blog` only shows `published`. | Yes |
| Delete a post | `blog.remove` | Yes |
| Blog / page SEO overrides | `seo.get`, `seo.listAll`, `seo.upsert`, `seo.remove` | Yes, table `seo_settings` |
| Editable hero / announcement text | `content.all` and the admin content procedures | Yes, table `site_content` |

Database and backend infrastructure are required for this Blog/CMS subsystem. They are not required for the static marketing pages to appear.

One precise exception, so it is not discovered later: the home page asks the API for optional SEO fields (`seo.get` with page key `home`). If that call fails, the page still renders using titles built into the frontend. The blog list does not have that fallback. Its articles exist only in MySQL.

---

## 2. Two stages, one infrastructure setup

### Stage 1 — current testing

The project is being tested on **Vercel**. The repository contains `vercel.json` and `api/[...path].js`. The current Vercel hostname is **not stored in the repository**. Take it from the Vercel project’s Production domain (the stable `*.vercel.app` hostname), not from a one-off Preview URL.

Stage 1 is successful only when **that Vercel deployment** can log in, write blog posts, and show them on `/blog`.

A test that only works from an Alibaba ECS machine inside the VPC is not success. The path that must work is:

```text
Current Vercel deployment
        ↓
application API (Hono / tRPC)
        ↓
final database connectivity solution
        ↓
MySQL
```

### Stage 2 — production domain

The final public website is already known:

```text
https://storex-app.com/
```

Later, the same application will be served on that domain. That move must be a normal application deployment (domain, build, environment variables that are domain-specific). It must **not** be a second cloud project.

After this task, the following must stay as they are when the hostname changes from the Vercel test URL to `https://storex-app.com/`:

- database product and schema
- Alibaba PrivateLink (it may remain the private path inside Alibaba; it must not be the only path Vercel has)
- database networking and firewall rules
- database user and password
- database endpoint the application uses
- cloud architecture

Domain-specific items that are already known must be prepared in this task. The final domain is not unknown. Do not leave an instruction of the form “contact us again when you know the production domain.”

The database endpoint must not depend on the website’s hostname. `storex-app.com` is only the public name of the website. It is not a database address.

---

## 3. Current verified problem

`/blog` loads the frontend shell. The post list does not arrive. This is a database network failure, not a missing React route.

Verified connection settings (no username or password):

| Item | Value |
| --- | --- |
| Variable | `DATABASE_URL` |
| Protocol | `mysql://` (MySQL protocol via `mysql2`) |
| Host | `ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com` |
| Port | `4000` |
| Database name | `1a106262-d752-8f79-8000-09c1ec5340b2` |
| TLS parameters on the URL | none |

Verified DNS and connectivity from the environment that is running the application today:

- The PrivateLink hostname resolves.
- The addresses returned are private: `10.128.173.123`, `10.128.106.223`, `10.128.8.197`.
- A MySQL connection to that host fails with **`connect ETIMEDOUT`**.
- `blog.list` then returns **HTTP 500** with Drizzle’s `Failed query` text for `blog_posts`. The SQL text does not mean the query was rejected. The TCP session never completed. The wait is about 10 seconds, which is the client connect timeout.

```text
Browser  GET /blog
    ↓
blog.list
    ↓
/api/trpc
    ↓
Drizzle ORM
    ↓
mysql2
    ↓
DATABASE_URL
    ↓
Alibaba PrivateLink hostname :4000
    ↓
private 10.128.x.x addresses
    ↓
ETIMEDOUT
    ↓
HTTP 500
```

What the visitor sees, verified in the blog page code:

- The page shell renders.
- Loading placeholders stay up while the client retries the failed request (the default client retries a failed query three more times).
- After retries, the page can show “No posts yet — check back soon.” That sentence is wrong for this failure. The blog is not known to be empty. The API failed.

A normal Vercel function is not inside this Alibaba VPC. It cannot route to `10.128.x.x`. The PrivateLink hostname, by itself, is not a usable database address for the current Vercel deployment.

---

## 4. Application architecture

Verified from the repository.

| Piece | What it is |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7. Static build output: `dist/public`. |
| Public blog UI | `src/pages/Blog.tsx`, `src/pages/BlogPost.tsx` |
| Admin UI | `src/pages/admin/*`, routes under `/admin` |
| API | One Hono application (`server/app.ts`) |
| API style | tRPC at `/api/trpc/*`. One non-tRPC route: `GET /api/oauth/callback`. |
| ORM | Drizzle ORM |
| Driver | `mysql2`. MySQL protocol over TCP. Not Postgres. Not Supabase. Not an HTTP database API. |
| Drizzle mode | `mode: "planetscale"` in `server/queries/connection.ts` |
| Auth | Kimi OAuth, then an HTTP-only cookie `kimi_sid` signed with `APP_SECRET` (HS256) |

**`mode: "planetscale"` does not mean PlanetScale, and it does not mean an HTTP connection.** The driver is still `mysql2`. Traffic is still the MySQL protocol to `DATABASE_URL`.

### How `/blog` gets data

The blog page calls three procedures in one batch to the same origin, `/api/trpc`:

1. `blog.list` — published rows from `blog_posts`
2. `content.all` — optional text from `site_content`
3. `seo.get` — optional meta tags from `seo_settings` for page key `blog`

The post cards come only from `blog.list`.

### How admin login works

1. `/login` sends the browser to `{VITE_KIMI_AUTH_URL}/api/oauth/authorize`.
2. The redirect URI is built in the browser as `{current origin}/api/oauth/callback` (`src/pages/Login.tsx`). It is not a fixed hostname in the source code.
3. Kimi returns to that callback with a `code`.
4. The server posts the code to `{KIMI_AUTH_URL}/api/oauth/token`, checks the access token using `{KIMI_AUTH_URL}/api/.well-known/jwks.json`, and loads the profile from `{KIMI_OPEN_URL}/v1/users/me/profile`.
5. The server inserts or updates `users`. If `unionId` equals `OWNER_UNION_ID`, `role` is set to `admin`.
6. The server sets cookie `kimi_sid` and redirects to `/`.

On any host that is not localhost, the cookie is `Secure` and `SameSite=None`. The site must be HTTPS. Both the Vercel URL and `https://storex-app.com/` satisfy that, as long as TLS is actually on.

### How admin CRUD reaches the database

Admin pages call tRPC mutations and queries. Those procedures use `adminQuery`, which requires a valid `kimi_sid`, a matching `users` row, and `users.role = 'admin'`. The SQL itself is ordinary Drizzle `SELECT` / `INSERT` / `UPDATE` / `DELETE` through `mysql2`. There is no separate admin database.

### Static vs dynamic

**Static:** marketing pages compiled into the Vite bundle. They do not read `blog_posts`.

**Dynamic Blog/CMS:** everything in section 1 that is marked “Needs MySQL”, plus the OAuth callback that writes `users`.

---

## 5. Blog/CMS functions that need MySQL

All JSON procedures are under `/api/trpc`. Names below are the procedure names the frontend calls.

| Procedure | Who can call it | Tables | Also calls the internet? | Broken when MySQL times out? |
| --- | --- | --- | --- | --- |
| `ping` | Anyone | none | no | No. This must not be used as proof that the blog works. |
| `blog.list` | Anyone | `blog_posts` (`status = 'published'`) | no | Yes. This is `/blog`. |
| `blog.bySlug` | Anyone | `blog_posts` | no | Yes. This is `/blog/:slug`. Drafts are hidden. |
| `blog.listAll` | Admin | `blog_posts` | no | Yes |
| `blog.byId` | Admin | `blog_posts` | no | Yes |
| `blog.create` | Admin | `blog_posts` | no | Yes |
| `blog.update` | Admin | `blog_posts` | no | Yes. This is edit, publish, and unpublish. |
| `blog.remove` | Admin | `blog_posts` | no | Yes |
| `seo.get` | Anyone | `seo_settings` | no | Yes. `/blog` calls it. The page can still show fallback titles. |
| `seo.listAll` | Admin | `seo_settings` | no | Yes |
| `seo.upsert` | Admin | `seo_settings` | no | Yes. Uses `INSERT ... ON DUPLICATE KEY UPDATE`. |
| `seo.remove` | Admin | `seo_settings` | no | Yes |
| `content.all` | Anyone | `site_content` | no | Yes. `/blog` calls it for optional hero text. |
| `content.listAll` | Admin | `site_content` | no | Yes |
| `content.upsert` | Admin | `site_content` | no | Yes. Uses `INSERT ... ON DUPLICATE KEY UPDATE`. |
| `content.remove` | Admin | `site_content` | no | Yes |
| `admin.stats` | Admin | `blog_posts`, `seo_settings`, `site_content`, `users` | no | Yes |
| `auth.me` | Cookie required | `users` | no | Yes, when a session cookie is present |
| `auth.logout` | Cookie required | `users` (to validate the session) | no | Yes, when a session cookie is present |
| `GET /api/oauth/callback` | Kimi redirects here | `users` (insert or update) | Yes: `KIMI_AUTH_URL` and `KIMI_OPEN_URL` | Yes. Login needs MySQL and outbound HTTPS to Kimi. |

Fixing only `blog.list`, or creating only `blog_posts`, leaves admin, login, SEO, and site content broken. All four tables in section 6 are in scope.

---

## 6. Required tables

Verified: `db/schema.ts` defines exactly four tables. `db/relations.ts` defines no foreign keys. There is no categories table, comments table, or authors table. These four tables are the complete set for the Blog/CMS in this repository.

Column names are camelCase. They must match.

### `blog_posts` — articles

| Column | Type expected by the schema | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | SERIAL (BIGINT UNSIGNED AUTO_INCREMENT) | no | auto | Primary key |
| `title` | VARCHAR(255) | no | | |
| `slug` | VARCHAR(255) | no | | Unique. Public URL is `/blog/{slug}` |
| `excerpt` | VARCHAR(500) | yes | | |
| `content` | TEXT | yes | | Markdown body |
| `coverImage` | TEXT | yes | | Image URL. This exact name. |
| `tags` | VARCHAR(500) | yes | | One comma-separated string |
| `status` | ENUM('draft','published') | no | `'draft'` | Public list uses only `published` |
| `seoTitle` | VARCHAR(255) | yes | | |
| `seoDescription` | VARCHAR(500) | yes | | |
| `publishedAt` | TIMESTAMP | yes | NULL | Public list sorts by this, newest first |
| `createdAt` | TIMESTAMP | no | CURRENT_TIMESTAMP | |
| `updatedAt` | TIMESTAMP | no | CURRENT_TIMESTAMP | Application sets this on update |

Unique key: `slug`. No other indexes are defined in the repository.

### `users` — login and admin role

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | SERIAL, primary key | no | auto |
| `unionId` | VARCHAR(255), unique | no | |
| `name` | VARCHAR(255) | yes | |
| `email` | VARCHAR(320) | yes | |
| `avatar` | TEXT | yes | |
| `role` | ENUM('user','admin') | no | `'user'` |
| `createdAt` | TIMESTAMP | no | CURRENT_TIMESTAMP |
| `updatedAt` | TIMESTAMP | no | CURRENT_TIMESTAMP |
| `lastSignInAt` | TIMESTAMP | no | CURRENT_TIMESTAMP |

There is no password column. Admin is `role = 'admin'`, granted when `unionId` equals server variable `OWNER_UNION_ID` at login.

### `seo_settings` — per-page SEO

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | SERIAL, primary key | no | auto |
| `pageKey` | VARCHAR(100), unique | no | |
| `title` | VARCHAR(255) | yes | |
| `description` | VARCHAR(500) | yes | |
| `keywords` | VARCHAR(500) | yes | |
| `ogImage` | TEXT | yes | |
| `canonicalUrl` | VARCHAR(500) | yes | |
| `robots` | VARCHAR(100) | yes | `'index,follow'` |
| `updatedAt` | TIMESTAMP | no | CURRENT_TIMESTAMP |

### `site_content` — small editable text values

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | SERIAL, primary key | no | auto |
| `key` | VARCHAR(100), unique | no | |
| `label` | VARCHAR(255) | yes | |
| `value` | TEXT | yes | |
| `updatedAt` | TIMESTAMP | no | CURRENT_TIMESTAMP |

The blog page reads `announcement_bar`, `blog_hero_title`, and `blog_hero_subtitle` from this table when those keys exist. Missing keys are not an error. A missing **table** is an error.

---

## 7. Migrations

Verified: this repository has **no** `.sql` migration files and no migration directory. `db/schema.ts` is the only schema definition. `db/seed.ts` is sample content. Nothing in `package.json` runs that seed. **Do not insert sample posts** unless the client approves it in writing.

Do not create or alter tables until you have inspected the live database.

Run, against database `1a106262-d752-8f79-8000-09c1ec5340b2`:

```sql
SHOW TABLES;
```

Then, for each table that exists:

```sql
SHOW CREATE TABLE blog_posts;
SHOW CREATE TABLE users;
SHOW CREATE TABLE seo_settings;
SHOW CREATE TABLE site_content;
```

- If a table exists, compare it to section 6. Do not drop or recreate it to “match” this document. Record the real `SHOW CREATE TABLE` output in the handoff.
- If a table is missing, the script below is **proposed from `db/schema.ts` only**. It has not been executed. Review it against the real engine before running it. Take a backup first.

```sql
-- PROPOSED ONLY — REVIEW BEFORE EXECUTION
-- Not executed. Do not run against tables that already exist
-- until a DBA has compared SHOW CREATE TABLE output.

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `unionId` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `email` VARCHAR(320) NULL,
  `avatar` TEXT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastSignInAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_unionId_unique` (`unionId`)
);

CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `excerpt` VARCHAR(500) NULL,
  `content` TEXT NULL,
  `coverImage` TEXT NULL,
  `tags` VARCHAR(500) NULL,
  `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  `seoTitle` VARCHAR(255) NULL,
  `seoDescription` VARCHAR(500) NULL,
  `publishedAt` TIMESTAMP NULL DEFAULT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blog_posts_slug_unique` (`slug`)
);

CREATE TABLE IF NOT EXISTS `seo_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pageKey` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NULL,
  `description` VARCHAR(500) NULL,
  `keywords` VARCHAR(500) NULL,
  `ogImage` TEXT NULL,
  `canonicalUrl` VARCHAR(500) NULL,
  `robots` VARCHAR(100) NULL DEFAULT 'index,follow',
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `seo_settings_pageKey_unique` (`pageKey`)
);

CREATE TABLE IF NOT EXISTS `site_content` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `label` VARCHAR(255) NULL,
  `value` TEXT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_content_key_unique` (`key`)
);
```

---

## 8. Database product and compatibility

The hostname and port do **not** identify the Alibaba product. Port 4000 is not MySQL’s default 3306. The cloud team must confirm, from the Alibaba console, and write the answers into the handoff:

- Alibaba service / product name
- region (the hostname contains `ap-southeast-1`)
- engine name and version
- confirmation that clients speak the **MySQL protocol** on the published port
- authentication type (user/password, or something else)
- whether TLS is required
- whether a CA certificate is required
- whether these features work: `ENUM`, `AUTO_INCREMENT`, `TIMESTAMP`, `INSERT ... ON DUPLICATE KEY UPDATE`, and normal `SELECT` / `INSERT` / `UPDATE` / `DELETE`

The application uses those features. `seo.upsert` and `content.upsert` and user login use `ON DUPLICATE KEY UPDATE`. Blog status and user role use `ENUM`.

Again: Drizzle `mode: "planetscale"` is a driver option inside this codebase. It is not evidence that the database is PlanetScale or that the app connects over HTTPS.

---

## 9. What the cloud team must implement

Provide a production-grade way for **the Vercel application** to open a MySQL-protocol connection to this Blog/CMS database.

The current PrivateLink name is a private VPC endpoint. It is verified to resolve to `10.128.x.x`, which Vercel cannot route to. Leaving `DATABASE_URL` pointed at that name will keep producing `ETIMEDOUT` on Vercel.

Do not prescribe an Alibaba product name here. The console owners must choose a supported design. Acceptable shapes include a managed public endpoint, a TLS proxy or gateway in front of the private database, or another Alibaba-supported path, **if and only if** it meets every condition below.

The finished design must:

1. Work from the **current Vercel** deployment’s API, not only from an ECS instance in the VPC.
2. Work later when the same application is served at `https://storex-app.com/` **without** a new database, firewall, PrivateLink, schema, credential, or architecture project.
3. Keep the database password on the server only. Never in frontend JavaScript. Never in a `VITE_` variable.
4. Not publish an unauthenticated MySQL port to the whole internet.
5. Use TLS if the endpoint is reachable beyond the private VPC.
6. Be stable production infrastructure, not a demo tunnel.
7. Not depend on a developer laptop.
8. Not depend on a manually started SSH tunnel.
9. Not depend on a temporary or one-off IP address.
10. Not use the website hostname as part of database routing. Changing the public site from `*.vercel.app` to `storex-app.com` must not change the database endpoint.

### Why “allow only today’s Vercel IP” is usually not enough

Vercel’s default outbound addresses are not a single permanent IP, and this repository does not configure a static egress product. An allowlist of one address seen during a test will break on the next deployment, and it will break again if production egress is not that same address.

If the access control is an IP allowlist, the allowlist must be a **stable** egress that remains valid for both stages. State in the handoff what that egress is. If `storex-app.com` will be a custom domain on **this same Vercel project**, the server’s network path does not change when the hostname changes, and the allowlist does not need to change. If production will run somewhere else, an allowlist that only contains Vercel will force another firewall change later. That result does **not** meet condition 2. Choose a design that does not require that second change: the same endpoint, credentials, and firewall rules for both stages.

PrivateLink can stay as the internal path between your proxy and the database. Vercel must be given a different, reachable address.

---

## 10. Security controls

Do not:

- open MySQL with `0.0.0.0/0` and no authentication
- put `DATABASE_URL`, the database password, or `APP_SECRET` in the frontend or in any `VITE_` variable
- disable database authentication
- use a laptop tunnel or a temporary bastion as the production path
- commit credentials into the git repository

Do:

- TLS on any endpoint that is not confined to the private VPC. Say whether a custom CA is required.
- a dedicated database user for this application
- least privilege: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on the four tables in section 6 only, in database `1a106262-d752-8f79-8000-09c1ec5340b2`
- secrets stored in the host’s secret store (Vercel Environment Variables for stage 1; the same class of secret store for production). Not in git.
- firewall or equivalent access control so the port is not an open anonymous listener
- a reasonable connection limit on that user, appropriate to a small CMS (the app keeps one connection pool per server process; Vercel can open several short-lived connections)
- database or proxy logs that show failed logins and connection timeouts, without writing passwords into those logs

---

## 11. Vercel compatibility

**Question this section must answer:** how does the current Vercel deployment connect to MySQL?

```text
Current Vercel deployment
        ↓
API function (api/[...path].js → bundled Hono app)
        ↓
final database endpoint you provide
        ↓
MySQL
```

`Alibaba ECS → database` is not the acceptance test.

The Vercel function reads `DATABASE_URL` from the project’s **server** environment at runtime. It does not read it from the static website bundle.

### What we will configure on Vercel after your handoff (names only)

Runtime (server), Production and Preview as you agree. Production is the one that must pass.

| Name | Secret |
| --- | --- |
| `DATABASE_URL` | Yes |
| `APP_ID` | No (it is also the public client id) |
| `APP_SECRET` | Yes |
| `KIMI_AUTH_URL` | No |
| `KIMI_OPEN_URL` | No |
| `OWNER_UNION_ID` | Treat as server-only |
| `NODE_ENV` | `production` is set by Vercel for production deployments |

Build-time (inlined into the browser bundle; must be present **before** the Vercel build, not only after):

| Name | Secret |
| --- | --- |
| `VITE_KIMI_AUTH_URL` | No. Public URL. |
| `VITE_APP_ID` | No. Public client id. Must match `APP_ID`. |

`PORT` is not used on Vercel. The platform invokes the function.

No secret values belong in this requirements file or in the handoff. Tell us the **format** of `DATABASE_URL` and where the real password is stored.

### Vercel-specific checks you must cover in the handoff

- The endpoint you give us is reachable from Vercel’s network, not only from ECS.
- TLS parameters, if any, are written as URL query parameters the `mysql2` connection string must include. The application currently passes the URL through with no extra TLS code. If a custom CA or a special TLS mode cannot be expressed on the URL, say so explicitly. That would be an application code change and must be called out. Do not assume it already exists.
- `Current Vercel compatibility` in the status matrix is not `PASS` unless connectivity from the Vercel path has actually been verified, or you mark `REQUIRES APPLICATION TEST` and the endpoint is ready for us to set `DATABASE_URL` and redeploy. “The database is healthy inside Alibaba” is `FAIL` for this line.

Outbound HTTPS from Vercel to these hosts is also required for admin login (verified from code):

- `auth.kimi.com` port 443 (current value of `KIMI_AUTH_URL` and `VITE_KIMI_AUTH_URL`)
- `open.kimi.com` port 443 (current value of `KIMI_OPEN_URL`)

Those are public names. They are separate from the database problem.

---

## 12. Production domain preparation

**Production domain:** `https://storex-app.com/`

Prepare the following now.

| Item | Must it change when the site moves to storex-app.com? |
| --- | --- |
| Database hostname, port, database name | No |
| Database user and password | No |
| Firewall / allowlist / proxy rules | No, if section 9 is implemented correctly |
| PrivateLink inside Alibaba | No |
| Table schema | No |
| `DATABASE_URL` | No, unless you were forced to use a host that only Vercel can reach. Do not do that. |
| Public DNS for `storex-app.com` | Yes, this is normal website DNS when the site is attached to the host. It is not a database change. |
| OAuth redirect URLs | Domain-specific. Register **both** origins in this task (section 13). |
| `VITE_KIMI_AUTH_URL`, `VITE_APP_ID`, `KIMI_AUTH_URL`, `KIMI_OPEN_URL`, `APP_ID`, `APP_SECRET`, `OWNER_UNION_ID` | No. They are not the website hostname. |

The repository does not show who operates DNS for `storex-app.com`. Pointing that name at the final host is ordinary website cutover. It must not require a change to the database design delivered here.

Canonical host: the application uses `window.location.origin` exactly. `https://storex-app.com` and `https://www.storex-app.com` are different OAuth redirect URIs. This repository does not redirect one to the other. **In this task, treat `https://storex-app.com` as the only production origin.** If `www` will answer HTTP, redirect it to `https://storex-app.com` at DNS or the hosting edge now, so a second production callback is not required later.

---

## 13. OAuth and both domains

Verified from `src/pages/Login.tsx` and `server/kimi/auth.ts`:

- Authorize URL: `{VITE_KIMI_AUTH_URL}/api/oauth/authorize`
- `redirect_uri` sent to Kimi: `{window.location.origin}/api/oauth/callback`
- `scope`: `profile`
- `response_type`: `code`
- The callback stores that same redirect URI in the `state` parameter (base64) and sends it again on the token request to `{KIMI_AUTH_URL}/api/oauth/token`

So the redirect URI changes when the site’s public origin changes. Kimi must accept the redirect URI the browser sends. This repository does **not** contain Kimi’s application-console rules, and it does not prove whether that console allows one redirect URI or many. Do not leave that unknown. The people who administer this Kimi application must open the settings for this client id during this task and register the real URLs.

### URLs to authorize now

Production, already known:

```text
https://storex-app.com/api/oauth/callback
```

Current Vercel production, **not in the git repository**. Copy the stable Production hostname from the Vercel project:

```text
https://<CURRENT-VERCEL-PRODUCTION-HOST>/api/oauth/callback
```

Example shape only (not the real host): `https://storex-full-code.vercel.app/api/oauth/callback`.

Do not register every Preview URL (`https://<project>-<random>-<team>.vercel.app`). Those origins change on every branch deploy. Admin login for this task is on the stable Production domain. Say the exact hostname you registered in the handoff.

### If the Kimi console allows more than one redirect URI

Register both URLs above now. That is the required end state. Moving to `storex-app.com` then needs no further change at Kimi.

### If the Kimi console allows only one redirect URI

That limit is **not** visible in this repository. It is only true if you see it in the Kimi application settings. If you see it:

- Say so in the handoff, with the exact console limitation.
- Still decide the production choice now: the single registered URI must be `https://storex-app.com/api/oauth/callback` **or** you must record that the provider cannot hold both and that a console edit will be required at cutover.
- A provider that stores only one redirect URI is the one case where cutover cannot be fully pre-authorized. Do not discover that at cutover. Discover it now and write it in section N of the handoff.

There is no application setting in this repo that bypasses Kimi’s redirect check. The code always sends the live origin.

Cookie note, verified: off localhost the session cookie is `Secure`. Both origins must be HTTPS, which they are if served as specified. No extra cloud change is required for the cookie when the hostname becomes `storex-app.com`, provided the site stays HTTPS and the API stays on the same origin (`/api` on that host). The app does not call the API on a different domain.

---

## 14. Environment variables

“Set locally” means the current environment file has a non-empty value. Values are not printed. Kimi was not called. MySQL was called and timed out.

### Public build-time variables

Vite inlines these into the browser bundle. They must exist at **build** time on Vercel and again at build time for any later production build.

| Variable | Purpose | Required | Changes for storex-app.com? |
| --- | --- | --- | --- |
| `VITE_APP_ID` | OAuth client id in the browser. Matches server `APP_ID` (verified equal, value not printed). | Yes, for admin login | No |
| `VITE_KIMI_AUTH_URL` | Browser authorize base URL. Current host: `auth.kimi.com`. | Yes, for admin login | No |

Sanitized examples: `VITE_APP_ID=<same as APP_ID>`, `VITE_KIMI_AUTH_URL=https://auth.kimi.com`.

These are public by design. They are not database secrets.

### Server / runtime variables

| Variable | Purpose | Required | Secret | Changes for storex-app.com? |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | MySQL connection string | Yes in production | Yes | **No.** Same endpoint for Vercel and for storex-app.com. |
| `APP_ID` | OAuth client id on the server; also stored in the session token | Yes in production | No | No |
| `APP_SECRET` | OAuth client secret and cookie signing key | Yes in production | Yes | No |
| `KIMI_AUTH_URL` | Token and JWKS base URL. Current host: `auth.kimi.com`. Same value as `VITE_KIMI_AUTH_URL`. | Yes in production | No | No |
| `KIMI_OPEN_URL` | Profile API. Current host: `open.kimi.com`. | Yes in production | No | No |
| `OWNER_UNION_ID` | Union id that receives `admin` on login. Empty means nobody is auto-promoted. | Optional, but required if this client must have an admin | Server-only | No |
| `NODE_ENV` | `production` makes missing required variables throw at startup | Set by the host | No | No |
| `PORT` | Listen port for a long-running Node process. Default 3000. | No | No | No. Unused on Vercel. |

Sanitized database URL (replace the angle-bracket secrets; do not invent a different host unless your solution uses a new reachable hostname):

```env
DATABASE_URL=mysql://DB_USER:DB_PASSWORD@FINAL_HOST:PORT/1a106262-d752-8f79-8000-09c1ec5340b2
```

If TLS requires URL parameters, add them in the handoff. The current URL has none, and that current host is the unreachable PrivateLink name. `FINAL_HOST` must be the reachable endpoint from section 9, which may be a proxy hostname rather than `*.privatelink.aliyuncs.com`.

### Present locally, not read by this application

`KIMI_AGENTGW_API_KEY`, `KIMI_AGENTGW_BASE_URL` (host `agent-gw.kimi.com`), and `KIMI_STORAGE_RESOURCE_ID` are set in the local environment file. No source file reads them. They are not part of Blog/CMS. Do not block this task on them. Do not put them in `VITE_` variables.

`package.json` lists AWS S3 and AI SDK packages. No application source file imports them. They are not part of this task.

---

## 15. What stays fixed vs what is domain configuration

### Infrastructure (do not redo at domain cutover)

- Alibaba database and its schema
- PrivateLink as the in-VPC path, if you still use it behind a reachable endpoint
- the endpoint, port, database name, user, password, TLS mode, and firewall or proxy rules delivered in the handoff
- `DATABASE_URL` contents, if section 9 is followed

### Website / domain (known now; prepare now)

- Public production origin: `https://storex-app.com/`
- OAuth callbacks in section 13, both of them, registered in this task
- Redirect `www` to the apex host if `www` would otherwise be a second origin
- Public DNS that eventually points `storex-app.com` at the website host. That is website DNS, not a database change.
- Rebuild with the same `VITE_APP_ID` and `VITE_KIMI_AUTH_URL`. Those values do not contain the website hostname.

There is nothing left that requires the sentence “tell us the final domain later.” The final domain is `https://storex-app.com/`.

---

## 16. DNS

### PrivateLink / private DNS

Verified: `ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com` resolves to private `10.128.x.x` addresses. That name is for clients inside the Alibaba network that can route those addresses. Vercel is not such a client.

If your solution keeps PrivateLink for the internal hop only, private DNS must still work **from the proxy or gateway**, not from Vercel and not from the public internet.

### Public application DNS

`storex-app.com` is the website name. This repository does not show the DNS host for that domain. Whoever already operates that DNS will point the name at the website (Vercel or the final host) when the site is cut over. That change must not alter the database endpoint, port, firewall, or credentials.

Do not create a public DNS record that points `storex-app.com` at the database.

---

## 17. Connectivity tests

Run these from a network that matches the **application path** (the proxy’s client side, or a test that represents Vercel egress). A success only from an ECS shell inside the VPC does not pass section 11.

Do not put the password in a command that will be pasted into a ticket. Type `-p` and enter it interactively, or use a secret store.

### DNS

```bash
dig +short FINAL_HOST
```

**Success:** an address your chosen path can route.  
**Empty / NXDOMAIN:** wrong name or wrong resolver.  
**Only `10.x` addresses, then a timeout from Vercel:** this is still the PrivateLink address. Vercel cannot use it. Provide a different reachable hostname.

### TCP

```bash
nc -vz FINAL_HOST PORT
```

**Success:** connects within about a second.  
**Timeout (`ETIMEDOUT`):** packets dropped. Firewall, missing route, or a private IP. This is the current PrivateLink symptom.  
**Connection refused:** the route works and nothing is accepting that port.

### MySQL login, `SELECT 1`, tables

```bash
mysql -h FINAL_HOST -P PORT -u DB_USER -p DB_NAME -e "SELECT 1 AS ok; SHOW TABLES;"
```

`DB_NAME` is `1a106262-d752-8f79-8000-09c1ec5340b2` unless you intentionally move the schema and say so in the handoff.

| Result | Meaning |
| --- | --- |
| `ok` = 1 and a table list | Network and login work. Go to schema verification. |
| Timeout | Still network. Do not debug SQL. |
| Connection refused | Port closed or wrong port. |
| `Access denied` | Network works. User, password, or host grant is wrong. |
| `Unknown database` | The database name in the URL does not exist on that server. |
| TLS / certificate error | TLS is required or the hostname does not match the certificate. Document the exact client parameters. |
| `Table doesn't exist` | Login works. Schema is missing. See section 7. Do not invent a success. |

Then run the `SHOW CREATE TABLE` statements from section 7 for every table that exists.

---

## 18. Application-level tests

These run after `DATABASE_URL` is set on Vercel and the project is redeployed. The cloud team prepares the endpoint. The application developer executes the browser and tRPC checks. The cloud handoff must still make those checks possible.

`ping` is not evidence of database success.

| Test | Pass |
| --- | --- |
| `GET /api/trpc/ping` on the Vercel production URL | HTTP 200, `"ok":true`. Process only. |
| `blog.list` | HTTP 200 and a JSON array. An empty array is a real empty blog, not a timeout. HTTP 500 is a fail. |
| `blog.bySlug` for a published slug, after one published row exists | HTTP 200 and the article. Unknown slug returns null, not 500. |
| `seo.get` for page key `blog` | HTTP 200. Zero rows is fine. Missing table is not. |
| `content.all` | HTTP 200. |
| `auth.me` with no cookie | Unauthorized, not HTTP 500. |
| OAuth callback after a real login | User row in `users`, cookie set, no 500. Requires the redirect URI in section 13 and outbound HTTPS to Kimi. |

Example shape for the public list (host = current Vercel production host):

```bash
curl -sS -D - "https://<CURRENT-VERCEL-PRODUCTION-HOST>/api/trpc/blog.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
```

---

## 19. Blog/CMS acceptance flow

End-to-end behavior the application must have once infrastructure is in place:

```text
Admin login
    ↓
Create test blog post
    ↓
Save draft          (not visible on /blog)
    ↓
Publish             (status = published)
    ↓
Post appears on /blog
    ↓
Open /blog/:slug
    ↓
Edit
    ↓
Changes appear
    ↓
Unpublish or delete
    ↓
Post disappears from /blog
```

Unpublish is supported: the admin UI sets `status` from `published` back to `draft`. Delete is a separate action and removes the row.

### Cloud team completes

- the reachable database architecture in section 9
- firewall, TLS, user, and privileges
- schema verification or reviewed creation
- both OAuth redirect URIs, or a documented single-URI limitation found in the Kimi console now
- `STOREX_BLOG_CMS_CLOUD_HANDOFF.md`

The cloud team does not have to click through the CMS UI.

### Application developer completes after the handoff

- set the variables in section 14 on Vercel
- redeploy
- run section 18
- run the UI flow above on the current Vercel production URL
- later attach `https://storex-app.com/` and deploy the same project, using the same `DATABASE_URL` and the OAuth callback that was already registered

---

## 20. Frontend error behavior (do not fix in this task)

**Infrastructure cause:** `blog.list` cannot open MySQL, so the API returns HTTP 500.

**Current UI, verified in `src/pages/Blog.tsx`:** the page does not read the error. It shows placeholders while the request is in flight, including retries, and then it can show “No posts yet.” `/blog/:slug` can show “Post not found” for the same class of failure.

**Later product change, not part of this cloud task:** show an explicit error when the API fails, and do not describe a 500 as an empty blog.

---

## 21. Logging

Keep this small. A full monitoring platform is not required for this CMS.

| Source | What to retain |
| --- | --- |
| Vercel function logs | stdout from the API. OAuth failures are logged as `[OAuth] Callback failed`. Kimi HTTP failures are logged as `[kimi]`. Session problems are logged as `[session]` or `[auth]`. |
| Browser or `curl` | HTTP status of `blog.list`. 500 plus about 10 seconds means the connect timeout is still happening. |
| Database or proxy logs | failed logins, TLS failures, and connection timeouts. Do not log passwords. |
| Application SQL errors | The app does not write them to a log file. tRPC returns `Failed query` to the caller. Use the function log and the HTTP status together. |

`[auth] No session cookie` on a public `/blog` view is normal. It is not the database incident.

---

## 22. Out of scope for the cloud team

Unless a gap in this document explicitly requires it, do not:

- change the website UI or rewrite blog pages
- edit unrelated static pages
- remove authentication
- put secrets in the frontend or in git
- load sample blog posts from `db/seed.ts` without written approval
- drop tables, delete rows, or run other destructive SQL
- change application business logic

The job is Blog/CMS infrastructure readiness: a database path Vercel can use, schema and privileges, TLS facts, and OAuth redirect URIs for both hostnames.

---

## 23. How to know you are finished

The task is not finished because the private database “looks healthy” from an ECS instance.

Before you call it ready, all of the following are true:

- a database path that Vercel can use is actually implemented
- the endpoint, port, database name, and TLS mode are written down
- TCP and MySQL login work on that path
- `SELECT 1` works
- the four tables are verified or created only after review
- the application user’s privileges are known
- `https://storex-app.com/api/oauth/callback` and the current Vercel production callback are registered, or the Kimi console’s single-URI limit is recorded now
- `www` will not become a surprise second origin
- `STOREX_BLOG_CMS_CLOUD_HANDOFF.md` exists and contains every section in section 24 of this document

---

# REQUIRED CLOUD COMPLETION HANDOFF

When this work is complete, do **not** answer with only:

```text
Done
```

Create a Markdown file named:

```text
STOREX_BLOG_CMS_CLOUD_HANDOFF.md
```

The client will send that file to the application developer. The developer will use it to configure Vercel and test the Blog/CMS without guessing and without opening another cloud investigation.

Use the headings below. Fill every one. If a line is not applicable, write why. Do not include passwords, `APP_SECRET`, API keys, or database passwords.

## A. Final architecture

Describe what you implemented. Include a short diagram of the real path, for example:

```text
Vercel
   ↓
secure connection
   ↓
database endpoint or proxy
   ↓
Alibaba database
```

Replace that example with the architecture you actually built.

## B. Alibaba / database service

- product or service name
- region
- engine
- engine version
- MySQL protocol: yes/no
- port

## C. Final connection endpoint

- hostname
- port
- database name
- public or private
- TLS required: yes/no
- CA certificate required: yes/no

No password.

## D. Final `DATABASE_URL` format

Exact sanitized format, including any required query parameters:

```env
DATABASE_URL=mysql://DB_USER:DB_PASSWORD@FINAL_HOST:PORT/DB_NAME
```

State that this same string is what both the current Vercel project and the later `storex-app.com` deployment must use.

## E. Credential delivery

- where the real username and password are stored
- who can access them
- how the application developer should receive them without placing them in this Markdown file

## F. DNS test result

Command and sanitized output for `FINAL_HOST`.

## G. Connectivity test result

TCP command, target, and result. Say whether the test ran from a network that represents Vercel, or only from inside the VPC. A VPC-only success must not be labeled as Vercel success.

## H. Database login result

Confirm `SELECT 1` succeeds. Include the non-secret part of the result.

## I. Schema verification

Paste `SHOW TABLES` and, preferably, `SHOW CREATE TABLE` for `blog_posts`, `users`, `seo_settings`, and `site_content`.

If you created or altered a table, say exactly what you ran. If you ran nothing because the tables already matched, say that.

## J. Database permissions

Privileges granted to the application user, and on which database. No password.

## K. TLS

- required: yes/no
- CA source, or “public CA”
- hostname verification: yes/no
- connection-string parameters the application must set

If the current code cannot express your TLS requirement in `DATABASE_URL` alone, write: `APPLICATION CODE CHANGE REQUIRED` and the reason.

## L. Current Vercel compatibility

One of:

```text
Current Vercel compatibility: PASS
Current Vercel compatibility: FAIL
Current Vercel compatibility: REQUIRES APPLICATION TEST
```

Explain what was verified. The expected end state is that this Vercel project can use the Blog/CMS database. “ECS can connect” is not `PASS`.

## M. storex-app.com readiness

One of:

```text
storex-app.com infrastructure readiness: PASS
storex-app.com infrastructure readiness: FAIL
```

Answer this sentence:

> When the application moves from its current Vercel test URL to https://storex-app.com/, will any database, network, or cloud infrastructure change be required?

The required answer is:

```text
No.
```

If you cannot say `No`, the task is not complete unless you explain the exact remaining change and why section 9 could not be met.

## N. OAuth readiness

- exact current Vercel production callback you authorized
- production callback: `https://storex-app.com/api/oauth/callback`
- both authorized: yes/no
- if the Kimi console allows only one redirect URI, quote that limitation and what you registered
- any remaining application-only step (for example setting env vars). There should be no remaining request back to the cloud/auth team for the domain cutover.

## O. Firewall / security

What you implemented: who may connect, TLS, user restrictions, and what you deliberately did not open. No secrets.

## P. Environment variables for the application developer

List names only.

Vercel build-time:

- `VITE_APP_ID`
- `VITE_KIMI_AUTH_URL`

Vercel runtime:

- `DATABASE_URL`
- `APP_ID`
- `APP_SECRET`
- `KIMI_AUTH_URL`
- `KIMI_OPEN_URL`
- `OWNER_UNION_ID`

Production on `storex-app.com`:

- same names
- state which values stay identical (they should all stay identical, including `DATABASE_URL`)

## Q. What remains for the application developer

Only unfinished application work. Do not list cloud tasks you already finished. Expected list:

```text
- Configure DATABASE_URL on Vercel using the sanitized format in section D and the secret from section E.
- Configure APP_ID, APP_SECRET, KIMI_AUTH_URL, KIMI_OPEN_URL, OWNER_UNION_ID.
- Configure VITE_APP_ID and VITE_KIMI_AUTH_URL before the build.
- Redeploy the current Vercel production deployment.
- Verify ping, then blog.list, seo.get, and content.all.
- Test admin login on the current Vercel production host.
- Test create, draft, publish, edit, unpublish, and delete.
- Later attach https://storex-app.com/ and deploy the same project with the same DATABASE_URL.
```

Remove any line that your handoff shows is already done. Do not add new cloud work to this list.

## R. Final status matrix

End the handoff with exactly these lines, each set to a real status:

```text
Cloud infrastructure: READY / NOT READY
Database connectivity: PASS / FAIL
Database authentication: PASS / FAIL
Schema verification: PASS / FAIL
TLS configuration: PASS / FAIL / NOT REQUIRED
Current Vercel compatibility: PASS / FAIL / REQUIRES APPLICATION TEST
storex-app.com infrastructure readiness: PASS / FAIL
OAuth Vercel callback readiness: PASS / FAIL
OAuth storex-app.com callback readiness: PASS / FAIL
Future client/cloud involvement required for storex-app.com migration: YES / NO
```

If the last line is `YES`, explain the exact reason in the same file. The completed state this project needs is:

```text
Future client/cloud involvement required for storex-app.com migration: NO
```
