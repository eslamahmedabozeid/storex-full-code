# StoreX — cloud and infrastructure requirements

**Audience:** client cloud / infrastructure team  
**Application:** StoreX web application (React frontend, Node.js API, MySQL database)  
**Purpose:** make `/blog` work, and make every current and future database-backed API reachable from the environment that runs this application  
**Status of this document:** investigation only. No application code, environment file, or database was changed.

This document separates **verified facts** (observed in the repository or by a non-destructive connectivity test) from **recommendations**.

---

## 1. Executive summary

`/blog` is not a broken page route. The page loads. The header, title, and layout render. The post list never arrives because the API cannot open a TCP connection to the database.

What happens today:

1. The browser opens `/blog`.
2. The page calls the API procedure `blog.list`.
3. The API runs a SQL `SELECT` against the table `blog_posts`.
4. The database host in `DATABASE_URL` is an Alibaba Cloud PrivateLink name (`*.privatelink.aliyuncs.com`) on port **4000**.
5. From the machine that is currently running the application, DNS returns private `10.128.x.x` addresses, and the TCP connection times out with **`ETIMEDOUT`**.
6. The API returns HTTP 500. The page keeps showing loading placeholders while the request is retried, then can show “No posts yet” even though the real problem is a failed database connection.

This is an infrastructure and database-connectivity problem. Changing the blog page alone will not fix it. Every other feature that reads or writes MySQL will fail in the same way until the application process can reach that database (or a replacement MySQL endpoint) on port 4000.

There is also no database migration in the repository. Even after the network path works, the cloud team must confirm that the target database contains `blog_posts` and the other tables this application queries. A proposed `CREATE TABLE` script is included below. It has not been executed.

---

## 2. Current application architecture

### Verified from the repository

| Layer | What this project actually uses |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7. Built to static files in `dist/public`. |
| Frontend data access | tRPC client (`@trpc/react-query`) calls **same-origin** `POST/GET /api/trpc`. Cookies are sent with `credentials: "include"`. |
| API | Hono server. One HTTP application, not a separate service per page. |
| API contract | tRPC router in `server/router.ts`, mounted at `/api/trpc/*`. |
| OAuth callback | `GET /api/oauth/callback` (not tRPC). |
| Database driver | `mysql2` through Drizzle ORM (`drizzle-orm/mysql2`). MySQL protocol. Not Postgres, not Supabase, not MongoDB. |
| Connection setting | `server/queries/connection.ts` passes the `DATABASE_URL` string to Drizzle with `mode: "planetscale"`. That mode changes how SQL is prepared. It does **not** switch the driver to HTTP. Traffic is still MySQL-protocol TCP via `mysql2`. |
| Session | HTTP-only cookie `kimi_sid`. JWT signed with `APP_SECRET` (HS256). |
| Login provider | Kimi OAuth. Browser redirects to `VITE_KIMI_AUTH_URL`. Server exchanges the code at `KIMI_AUTH_URL` and loads the profile from `KIMI_OPEN_URL`. |

### How a blog request travels

```text
Browser  GET /blog
   ->  static React app (Vite)
   ->  GET/POST /api/trpc/blog.list   (batched with seo.get and content.all)
   ->  Hono  /api/trpc/*
   ->  Drizzle  SELECT ... FROM blog_posts
   ->  MySQL host from DATABASE_URL, TCP port 4000
```

`/blog` itself is a frontend route. It is not a database route. The database call is inside `/api/trpc`.

### Deployment shapes present in the repository

Two runtime shapes exist in the repo. The cloud team must choose one and give it a network path to MySQL.

1. **Long-running Node process** (`server/boot.ts`, started by `npm start`). It listens on `PORT` (default **3000**) and serves both the API and the built frontend.
2. **Vercel** (`vercel.json` and `api/[...path].js`). The frontend is static output from `dist/public`. The API is one serverless function that imports the bundled server. Vercel does not run inside the client’s Alibaba Cloud VPC.

### External services that production must be able to reach

Verified outbound HTTPS calls in server code:

| Service | Environment variable | Paths the code calls |
| --- | --- | --- |
| Kimi OAuth | `KIMI_AUTH_URL` | `POST /api/oauth/token`, `GET /api/.well-known/jwks.json` |
| Kimi Open | `KIMI_OPEN_URL` | `GET /v1/users/me/profile` |

Verified browser call (not from the server):

| Service | Environment variable | Path |
| --- | --- | --- |
| Kimi OAuth authorize | `VITE_KIMI_AUTH_URL` | `GET /api/oauth/authorize` |

In the current local environment file, those Kimi hosts are `auth.kimi.com` and `open.kimi.com` (HTTPS).

`package.json` also lists `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `ai`, and `@ai-sdk/openai-compatible`. **No application source file imports them.** They are not part of the current `/blog` or API path. Do not block database work on S3 or an AI gateway.

The local environment file also contains `KIMI_AGENTGW_API_KEY`, `KIMI_AGENTGW_BASE_URL` (`https://agent-gw.kimi.com`), and `KIMI_STORAGE_RESOURCE_ID`. **No application source file reads those names.** They are not required for the current API. Confirm with the product owner before treating them as production dependencies.

---

## 3. Current database configuration

### What the application expects

Verified in `server/queries/connection.ts` and `server/lib/env.ts`:

- Protocol: MySQL (`mysql://` URL), spoken by the `mysql2` driver.
- Variable name: **`DATABASE_URL`**.
- Required in production. If `NODE_ENV=production` and this variable is empty, the process throws on startup: `Missing required environment variable: DATABASE_URL`.
- The URL is passed through as-is. The code does not set TLS, a connect timeout, a connection pool size, or a CA certificate.
- The database name is the path of that URL. The application does not hardcode a database name.
- There is no `ssl` query parameter on the current URL.

Sanitized shape:

```text
mysql://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME
```

### What is configured now (secrets removed)

