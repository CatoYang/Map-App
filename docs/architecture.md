# Architecture

_Last updated: 2026-09-24_

## 1. Purpose

Map-App is growing from a single map viewer into a **campaign companion for tabletop role-playing games**. A GM runs a campaign (a group). Players join it with Google sign-in and an invite link. Inside a campaign, members can use:

- **Maps** — the existing historical map viewer, plus campaign-specific overlays
- **Documents** — lore, handouts, journals and GM notes, written in markdown

Access is controlled **per campaign** and **per player**. For example, the GM can give a secret handout to one player only.

The main user for now is the owner, running their own campaigns. Opening it to other GMs (**generalisation**) comes later, but nothing built now should make that harder (see §9).

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + React Router**, a single-page app (SPA) | Already on Vite; largest pool of tutorials and examples; no server code to write |
| Backend | **Supabase** (Postgres database, authentication, file storage) | Login, data and access rules in one place. Row Level Security suits per-player secrets. Open source, so it can be self-hosted or migrated later |
| Login | **Google sign-in** via Supabase Auth | No passwords to store; players already have Google accounts |
| Hosting | **Cloudflare Pages** (app) + **Cloudflare R2** (map tiles) | Already set up; R2 was the planned home for tiles |
| Document format | **Markdown**, stored in the database | Existing local files import unchanged; anything written in the app stays exportable |
| Security model | Enforced **in the database** (Row Level Security), never only in the UI | Browser code can be edited by the user; only the database can reliably refuse a request |

## 3. System overview

```
┌────────────────────────────────────────────────────┐
│  Web app — React SPA on Cloudflare Pages           │
│                                                    │
│  /login  /campaigns  /c/:id  /c/:id/docs/:docId    │
│  /c/:id/map/:mapId ── MapPage wraps the existing   │
│                       Leaflet code (src/map/)      │
└──────────────┬─────────────────────────┬───────────┘
               │ private (logged in)     │ public
               ▼                         ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  Supabase                │   │  Static world packs      │
│  • Auth (Google)         │   │  • /worlds/<pack>/       │
│  • Postgres + RLS        │   │    world.json, regions,  │
│    campaigns, members,   │   │    pins                  │
│    documents, overlays,  │   │  • Tiles on Cloudflare R2│
│    grants                │   │                          │
│  • Storage (images)      │   │  Not secret; shared by   │
│                          │   │  every campaign          │
└──────────────────────────┘   └──────────────────────────┘
```

### How login works

1. The user clicks **Sign in with Google**. Supabase redirects to Google, then back to the app.
2. Supabase gives the browser a **session token**. The Supabase client library stores it and refreshes it automatically.
3. Every database request carries that token. The database knows the user's id (`auth.uid()`) and applies the Row Level Security rules in §6 to each row.

The app's pages also check whether the user is logged in (the "auth guard"), but only for convenience: it saves loading a page that would come back empty. The **real** protection is §6.

## 4. Data: world vs campaign

Every piece of data is one of two kinds, and each kind lives in a different place.

| | **World data** | **Campaign data** |
|---|---|---|
| What | Historical base: tiles, eras, building pins, district boundaries, historical factions | Anything about *this* story: characters, bloodlines, sects, havens, handouts, GM notes |
| Secret? | No | Yes, per campaign and sometimes per player |
| Stored in | Static files (`public/worlds/<pack>/`) and R2 for tiles | Supabase database |
| Loaded via | `fetch` from the CDN | Supabase client (so RLS applies) |

### World pack

A world pack is a folder describing one setting, for example `public/worlds/shanghai-1842-1949/`:

```
world.json        name, default centre/zoom, eras (was EPOCHS), pin categories
                  (was CATEGORY_COLORS), base layers (was map-sources.json),
                  region list (was config.json regions), fill patterns
regions/*.geojson
pins/*.json
assets/           flags, pattern images
```

Tiles are referenced by URL (R2) and are not stored in the repo.

Anything that currently lives in `src/utils/constants.js`, `StyleEngine.js` or `config.json` and describes Shanghai moves into `world.json`. The app code must work with **any** world pack.

## 5. Data model

All campaign tables carry a `campaign_id`. Ids are UUIDs.

```
profiles        id (= auth user id), display_name, avatar_url

campaigns       id, name, description,
                world_pack       -- e.g. 'shanghai-1842-1949'
                ruleset          -- e.g. 'vtm'; drives ruleset-specific modes later
                owner_id, created_at

memberships     campaign_id, user_id, role ('gm' | 'player'), joined_at
                primary key (campaign_id, user_id)

invites         code (random), campaign_id, role, created_by,
                expires_at, max_uses, uses

documents       id, campaign_id, author_id, title,
                body             -- markdown
                folder           -- simple grouping, e.g. 'Lore', 'Handouts'
                visibility ('private' | 'campaign'),
                created_at, updated_at

maps            id, campaign_id, name, world_pack,
                settings (json)  -- per-campaign overrides: default era, enabled modes
                visibility ('private' | 'campaign')

overlays        id, campaign_id, map_id, mode (e.g. 'bloodlines', 'sects'),
                name, color, icon, active_start, active_end,
                geojson (json)   -- polygons and/or points
                visibility ('private' | 'campaign')

document_grants document_id, user_id, permission ('view' | 'edit')
overlay_grants  (later) overlay_id, user_id, permission — one grants table per
                item type, so grants are deleted with their item and can't
                point at missing rows
```