Verified from the current application environment. Username and password are **not** included here.

| Item | Observed value |
| --- | --- |
| Protocol | `mysql:` |
| Host | `ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com` |
| Port | `4000` |
| Database name | `1a106262-d752-8f79-8000-09c1ec5340b2` |
| Username present | yes |
| Password present | yes |
| URL query parameters (for example `ssl`) | none |
| Region encoded in the hostname | `ap-southeast-1` (Alibaba Cloud Singapore) |

### Why the current server cannot reach it

Verified on 5 October 2026 from the machine currently running the app (Node.js v22.11.0):

1. DNS lookup of that hostname **succeeded**.
2. It returned only private IPv4 addresses:
   - `10.128.173.123`
   - `10.128.106.223`
   - `10.128.8.197`
3. A MySQL connection to that host timed out: **`connect ETIMEDOUT`**.
4. The blog API then failed in about 10 seconds with HTTP 500 and Drizzle’s `Failed query` error on `blog_posts`. Ten seconds matches the MySQL driver’s default connect timeout. The query text in that error does not mean the SQL itself was rejected; the driver never established a usable session.

`10.128.0.0/9` (including `10.128.0.0/16`) is private address space. Those addresses are reachable only from a network that has a route to that Alibaba VPC. This application environment does not.

This hostname is an **Alibaba Cloud PrivateLink endpoint** (`ep-...epsrv-....privatelink.aliyuncs.com`). PrivateLink endpoints are created inside a specific VPC. They are not a public MySQL hostname.

Port **4000** is not MySQL’s default port (3306). The repository does not say which Alibaba product sits behind the endpoint (ApsaraDB, PolarDB, TiDB, AnalyticDB, or another MySQL-compatible service). The cloud team must confirm that the listener on port 4000 speaks the **MySQL protocol** that `mysql2` uses.

The repository’s Drizzle `mode: "planetscale"` does not mean the database is PlanetScale, and it does not mean the app uses PlanetScale’s HTTPS API. It only changes prepared-statement behavior inside Drizzle while still using `mysql2`.

---

## 4. Networking options

The application needs a stable MySQL-protocol endpoint. Any option below is valid only if, from the **production application process**, this succeeds:

```text
TCP connect to <host> port <port>
MySQL handshake and login
USE <database>
SELECT 1
SELECT ... FROM blog_posts
```

### Option A — Run the application inside the same Alibaba Cloud VPC (recommended)

**What the cloud team configures**

- An Alibaba compute service in the **same VPC and region** as the PrivateLink endpoint (`ap-southeast-1`), for example ECS, ACK, or SAE, with a route to `10.128.0.0/16` (or whichever prefix those endpoint IPs use).
- Security group: outbound TCP **4000** from the application instances to the PrivateLink endpoint IPs or to the endpoint security group.
- The PrivateLink endpoint’s own security group / whitelist must allow the application security group or its vSwitch CIDR.
- Private DNS so the `privatelink.aliyuncs.com` name resolves to those `10.128.x.x` addresses **inside that VPC**. Alibaba VPC DNS normally does this for PrivateLink. Confirm it; do not rely on public DNS.
- Node.js 22.12 or newer on that compute, with the environment variables in section 10.
- A reverse proxy (HTTPS, port 443) in front of the Node process on port 3000, unless the platform terminates TLS itself.

**Host and port the application uses**

Keep the current host and port if they are the PrivateLink endpoint for this database:

```text
host: ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com
port: 4000
```

**Security**

The database stays on a private IP. No public MySQL listener. This is the right production choice if the data must remain inside Alibaba Cloud.

**Fit with the current repo**

A normal Node server (`npm start`) fits this option. A Vercel deployment does **not**, unless Vercel is given a private path into this VPC. Vercel’s default network is the public internet and cannot route to `10.128.x.x`.

### Option B — VPC peering or another private connection, application stays outside the database VPC

**What the cloud team configures**

- Peering, Cloud Enterprise Network (CEN), or an equivalent private route between the application network and the VPC that owns the PrivateLink endpoint.
- Routes for `10.128.173.123`, `10.128.106.223`, and `10.128.8.197` (and any future endpoint IPs).
- DNS: the application network must resolve the PrivateLink hostname to those private IPs. Peering alone does not publish Alibaba private DNS. They may need a private zone, a DNS forwarder, or the application configured with a resolvable name.
- Security groups on both sides for TCP 4000.

**Host and port**

Same PrivateLink hostname and port 4000, after DNS and routing work from the application network.

**Security**

Still private, if the peer network is trusted. Broader than Option A because two networks can reach the database.

**Recommendation**

Use this only if the application cannot move into the database VPC. Do not peer a wide network to the database subnet.

### Option C — Public MySQL endpoint with a strict firewall

**What the cloud team configures**

- A **public** MySQL-compatible endpoint for this same database, or a proxy in front of it.
- Inbound TCP 4000 (or whatever public port they assign) allowed only from the application’s **stable egress IPs**.
- TLS required on that public listener.
- A new `DATABASE_URL` whose host is the public name, not the `privatelink.aliyuncs.com` name.

**Host and port**

Whatever public hostname and port they provide. The application will use that URL unchanged. If they keep port 4000, say so explicitly. If they use 3306, the URL must use 3306.

**Security**

Higher exposure than Option A. Acceptable only with TLS, a strong password, no `0.0.0.0/0` rule, and a short allowlist. Vercel egress IPs change unless a static-IP add-on is purchased, so IP allowlisting Vercel is a poor fit. Prefer Option A.

**Important application limit**

The code does not set TLS options. If the server requires TLS, the cloud team must say so. The URL may need an `ssl` parameter, and the application may need a small code change to trust the CA. That change is not in scope here. Please state whether TLS is required and send the CA requirements (section 18).

### Option D — Site-to-site VPN

**What the cloud team configures**

- IPsec or SSL VPN between the application network and the Alibaba VPC.
- Routes for the PrivateLink endpoint IPs.
- DNS for the PrivateLink name, same as Option B.
- Firewall rule TCP 4000 from the application subnet to the endpoint.

**Host and port**

The existing PrivateLink hostname and port 4000.

**Security**

Equivalent to a private path if the VPN is stable. Operationally weaker than Option A because a VPN outage looks exactly like today’s timeout.

### Option E — SSH tunnel or bastion

**What the cloud team configures**

- A bastion inside the VPC that can reach port 4000.
- An SSH tunnel from the application host to `127.0.0.1:<local-port>` forwarded to the database port.
- `DATABASE_URL` pointed at that local forward, **or** the process started only after the tunnel is up.
- A supervisor so the tunnel restarts with the app.

**Host and port the application would use**

```text
127.0.0.1:<chosen local port>
```

**Security**

Acceptable for a short diagnostic. Not recommended as the production design. The app currently has no tunnel supervisor. A dead tunnel produces the same `ETIMEDOUT` / `ECONNREFUSED` the blog page already shows.

### Option F — Replace the endpoint with another MySQL the application can already reach

Valid if the client would rather host MySQL somewhere the app already runs (for example a managed MySQL in the same network as the app). The application does not care about the Alibaba product name. It needs MySQL protocol, the schema in section 9, and a `DATABASE_URL` that connects.

### Recommendation

**Production: Option A.** Keep the database private. Run this Node application in the same Alibaba VPC (`ap-southeast-1`) that can route to `10.128.0.0/16` and resolve the PrivateLink name.

Do not plan on the current Vercel setup reaching this PrivateLink endpoint. That would require a private connectivity product between Vercel and this VPC, which this repository does not configure.

---

## 5. Firewall and security-group rules

The application opens an **outbound** MySQL connection. The database does not call back into the application. There is no inbound database port on the app.

### Required path

| Direction | Source | Destination | Port | Purpose |
| --- | --- | --- | --- | --- |
| Outbound from application | Application ECS/ACK security group, or its vSwitch CIDR | PrivateLink endpoint IPs `10.128.173.123`, `10.128.106.223`, `10.128.8.197`, or the endpoint’s security group | **TCP 4000** | MySQL protocol |
| Inbound on the database / PrivateLink side | Same application security group or vSwitch CIDR. Not `0.0.0.0/0`. | The PrivateLink endpoint or the database listener | **TCP 4000** | Accept the application |

If the endpoint IPs change, allow the endpoint security group or the whole endpoint subnet rather than three fixed IPs only. Please confirm the stable target with the PrivateLink service owner. The three addresses above are what DNS returned on the day of this test.

### Also required from the application, outbound

| Destination | Port | Why |
| --- | --- | --- |
| `auth.kimi.com` | TCP 443 | OAuth token exchange and JWKS |
| `open.kimi.com` | TCP 443 | User profile after login |
| Public HTTPS (or the platform’s package mirror) | TCP 443 | `npm install` during build, only from the build environment |
| DNS resolver for the VPC | UDP/TCP 53 | Resolve the PrivateLink name |

No other outbound database port is required by the code. Port 3306 is **not** used by the current URL.

### Not required

- Inbound MySQL from the internet to the application.
- Inbound port 4000 on the application.
- A public IP on the database, if Option A is used.

### Source identity we need you to fill in

The repository does not contain the production server’s private IP, security group ID, or vSwitch CIDR. The cloud team must name the source they will allow. If the app is deployed on several instances, allow the security group, not a single ephemeral pod IP.

---

## 6. DNS requirements

### Verified

The name `ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com` is an Alibaba PrivateLink name. From the current application machine it **does resolve**, to private `10.128.x.x` addresses. The failure is not `ENOTFOUND`. Name lookup works somewhere in the current DNS path, and the returned addresses are not routed.

PrivateLink names are intended to be resolved by **Alibaba VPC DNS** (the DNS server inside the VPC, often reached at `100.100.2.136` from instances in that VPC). A resolver outside that VPC may:

- fail to resolve the name (`NXDOMAIN` / `ENOTFOUND`), or
- resolve it to private IPs that the client cannot route (this is what we observed), or
- resolve it only when the client uses the VPC’s DNS.

### What production must resolve

From the production application server, this exact name must return the private endpoint addresses that the server can route to:

```text
ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com
```

`auth.kimi.com` and `open.kimi.com` must also resolve and answer on TCP 443.

### Commands

Run these **on the production application host**, not on a laptop outside the VPC.

```bash
# DNS
dig +short ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com
dig +short auth.kimi.com
dig +short open.kimi.com

# Which resolver answered
dig ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com

# Windows
nslookup ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com
```

**Success:** `dig +short` prints one or more addresses in the VPC (today those were `10.128.173.123`, `10.128.106.223`, `10.128.8.197`). The application host must have a route to them.

**Failure meanings:**

| Result | Meaning |
| --- | --- |
| `NXDOMAIN` or empty answer | This host is not using the VPC private zone. Fix DNS before testing MySQL. |
| Public IP addresses | Unexpected for this PrivateLink name. Confirm you queried the right name and resolver. |
| Private IPs, then TCP timeout | DNS is fine. Routing or a security group is dropping TCP 4000. This matches the current failure. |

---

## 7. Connectivity tests

Run these from the **production application host** after the network change. Do not paste passwords into tickets or chat logs.

### 7.1 DNS

```bash
dig +short ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com
```

**Success:** private IPv4 addresses that this host can route.  
**Failure:** see section 6.

### 7.2 TCP port

```bash
nc -vz ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com 4000
```

Windows, from the app server:

```powershell
Test-NetConnection ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com -Port 4000
```

**Success:** `succeeded` / `TcpTestSucceeded : True` within a second or two.  
**`ETIMEDOUT` / `TcpTestSucceeded : False` after ~10 seconds:** packets are dropped. Security group, NACL, or missing route. This is the current symptom.  
**`ECONNREFUSED`:** routing works, nothing is listening on 4000, or a firewall rejects with RST. Confirm the database listener port.