### Visibility and permissions

There are only two visibility values. Grants add access on top of them.

| Visibility | Who can **view** |
|---|---|
| `campaign` | Every member of the campaign |
| `private` | The author, the GMs, and anyone with a grant |

| Who can **edit** | |
|---|---|
| GMs | Everything in their campaign |
| Author | Their own items |
| Others | Only with an `edit` grant |

The rules this produces:

- **GMs see everything** in their campaign. There can be several GMs (co-GMs).
- A **secret handout** for one player is a `private` document with a `view` grant for that player.
- A **player journal** is a `private` document the player authored. They and the GMs can see it.
- A **shared party document** is a `campaign` document with `edit` grants for the players who may edit it.
- **Revealing** something to everyone means changing `private` → `campaign`.

## 6. Security rules (Row Level Security)

RLS is switched on for every table. Rules are written as SQL policies and kept in `supabase/migrations/` so they are version-controlled.

The real rules live in `supabase/migrations/` and are tested with `npm run test:db`, which applies every migration to a throwaway Postgres in Docker and checks what a GM, player, outsider and signed-out visitor can and can't do (`supabase/tests/access_rules.sql`). Add a test there whenever a rule changes.

Helper functions keep the policies short. They are `security definer` so they can read `memberships` without tripping its own rules, and they live in a `private` schema that the Supabase API doesn't expose (the examples below omit the `private.` prefix):

```sql
create function is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                 where campaign_id = c and user_id = auth.uid());
$$;

create function is_gm(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships
                 where campaign_id = c and user_id = auth.uid() and role = 'gm');
$$;

create function has_grant(t text, i uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from document_grants   -- simplified; see migrations
                 where document_id = i and user_id = auth.uid()
                   and (permission = perm or permission = 'edit'));  -- edit implies view
$$;
```

Example: documents.

```sql
alter table documents enable row level security;

create policy "read documents" on documents for select using (
  is_gm(campaign_id)
  or author_id = auth.uid()
  or (visibility = 'campaign' and is_member(campaign_id))
  or has_grant('document', id, 'view')
);

create policy "edit documents" on documents for update using (
  is_gm(campaign_id)
  or author_id = auth.uid()
  or has_grant('document', id, 'edit')
);

create policy "create documents" on documents for insert with check (
  is_member(campaign_id) and author_id = auth.uid()
);
```

`maps` and `overlays` follow the same pattern. A few operations need special handling:

- **Joining with an invite**: a player can't insert their own membership row, so joining goes through a database function `redeem_invite(code)`. It checks the code, expiry and use count, then inserts the membership.
- **Creating a campaign**: `create_campaign(name, world_pack)` inserts the campaign and makes the creator its GM in one step.
- **Grants**: only GMs, or the author of the item, can create grants for it.

### Keys and secrets

- The **publishable key** and project URL go in the frontend as `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, committed in `.env.production` (local dev uses `.env.local`). They are safe to publish, because RLS decides what each key holder can do.
- The **service role key** bypasses RLS. It must **never** appear in frontend code or in the repo.

### User-written content

Players can write documents, so rendered markdown must be **sanitised** (DOMPurify) before it is inserted into the page. Otherwise one player could embed a script that runs in another player's or the GM's browser. The same applies to any user data placed into `innerHTML`, including map labels and legends.

## 7. Frontend

### Routes

| Route | Page | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/login` | Google sign-in | Public |
| `/join/:code` | Redeem an invite, then go to the campaign | Logged in |
| `/campaigns` | Your campaigns; create a campaign | Logged in |
| `/c/:id` | Campaign home: maps, documents, members | Member |
| `/c/:id/docs/:docId` | Read or edit a document | Per §5 |
| `/c/:id/map/:mapId` | Map viewer | Per §5 |
| `/c/:id/admin` | Members, invites, roles, grants | GM |

Deep links (e.g. opening `/c/123/docs/456` directly) work without extra config: when a Cloudflare Pages project has no top-level `404.html`, it serves `index.html` for unknown paths and React Router takes over. Don't add a `_redirects` rule `/* /index.html 200` — Cloudflare treats it as an infinite loop and ignores it.

### Folder layout

```
src/
  main.jsx              React entry
  app/                  router, layout, auth guard, session context
  pages/                Landing, Login, Join, Campaigns, CampaignHome,
                        DocumentPage, MapPage, Admin
  components/           shared UI (buttons, dialogs, markdown view/editor)
  lib/supabase.js       Supabase client
  lib/api/              one file per table: campaigns.js, documents.js, ...
  map/                  the existing Leaflet app (core/, features/, ui/, utils/)
public/
  worlds/<pack>/        world packs
supabase/
  migrations/           schema + RLS policies, applied in order
docs/
```