### 7.3 MySQL login and schema

Use the real user and password only in a shell session, not in this document.

```bash
mysql -h ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com \
  -P 4000 \
  -u DB_USER \
  -p \
  DB_NAME \
  -e "SELECT 1 AS ok; SHOW TABLES; DESCRIBE blog_posts;"
```

Replace `DB_USER` and `DB_NAME`. `DB_NAME` today is `1a106262-d752-8f79-8000-09c1ec5340b2`.

**Success:** `ok = 1`, a table list, and columns matching section 8.  
**`Access denied`:** network is fine; user, password, or database grants are wrong.  
**`Unknown database`:** the URL path does not match a schema on that server.  
**`Table 'blog_posts' doesn't exist`:** network and login work; schema is missing (section 9).  
**Timeout:** still a network problem. Do not debug SQL until TCP succeeds.  
**TLS error:** the server requires SSL and the client did not negotiate it. Report that back; the application URL currently has no SSL parameter.

### 7.4 Application-side test

After `DATABASE_URL` on the app points at a reachable server and the app is restarted:

```bash
# Process is alive and the API is mounted. This does not touch MySQL.
curl -sS "https://APP_HOST/api/trpc/ping"

# This does query blog_posts. Expect HTTP 200 and a JSON array (possibly empty).
curl -sS -D - "https://APP_HOST/api/trpc/blog.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
```

**Success for `ping`:** JSON containing `"ok":true`. This can succeed even when the database is down.  
**Success for `blog.list`:** HTTP 200 and a result array. An empty array is a valid empty blog, not an error.  
**HTTP 500 and `Failed query` / `ETIMEDOUT`:** the app still cannot open MySQL.  
**HTTP 500 and `doesn't exist`:** create the table.  
**HTTP 401/403 on `blog.list`:** unexpected. `blog.list` is public in this code. Authentication errors belong to admin and `auth.me` routes.

---

## 8. Database requirements

### Database name

The application uses the database named in `DATABASE_URL`. Current name:

```text
1a106262-d752-8f79-8000-09c1ec5340b2
```

The MySQL user needs privileges on that schema: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Admin features also need those privileges on all four tables below. No stored procedures are required.

### Tables the application queries

Defined only in `db/schema.ts`. There are four tables. There is no separate comments table, categories table, or authors table.

| Table | Used by |
| --- | --- |
| `blog_posts` | `/blog`, `/blog/:slug`, admin posts, admin stats |
| `seo_settings` | SEO on the blog page, home page, and admin SEO |
| `site_content` | Optional blog hero text and announcement bar, admin content |
| `users` | Login, session, admin role, admin stats |

`/blog` calls three procedures in one batch: `blog.list` (`blog_posts`), `content.all` (`site_content`), and `seo.get` (`seo_settings`). The post grid depends on `blog_posts`. The other two tables are needed for a fully working blog page and for the rest of the CMS. Create all four.

### `blog_posts` — columns the code expects

No foreign keys. No extra indexes beyond the primary key and the unique slug.

| Column | Type in application schema | Required | Notes |
| --- | --- | --- | --- |
| `id` | MySQL `SERIAL` (BIGINT UNSIGNED AUTO_INCREMENT) | yes | Primary key. Returned to the admin UI. |
| `title` | `VARCHAR(255)` NOT NULL | yes | |
| `slug` | `VARCHAR(255)` NOT NULL, UNIQUE | yes | Public URL is `/blog/{slug}`. |
| `excerpt` | `VARCHAR(500)` NULL | no | |
| `content` | `TEXT` NULL | no | Markdown body. |
| `coverImage` | `TEXT` NULL | no | Image URL. Column name is camelCase. |
| `tags` | `VARCHAR(500)` NULL | no | Comma-separated string, not a child table. |
| `status` | `ENUM('draft','published')` NOT NULL DEFAULT `'draft'` | yes | Public list returns only `published`. |
| `seoTitle` | `VARCHAR(255)` NULL | no | camelCase |
| `seoDescription` | `VARCHAR(500)` NULL | no | camelCase |
| `publishedAt` | `TIMESTAMP` NULL | no | Sort key for the public list, descending. |
| `createdAt` | `TIMESTAMP` NOT NULL DEFAULT CURRENT_TIMESTAMP | yes | |
| `updatedAt` | `TIMESTAMP` NOT NULL DEFAULT CURRENT_TIMESTAMP | yes | Application writes this on update. |

Public list query (verified in `server/blog-router.ts`):

```sql
SELECT id, title, slug, excerpt, content, coverImage, tags, status,
       seoTitle, seoDescription, publishedAt, createdAt, updatedAt
FROM blog_posts
WHERE status = 'published'
ORDER BY publishedAt DESC;
```

Writes use `INSERT ... ON DUPLICATE KEY UPDATE` in other CMS routers. `blog_posts` updates use a normal `UPDATE`. The MySQL account and the engine must allow those statements. `ENUM` and `ON DUPLICATE KEY UPDATE` must be supported by whatever engine is listening on port 4000.

### Other tables (same file)

**`users`**

| Column | Type |
| --- | --- |
| `id` | SERIAL primary key |
| `unionId` | VARCHAR(255) NOT NULL UNIQUE |
| `name` | VARCHAR(255) NULL |
| `email` | VARCHAR(320) NULL |
| `avatar` | TEXT NULL |
| `role` | ENUM('user','admin') NOT NULL DEFAULT 'user' |
| `createdAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP |
| `updatedAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP |
| `lastSignInAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP |

**`seo_settings`**

| Column | Type |
| --- | --- |
| `id` | SERIAL primary key |
| `pageKey` | VARCHAR(100) NOT NULL UNIQUE |
| `title` | VARCHAR(255) NULL |
| `description` | VARCHAR(500) NULL |
| `keywords` | VARCHAR(500) NULL |
| `ogImage` | TEXT NULL |
| `canonicalUrl` | VARCHAR(500) NULL |
| `robots` | VARCHAR(100) NULL DEFAULT 'index,follow' |
| `updatedAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP |

**`site_content`**

| Column | Type |
| --- | --- |
| `id` | SERIAL primary key |
| `key` | VARCHAR(100) NOT NULL UNIQUE |
| `label` | VARCHAR(255) NULL |
| `value` | TEXT NULL |
| `updatedAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP |

`db/relations.ts` does not define relationships. There are no foreign keys in the schema.

Column names are camelCase (`coverImage`, `publishedAt`, `unionId`). MySQL table and column names must match that casing. On Linux, MySQL column names are not case-sensitive for lookup, but the names still need to be these identifiers.

---

## 9. Missing migrations

**Verified:** the repository has no migration directory and no `.sql` migration files.

- Schema source of truth: `db/schema.ts` only.
- `package.json` has `db:generate`, `db:migrate`, and `db:push` (Drizzle Kit). They have not produced files in this repo.
- `db/seed.ts` contains sample blog posts, SEO rows, and site-content rows. Nothing in `package.json` runs it. It was not executed for this investigation. Seeding is optional and should happen only after the tables exist and only if the client wants sample articles.

The production database must already contain the four tables, or someone must create them. The script below is a **proposal derived from `db/schema.ts`**. It was not run. Review it against the real engine (especially `SERIAL`, `ENUM`, and `TIMESTAMP`) before applying. Take a backup first. Do not run it against a database that already has these tables unless a DBA has compared the live columns.

```sql
-- PROPOSED ONLY. Not executed. Review before use.

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

If the tables already exist with different column names or types, send `SHOW CREATE TABLE` output for all four tables instead of applying this script.

---

## 10. Environment variables

`server/lib/env.ts` loads variables from the process environment (`dotenv` in development). Production must inject them into the Node process or the serverless function. Do not commit real values.

“Currently set” means the local environment file has a non-empty value. It does **not** mean the value was accepted by Kimi or by MySQL. Database reachability was tested and failed. Kimi credentials were not exercised.

| Variable | Purpose | Required | Exposure | Sanitized example | Current state |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | MySQL connection string used by every query | Required in production | Server only | `mysql://USER:PASSWORD@ep-....privatelink.aliyuncs.com:4000/1a106262-d752-8f79-8000-09c1ec5340b2` | Set, but the host is not reachable from the current app environment (`ETIMEDOUT`). No `ssl` parameter. |
| `APP_ID` | OAuth client id. Sent to Kimi as `client_id`. Also embedded in the session JWT. | Required in production | Server only | `kimi_app_id` | Set. Same value as `VITE_APP_ID` (compared, not printed). |
| `APP_SECRET` | OAuth client secret and HMAC key for the session cookie | Required in production | Server only. Never `VITE_`. | `***` | Set. Not verified against Kimi. |
| `KIMI_AUTH_URL` | Server-side OAuth base URL | Required in production | Server only | `https://auth.kimi.com` | Set. Host is `auth.kimi.com`. Same value as `VITE_KIMI_AUTH_URL`. |
| `KIMI_OPEN_URL` | Server-side profile API base URL | Required in production | Server only | `https://open.kimi.com` | Set. Host is `open.kimi.com`. |
| `OWNER_UNION_ID` | If the logging-in user’s union id equals this value, the user is stored with role `admin` | Optional. Empty means nobody is auto-promoted to admin. | Server only | `union_id_of_owner` | Set. |
| `VITE_KIMI_AUTH_URL` | Browser OAuth authorize URL. Inlined into the JavaScript bundle at **build** time. | Required for the login button | **Public in the browser bundle** | `https://auth.kimi.com` | Set. Must be present when `npm run build` / `vite build` runs, not only at container start. |
| `VITE_APP_ID` | OAuth client id shown to the browser. Same sensitivity as a public client id, not a secret. | Required for the login button | **Public in the browser bundle** | same as `APP_ID` | Set, and it matches `APP_ID`. Also required at build time. |
| `PORT` | Listen port for the long-running Node server | Optional. Default `3000`. | Server only | `3000` | Not set. Default applies. Ignored on Vercel, where the platform invokes the function. |
| `NODE_ENV` | When `production`, missing required variables throw at startup, and the Node server listens and serves static files | Set by the host | Server only | `production` | Not set in the local env file. Production hosts should set it. |

### Present in the local environment file but not read by this application

| Variable | Current state | Action |
| --- | --- | --- |
| `KIMI_AGENTGW_API_KEY` | Set locally | Not referenced in source. Do not put it in frontend code. Not required for `/blog` or the current API. |
| `KIMI_AGENTGW_BASE_URL` | Set locally. Host `agent-gw.kimi.com`. | Not referenced in source. Outbound access to this host is not required by current code. |
| `KIMI_STORAGE_RESOURCE_ID` | Set locally | Not referenced in source. Not required by current code. |

There is no application variable named for AWS, S3, Supabase, or an SMTP server.

---

## 11. Secret and security review

Verified by searching application source (excluding dependency folders):

| Name | Where it is read | Safe in the browser? |
| --- | --- | --- |
| `DATABASE_URL` | `server/lib/env.ts`, `drizzle.config.ts` | No |
| `APP_SECRET` | `server/lib/env.ts`, then JWT signing and OAuth token exchange | No |
| `APP_ID` | Server only, plus the matching public `VITE_APP_ID` | The id is public. The secret is not. |
| `KIMI_AUTH_URL`, `KIMI_OPEN_URL`, `OWNER_UNION_ID` | Server only | No need to expose them. `KIMI_AUTH_URL` happens to match the public auth URL. |
| `KIMI_AGENTGW_API_KEY` and the other unused Kimi variables | Not read by source | Still secrets. Keep them server-side if they stay in the environment. |
| `VITE_KIMI_AUTH_URL`, `VITE_APP_ID` | `src/pages/Login.tsx` via `import.meta.env` | **Yes, by design.** Vite replaces `VITE_*` into the built JavaScript. Anyone can read them in the browser. |