A component library saves building buttons, forms and dialogs by hand. **Mantine** is a good fit: it has complete components and good docs, and works without extra setup.

### Map integration

The Leaflet code is kept, not rewritten:

1. Move `src/core`, `src/features`, `src/ui` and `src/utils` into `src/map/`.
2. Turn `init()` in the old `main.js` into `createMap(container, { world, campaign })`, returning a `destroy()` function.
3. `MapPage` renders the sidebar and toolbar markup (currently in `index.html`), calls `createMap` in a `useEffect`, and calls `destroy()` on unmount.
4. `DataLoader` gets two sources:
   - **world**: `fetch('/worlds/<pack>/...')`, as today
   - **campaign**: overlays and map settings from Supabase (RLS applies automatically)
5. View modes stop being hardcoded in `ModeManager` / `main.js`. They are built from `world.json` (historical modes) plus the campaign's overlay `mode` values (e.g. bloodlines, sects).

### Document editor

- Markdown is the storage format. The editor (`MarkdownEditor.jsx`) is a plain markdown text area with a formatting toolbar and a live preview (write / split / preview). Nothing is lost converting to and from a rich-text model; a WYSIWYG editor (Milkdown, TipTap) can come with the UI pass if players find markdown awkward.
- Rendering goes through `src/lib/markdown.js`: `marked` → HTML → DOMPurify, so scripts and other active content are stripped.
- **Import**: upload one or more `.md` files; the title comes from the file name. Imports start private.
- **Export**: download a document as `.md`, or everything you can see in a campaign as a `.zip` with folders as directories. This also serves as a personal backup. Images aren't included in the export yet.
- **Concurrent edits**: no live co-editing. Saving only succeeds if `updated_at` still matches the version the edit started from; otherwise the editor offers "keep editing", "load their version" or "replace with mine".
- **Images**: private bucket `document-images`, paths `<campaign id>/<document id>/<file>`; storage rules mirror the document (view it → see its images, edit it → add or remove them). Markdown refers to them as `![alt](storage:<path>)`, and `MarkdownView` swaps in a one-hour signed URL. Uploading: toolbar button or paste. Images of a deleted document stay in storage for now.

## 8. Deployment

| Piece | Where | Notes |
|---|---|---|
| App | Cloudflare Pages (project `campaign-orchestrator`, https://vtm-shanghai.pages.dev) | Cloudflare's Git integration builds every push: `main` → production, other branches → preview URLs (`<branch>.vtm-shanghai.pages.dev`). Supabase URL and publishable key come from the committed `.env.production` (no dashboard variables needed). GitHub Actions only runs a build check |
| Tiles | Cloudflare R2 | Tile URL in `world.json` points at the bucket |
| Database, auth, storage | Supabase (free tier) | Free projects pause after about a week without activity and are resumed from the dashboard. Check the tier's backup limits and use the markdown export as a safety net |
| Google sign-in | Google Cloud OAuth client | Redirect URI is the Supabase auth callback. Add the production and `localhost` URLs to Supabase's allowed redirect list |

Schema changes are made as migration files in `supabase/migrations/` (Supabase CLI), so the database structure is reproducible and reviewable. Avoid changing it by hand in the dashboard.

## 9. Generalisation guardrails

Generalisation is deferred, but these rules keep it cheap:

1. **No setting-specific content in app code.** Shanghai eras, pin categories, flag patterns and Vampire-specific modes belong in world packs or campaign data, never in `src/`.
2. **Every private row has a `campaign_id`** and is covered by RLS. There are no global secret tables.
3. **Campaigns reference a world pack by id**, so a second setting means adding a folder, not changing code.
4. **Ruleset features hang off `campaigns.ruleset`** instead of being always on.
5. **No "the one GM" assumptions.** Roles are per membership, so any user can be a GM in one campaign and a player in another.

## 10. Build phases

Each phase ends with something usable. Tasks are tracked in `TODO.md` under **Platform**.

1. **Foundations**: React shell, Google login, map mounted behind `/c/:id/map` with its current data.
2. **Campaigns & membership**: schema, RLS, invites, campaign home.
3. **Documents**: read, write, import/export, visibility and per-player grants.
4. **Map data split**: world pack extracted, tiles on R2, campaign overlays in Supabase, nothing secret left in `public/`.
5. **GM tools**: in-app management of members, invites, grants and reveals; overlay editing on the map.
6. **Generalisation** (deferred): other GMs, selectable or uploadable world packs, ruleset-agnostic modes.

> Until phase 4 is done, campaign data in `public/data/` (characters, bloodlines, sects) is still publicly readable by URL, even behind the login page. Keep genuinely secret material out of `public/` until then.

## 11. Open questions (decide when reached)

- Linking documents and the map, e.g. a markdown link `[Cathay Hotel](map:pin/123)` that opens the map at that building, and map pins that list related documents.
- Secrets for individual map features: v1 grants apply to a whole overlay, so one secret haven means one overlay.
- A campaign timeline or event log (TODO Phase 6), which could become a document type with dates tied to map eras.
- Live co-editing, if "warn on conflict" proves too limiting.