No frontend file reads `DATABASE_URL`, `APP_SECRET`, or `KIMI_AGENTGW_API_KEY`.

Rules for the production host:

- Do not prefix secrets with `VITE_`.
- Do not bake `.env` into the static `dist/public` output. Only `VITE_*` values are embedded, and only those two are used.
- Session cookie `kimi_sid` is `HttpOnly`. In production the code sets `Secure` and `SameSite=None`. The public site must be served over **HTTPS**, otherwise the browser will drop the cookie and login will not stick.
- OAuth redirect used by the app is `{site origin}/api/oauth/callback`. That exact URL must be registered on the Kimi application. The cloud team does not configure this in the database, but the public HTTPS origin must be stable before login is tested.

---

## 12. API review

All JSON APIs go through one mount: **`/api/trpc/*`**.  
One non-tRPC route exists: **`GET /api/oauth/callback`**.  
Anything else under `/api/*` returns JSON 404.

There is no REST path named `/api/blog`. The blog UI calls the tRPC procedure `blog.list`.

### Procedures

| Procedure | Auth | Database tables | External HTTP | Fails today if MySQL is unreachable? |
| --- | --- | --- | --- | --- |
| `ping` | Public | none | none | No. Use this as the process check. It does not prove the database works. |
| `blog.list` | Public | `blog_posts` | none | **Yes. This is `/blog`.** |
| `blog.bySlug` | Public | `blog_posts` | none | Yes. This is `/blog/:slug`. |
| `blog.listAll` | Admin | `blog_posts` | none | Yes, and also requires a logged-in admin. |
| `blog.byId` | Admin | `blog_posts` | none | Yes |
| `blog.create` | Admin | `blog_posts` | none | Yes |
| `blog.update` | Admin | `blog_posts` | none | Yes |
| `blog.remove` | Admin | `blog_posts` | none | Yes |
| `seo.get` | Public | `seo_settings` | none | Yes. Called by `/blog` and the home page. The home page still renders because it has fallback titles. |
| `seo.listAll` | Admin | `seo_settings` | none | Yes |
| `seo.upsert` | Admin | `seo_settings` | none | Yes |
| `seo.remove` | Admin | `seo_settings` | none | Yes |
| `content.all` | Public | `site_content` | none | Yes. Called by `/blog` for the hero text. Fallback text is shown if this returns nothing. |
| `content.listAll` | Admin | `site_content` | none | Yes |
| `content.upsert` | Admin | `site_content` | none | Yes |
| `content.remove` | Admin | `site_content` | none | Yes |
| `admin.stats` | Admin | `blog_posts`, `seo_settings`, `site_content`, `users` | none | Yes |
| `auth.me` | Logged-in user | `users` | none, after the cookie is verified locally | Yes, once a cookie exists. With no cookie it returns unauthorized and does not need MySQL. |
| `auth.logout` | Logged-in user | none (clears the cookie) | none | No database write. Still requires a valid session check, which loads `users`. |
| `GET /api/oauth/callback` | Public callback | `users` (insert or update) | `KIMI_AUTH_URL`, `KIMI_OPEN_URL` | Yes. Login cannot finish without MySQL **and** outbound HTTPS to Kimi. |

Admin means: valid `kimi_sid` cookie, user row exists, and `users.role = 'admin'`. The role becomes `admin` only when `unionId` equals `OWNER_UNION_ID` at login. There is no separate admin password.

**Same infrastructure fault will hit every row marked “Yes”.** Fixing only the blog query, or only the `blog_posts` table, leaves SEO, content, login, and admin broken.

---

## 13. Production hosting requirements

### Runtime

| Requirement | Value required by this repo |
| --- | --- |
| Node.js | `22.x`, and **22.12.0 or newer**. `package.json` says `22.x`. Vite 7 refuses anything below 22.12 on the 22 line (20.19+ is the other allowed line). The machine used for this investigation is v22.11.0, which is one release short; the build warned but completed. Production should not stay on 22.11. |
| Package manager | npm. `package-lock.json` is the lockfile. |
| Install | `npm install` |
| Build | `npm run build` which runs `vite build` and then `node scripts/bundle-server.mjs` |
| Start (long-running server) | `NODE_ENV=production node dist/boot.js` (`npm start`). Listens on `PORT` or 3000. Serves `dist/public` and the API in one process. |
| Module format | `"type": "module"` (ESM). |

`VITE_KIMI_AUTH_URL` and `VITE_APP_ID` must be present **during** `npm run build`. Server secrets must be present **when the process starts**.

### Network and HTTP

- Public HTTPS on 443 for the website.
- Reverse proxy to `127.0.0.1:3000` (or the platform equivalent).
- Proxy must forward `/api/*` to the Node process. It must not replace `/api/*` with `index.html`.
- Browser routes such as `/blog` and `/admin` are client-side. The proxy must serve `index.html` when the path is not a real file and not `/api/*`. The Node server already does this in `server/lib/vite.ts`. A separate nginx rule should match that behavior.
- WebSocket is not required.
- Request body limit in the app is 50 MB (`server/app.ts`). The reverse proxy should allow at least the size you expect for CMS content. Vercel’s own body limit is smaller than 50 MB; do not assume large uploads work on Vercel.
- One long-running process, or more than one behind a load balancer. Session state is in the cookie and the database, not in server memory, so multiple instances are fine **if they share `APP_SECRET` and `DATABASE_URL`**.
- Restart the process after environment changes. The database client is created on first use and kept for the life of the process.

### Outbound

- TCP 4000 to the database (section 5).
- TCP 443 to `auth.kimi.com` and `open.kimi.com`.

### Serverless (Vercel) limitations — verified from `vercel.json`

The repo can deploy to Vercel: static files from `dist/public`, API from `api/[...path].js`. That does **not** solve this database.

- Vercel functions are not inside the Alibaba VPC. They cannot route to `10.128.x.x`.
- A PrivateLink hostname will time out from Vercel the same way it timed out from the current machine, unless a separate private-network product is added. None is configured here.
- Vercel is stateless and short-lived. That is acceptable for this app only after the database endpoint is reachable from Vercel.
- `ping` can look healthy on Vercel while every database procedure returns 500.
- The rewrite `/(.*)` → `/index.html` is for the SPA. API paths must still hit the function. After any hosting change, test `/api/trpc/ping` and a direct refresh of `/blog`.

**Recommendation:** run the long-running Node server in the Alibaba VPC (Option A). Treat Vercel as incompatible with the current PrivateLink database unless the cloud team provides a different, reachable `DATABASE_URL`.

---

## 14. Health checks

### What exists today

| Check | Exists? | What it proves |
| --- | --- | --- |
| `ping` tRPC procedure | Yes. Public. Returns `{ ok: true, ts: <unix ms> }`. | The API process handled an HTTP request. **Does not open MySQL.** |
| `/health` or `/ready` | **No** | — |
| Database health procedure | **No** | — |
| Readiness that checks Kimi | **No** | — |

Load-balancer “HTTP 200 on `/`” only proves the static shell or the Node listener. It will stay green during the current database outage. `/blog` will still fail.

### Checks to configure

| Check | Target | Success | Failure |
| --- | --- | --- | --- |
| Process alive | `GET /api/trpc/ping` | HTTP 200, body contains `"ok":true` | Process down or `/api` not routed to Node |
| Database login | `mysql ... -e "SELECT 1"` from the app host, or a future app health route | Returns a row | Network, auth, or TLS |
| Blog query | `blog.list` as in section 7.4 | HTTP 200, JSON array | 500, timeout, or missing table |
| Page | `GET /blog` | HTML of the app, then the browser shows posts or the real empty state, not an endless skeleton | SPA fallback missing (404 from the proxy) or API 500 |
| Kimi | From the app host: `curl -sS -o /dev/null -w "%{http_code}" https://auth.kimi.com/api/.well-known/jwks.json` | HTTP 200 and a JWKS document | Egress or DNS. Login will fail even if MySQL works. |

Recommended balancer split:

- **Liveness:** `/api/trpc/ping`
- **Readiness:** a database `SELECT 1` from the same host. The application does not expose this yet. Until it does, run the MySQL check beside the deploy, not only against `/`.

---

## 15. Error handling on `/blog`

Two separate problems. Only the first one is why the data is missing.

### Infrastructure root cause (verified)

`blog.list` opens MySQL to the PrivateLink host. The connection times out. tRPC returns HTTP 500. The response body includes `Failed query` and the `blog_posts` SQL text. Underlying socket error observed outside tRPC: `connect ETIMEDOUT`.

### Frontend behavior (verified, not changed)

`src/pages/Blog.tsx` does this:

- While `isLoading` is true, it shows grey placeholder cards.
- It never reads `isError` or `error`.
- If loading finishes with no `posts` array, it shows **“No posts yet — check back soon.”**

The data client is a default TanStack Query client (`src/providers/trpc.tsx`). Defaults retry a failed query **3 extra times**. Each attempt waits on the ~10 second MySQL connect timeout. The placeholders therefore stay up for a long time (on the order of half a minute or more). That matches “the post list never finishes loading.”

After retries are exhausted, `posts` is still undefined, so the page can show the empty-state sentence. That sentence is wrong for this failure. An empty published list and a dead database look similar, except for the long wait.

`/blog/:slug` has the same gap: a database error ends on “Post not found” after the loading block, because any missing `post` uses that message.

The home page calls `seo.get`, which also needs MySQL, but it always has fallback title text, so the home page still looks fine.

### Recommended frontend behavior (do not implement as part of the infrastructure work)

When `blog.list` returns 500 or times out, the page should stop the placeholders and show an error such as “The blog could not be loaded. Please try again.” It should not say there are no posts. Retry can be shorter than three full database timeouts. This is a product change for later. It does not replace network access to MySQL.

---

## 16. Logging and observability

### What the application logs today

Verified `console` usage:

| Event | Where | Level |
| --- | --- | --- |
| Missing session cookie | `server/kimi/auth.ts` | `console.warn` `[auth]` |
| OAuth callback failure | `server/kimi/auth.ts` | `console.error` `[OAuth]` |
| Kimi profile HTTP failure | `server/kimi/platform.ts` | `console.warn` `[kimi]` (includes HTTP status and response text) |
| Bad or expired session JWT | `server/kimi/session.ts` | `console.warn` `[session]` |
| SQL / connection failures | not logged by application code | Returned to the caller by tRPC as a 500 message that includes the SQL string |

There is no log library, no request id, no metric for database latency, and no alert.

On a long-running server, these lines go to the process stdout/stderr. The host should keep that stream (systemd journal, container logs, or the platform log viewer).

On Vercel, the same lines go to the function log. A timeout may appear only as a 500 in the browser if the platform log retention is short. Capture one failed `blog.list` response while reproducing.

### What to look for during this incident

| Log or response | Meaning |
| --- | --- |
| `ETIMEDOUT`, `connect ETIMEDOUT`, about 10 seconds | Security group or route. Current incident. |
| `ENOTFOUND`, `EAI_AGAIN` | DNS. PrivateLink name not visible to this host. |
| `ECONNREFUSED` | Port reachable but closed. |
| `Access denied for user` | Network works. Grants or password do not. |
| `Unknown database` | Database name in the URL is wrong. |
| `Table '*.blog_posts' doesn't exist` | Schema missing. |
| `Failed query: select ... from blog_posts` | Drizzle wrapper. Read the cause under it. The SQL text in the **browser** is not proof of a bad query. |
| `[OAuth] Callback failed` or `[kimi] Request ... failed` | Database may be fine. Kimi egress or credentials are not. |
| `[auth] No session cookie` | Normal for anonymous `/blog`. Not the blog outage. |

Please retain API stdout and the reverse-proxy access log (status and duration for `/api/trpc/*`). A 10–40 second duration on `blog.list` is the timeout plus retries.

---

## 17. Cloud-team action checklist

- [ ] Confirm the PrivateLink service behind `ep-t4ni387b5e83b7519dc8.epsrv-t4n281l4mrmemi4zls9a.ap-southeast-1.privatelink.aliyuncs.com` and that port **4000** speaks MySQL protocol.
- [ ] Choose a production network design. Preferred: run the Node application in the same Alibaba VPC (`ap-southeast-1`) that can route to `10.128.0.0/16`.
- [ ] If the app stays outside that VPC, provide peering, CEN, or a VPN, plus DNS. Do not assume Vercel can open this PrivateLink address.
- [ ] Allow **outbound TCP 4000** from the application security group to the endpoint.
- [ ] Allow **inbound TCP 4000** on the endpoint / database from that same application source. Do not open `0.0.0.0/0`.
- [ ] Confirm DNS on the application host resolves the PrivateLink name to reachable private IPs (`dig +short`).
- [ ] Confirm TCP 4000 connects in about a second (`nc` or `Test-NetConnection`).
- [ ] Confirm MySQL login to database `1a106262-d752-8f79-8000-09c1ec5340b2`.
- [ ] Confirm tables `blog_posts`, `seo_settings`, `site_content`, and `users` exist with the columns in section 8. Create them only after review of section 9 if they are absent.
- [ ] Confirm the MySQL user can `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on those tables.
- [ ] State whether TLS is required. The current URL does not enable SSL.
- [ ] Put the working URL in production `DATABASE_URL` (password only in the secret store).
- [ ] Set server-only `APP_ID`, `APP_SECRET`, `KIMI_AUTH_URL`, `KIMI_OPEN_URL`. Set `OWNER_UNION_ID` if an admin user is required.
- [ ] Set `VITE_KIMI_AUTH_URL` and `VITE_APP_ID` **before the frontend build**.
- [ ] Set `NODE_ENV=production`. Set `PORT` if it should not be 3000.
- [ ] Allow outbound TCP 443 from the app to `auth.kimi.com` and `open.kimi.com`.
- [ ] Serve the site on HTTPS and forward `/api/*` to the Node process. Serve `index.html` for `/blog`.
- [ ] Use Node.js **22.12 or newer**.
- [ ] Run the tests in section 7 and section 19.
- [ ] Send back the items in section 18.

---

## 18. Information to send back

Please reply with the following. Do not send the database password or `APP_SECRET` in email. Say where those secrets were stored instead.

1. Chosen option (A–F in section 4) and the region of the application servers.
2. Application subnet or security group ID that was granted access.
3. Database hostname the application should use.
4. Database port.
5. Database name.
6. Whether the endpoint is private or public.
7. Whether SSL/TLS is required, and any CA file the client must trust.
8. Confirmation that DNS on the application host returns reachable addresses (paste `dig +short` output).
9. Confirmation that TCP 4000 succeeds (paste the `nc` or `Test-NetConnection` result).
10. Confirmation that `SELECT 1` succeeds.
11. `SHOW TABLES` output for the target database.
12. `DESCRIBE blog_posts` (and the other three tables if they exist).
13. Whether `blog_posts` was already there or was created from section 9.
14. Engine and version behind port 4000 (for example MySQL 8.0, PolarDB, TiDB), because `ENUM` and `ON DUPLICATE KEY UPDATE` must work.
15. Confirmation that production environment variables are set server-side, including that `VITE_*` values were available at build time.
16. Public site origin (HTTPS) that will be used as the OAuth redirect `{origin}/api/oauth/callback`.

---

## 19. Acceptance tests

Run these after the cloud changes, from the production network, before calling the infrastructure done.

| # | Test | Pass condition |
| --- | --- | --- |
| 1 | Start the app with `NODE_ENV=production` | Process stays up. No `Missing required environment variable`. |
| 2 | `GET /api/trpc/ping` | HTTP 200, `"ok":true`. |
| 3 | TCP 4000 and `SELECT 1` from the app host | Both succeed without a multi-second timeout. |
| 4 | `blog.list` (section 7.4) | HTTP 200 and a JSON array. Empty array is acceptable if no row is `published`. HTTP 500 is not acceptable. |
| 5 | Open `/blog` in a browser | Loading placeholders disappear within a couple of seconds. Either real posts or “No posts yet” when the array is truly empty. A 500 must not be presented as an empty blog once error handling is added later; for this infrastructure sign-off, the API itself must already be HTTP 200. |
| 6 | `seo.get` with input page key `blog`, and `content.all` | HTTP 200. Missing rows are fine. A missing **table** is not. |
| 7 | `admin.stats` without a cookie | HTTP 401, not HTTP 500. A 500 means the auth lookup or a query crashed rather than refusing the anonymous user. |
| 8 | From the app host, HTTPS GET `https://auth.kimi.com/api/.well-known/jwks.json` | HTTP 200. |
| 9 | View source / built JS | `APP_SECRET` and `DATABASE_URL` do not appear. `VITE_APP_ID` may appear. |
| 10 | Restart or redeploy the app once | `blog.list` still returns HTTP 200. The connection must not depend on a manual tunnel that died. |
| 11 | Refresh `/blog` directly (not only by clicking from the home page) | The HTML app loads (SPA fallback), then the same API result as test 5. |

When tests 2 through 6 and 10 pass, the database path is ready for this application. Login (test 8 plus a real OAuth sign-in) is a separate check and still needs the Kimi application’s redirect URL to match the public HTTPS origin.
