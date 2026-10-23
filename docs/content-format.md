# Content format

How notes in the content vault (the Obsidian vault) are written, so that `npm run sync` can publish them to the app. `npm run content:check` checks every note against this guide.

**The vault is a world; campaigns live inside it.** One vault holds a setting, such as Shanghai 1842–1949. Each campaign (chronicle) set in that world is a `type: campaign` note, linked to a campaign in the app. Notes are shared by every campaign unless they say which campaigns they belong to. See [Campaigns](#campaigns).

Three principles:

- **The app reads only a few fields.** Everything else in the YAML and the whole note body is yours: write whatever helps. Unknown fields are kept, not rejected.
- **Secret by default.** A note is GM-only unless its `visibility` says otherwise. Sections headed *Kindred Secrets* or *GM Notes* are never shown to players. The one exception is the world timeline: real history, so every player sees it.
- **Links are relationships.** `faction: "[[The Green Gang (Qingbang)]]"` is how a character joins a faction, and `pin: enp-513` is how a place joins the map.

## Quick reference

```yaml
# Location — a place; appears on the map when it has a pin or coords
---
type: location
category: Hotel                   # free text; a list if it's several: [Casino, Nightclub]
pin: enp-1687                     # the building on the map; a list if several, OR:
# coords: [31.24361, 121.48702]   # a position, for places with no pin
address: 17 Whangpoo Road, Hongkew
active_years: 1846-1949
mortal_status: Luxury hotel
faction: "[[Foreign Expatriate Community]]"
visibility: players
---

# Character — a mortal
---
type: character
category: Underworld and Crime
lifespan: 1880-1939
active_years: 1910-1929           # years in Shanghai
mortal_status: Gambling boss
affiliation: Foreign Mob          # free text, for groups without a note
faction: "[[Foreign Expatriate Community]]"
location: ["[[Farren's]]", "[[The Del Monte]]"]
# player: alice                   # only for a player character: the player's handle
---

# Kindred — a vampire
---
type: kindred
clan: Banu Haqim
generation: 6
sire: "[[Sha'hiri]]"
childer: []
faction: "[[The Camarilla]]"
location: "[[Astor House Hotel]]"   # a location note…
haven: A hidden yacht on the Huangpu  # …or a description
active_years: 1842-
kindred_status: Archon
aliases: [Justice Bao, Bao Qingtian]
---

# Faction — mortal or Kindred
---
type: faction
sphere: mortal                    # mortal | kindred
active_years: 1854-1949
color: "#b01c2e"                  # optional; used on the map
---

# Event — a timeline entry
---
type: event
date: 1937-08-13                  # 1937, 1937-08 or 1937-08-13
end_date: 1937-11-26              # optional
location: "[[Sihang Warehouse]]"  # optional; puts the event on the map
faction: ["[[Kuomintang (KMT) and Nationalists]]", "[[Imperial Japanese Forces]]"]
---
```

The other types need only `type:`. See [Types](#types).

## Every note

**Name.** The file name is the note's name, and links find notes by name, so **no two notes may share a name**, even in different folders. Leading sort prefixes such as `01_`, `2_` or `1553-00-00_` are dropped when the name is shown in the app.

**Folders** are yours to arrange. The app shows them as groups, without their sort prefixes. Moving a note between folders changes nothing else.

**Skipped.** The sync ignores files at the top level of the vault (like `AGENTS.md`), and anything whose file or folder name starts with `_` or `.`, such as `_reports/`, `_config/`, `_templates/` and `.obsidian/`.

**YAML rules**

- Field names are `lowercase_with_underscores`.
- Links go in quotes: `faction: "[[The Camarilla]]"`. Without the quotes YAML misreads them, and the whole block can fail.
- Lists are written `[a, b]`, or one `- item` per line.
- Tags are written without `#`: `tags: [trivia, 1912]`.
- Leave a field out, or empty, rather than writing a placeholder like `"[Placeholder]"`.

**Fields every type can have**

| Field | Example | Used for |
|---|---|---|
| `type` | `location` | **Required.** What the note is. See [Types](#types). |
| `visibility` | `gm` / `players` / `[alice, bob]` | Who sees it in the app. Missing means `gm`. |
| `aliases` | `[Justice Bao, Bao Qingtian]` | Other names, for search and matching. |
| `tags` | `[trivia, nightlife]` | Filtering. |
| `campaigns` | `["[[Old_Hatreds]]"]` | Which campaigns the note belongs to. Missing means every campaign in this world. |

## Visibility and secrets

| `visibility:` | Who sees the note in the app |
|---|---|
| *(missing)* or `gm` | GMs only |
| `players` | Everyone in the campaign |
| `[alice, bob]` | GMs, plus those players |

Player names are short handles listed in `_config/players.yaml` in the vault, which maps each handle to that player's Google e-mail. That file isn't set up yet, so for now a `[alice, bob]` list keeps the note GM-only (`npm run sync` lists these notes).

**The world timeline is public.** Timeline events (`type: event`) without `campaigns:` are real history that anyone can look up, so every player sees them, whatever their `visibility`. Keep vampire lore about an event in a separate note. Events with `campaigns:` (what happened in one chronicle) follow the rules above.

**Secret sections.** A heading named **Kindred Secrets** or **GM Notes**, at any level (`##` or `###`), starts a GM-only section. The section runs until the next heading of the same or a higher level. Players never see these sections, even in notes shared with them. So one note can hold both the public history of a hotel and what really happens in its basement. (The sync stores the full note separately, where the database only gives it to GMs. Links inside secret sections don't count towards "Mentioned in".)

```markdown
### Historical Facts
Visible to anyone the note is shared with.

### Kindred Secrets
GM-only, always.
```

## Years and dates

The map's time slider reads these, so they must be numbers. Put nuance ("c.", "peaked in the 1920s") in the note text.

| Field | Form | Examples |
|---|---|---|
| `active_years`, `lifespan` | `start-end`, `start-` for still going, or a single year | `1906-1949`, `1846-`, `1930` |
| `date`, `end_date` | year, year-month, or full date | `1553`, `1937-08`, `1937-08-13` |

A decade or century becomes its span: "1930s" → `1930-1939`, "late 1930s" → `1937-1939`, "late 19th century" → `1867-1899`. For years before AD 1000, leading zeros are fine (`0751`).

When one span hides detail, keep the exact years in a matching `_detail` field. Examples: two brothers in one note, or someone with two stays in Shanghai:
```yaml
lifespan: 1866-1956
lifespan_detail: Kwok Chuen 1877-1956, Kwok Lam 1866-1933
```

Timeline events take their `date` from the file name, e.g. `1913-03-20_Assassination of Song Jiaoren` → `date: 1913-03-20`. A `00` month or day means it isn't known: `1901-00-00_…` → `date: 1901`.

## Places on the map

A **location** note appears on the map when it has one of these:

- **`pin: enp-1234`**: the note is about a building in the map's historical survey. The pin supplies the position and dates of the building.
- **`pin: [enp-511, enp-993]`**: a place with several buildings, such as a bank's head office and its branches. A comment after `#` is a good place to say which is which:
  ```yaml
  pin: [enp-511, enp-993]   # head office (20 Bund Road), Bubbling Well Road branch
  ```
- **`coords: [lat, lng]`**: for places with no pin, such as wharves, alleys and areas the survey doesn't cover.

If a note has both, `pin` wins. Without either, the note still works as a document; it just isn't on the map. Deciding which buildings a place covers is research, so add pins as the story needs them rather than all at once.

Finding the value on the map:

- Click a building. The side panel shows its `pin: enp-…` line with a **Copy** button.
- Right-click anywhere to get a `coords: […]` line.

Other notes join the map through their links. A character, Kindred, event or placard with `location: "[[Some Place]]"` belongs to that place.

**Starting a new place:** the vault's `_templates/Location.md` has every location field, with a fold-out box explaining each one. Insert it with Obsidian's *Templates: Insert template* command.

**Not every pin needs a note.** The survey has about 1,800 buildings and most are background. Write a note when a place matters to the story.

## Campaigns

A campaign note describes one chronicle and ties it to a campaign in the app:

```yaml
---
type: campaign
app_id: c363942b-dbe5-4191-a27a-9cd3e9615178   # from the campaign's address in the app: …/c/<id>
active_years: 1853-1865
background: "[[Market stalls Shanghai 1890s.jpg]]"   # backdrop inside the campaign
cover: "[[Market stalls Shanghai 1890s.jpg]]"        # its card on the campaign list
accent: "#b01c2e"                                     # lines and highlights
map_year: 1855                                        # the map opens in the era containing this year
---
```

- **Creating a campaign.** Create it in the app first, since that's where players get invited. Then copy its id into `app_id`. Each campaign note needs its own `app_id`.
- **Images** can be anywhere in the vault. Write them as links, like `"[[photo.jpg]]"`, just as Obsidian finds them by file name. The sync shrinks each image for the web (up to 2,400 px wide for a background, 1,200 px for a cover), so large originals are fine.
- **What a campaign contains:**
  - Notes **without** `campaigns` are world lore, such as locations, factions and the timeline. Every campaign in this world gets them.
  - Notes **with** `campaigns: ["[[Old_Hatreds]]"]` go only to those campaigns: that chronicle's cast, plots and handouts.
  - Either way, a note is GM-only until its `visibility` says otherwise.

## Types

| `type` | For | Fields the app reads (besides the common ones) |
|---|---|---|
| `campaign` | A chronicle set in this world | `app_id`, `active_years`, `background`, `cover`, `accent`, `map_year`. See [Campaigns](#campaigns) |
| `location` | Places | `pin` (one or a list) or `coords`, `category`, `address`, `active_years`, `mortal_status`, `kindred_status`, `faction` |
| `character` | Mortals, including ghouls | `category`, `lifespan`, `active_years`, `mortal_status`, `status`, `affiliation`, `faction`, `location`, `domitor` (a ghoul's regnant), `player` |
| `kindred` | Vampires | `clan`, `generation`, `sire`, `childer`, `active_years`, `kindred_status`, `faction`, `location`, `haven`, `player` |
| `faction` | Groups, mortal or Kindred | `sphere`, `active_years`, `color` |
| `event` | Timeline entries | `date`, `end_date`, `location`, `faction` |
| `placard` | Trivia and museum-style exhibits | `date` or `active_years`, `location` |
| `power` | Disciplines, rituals, ceremonies, alchemy | `discipline`, `level` |
| `reference` | Rules and setting reference (court roles, economy…) | – |
| `story` | Chronicle plans, scenarios | – |
| `index` | Pages that list other notes | – |
| `primer` | A public pitch page for a chronicle | `slug`, `subtitle`, `description`, `cover`, `accent`, `button_label`, `button_link`. See [Primers](#primers) |

Link fields (`faction`, `location`, `sire`, `childer`, `domitor`, `campaigns`) take one link or a list of them. They should point at a note of the matching type: `faction` points at `faction` notes, `location` at `location` notes, `sire`, `childer` and `domitor` at `kindred` notes, and `campaigns` at `campaign` notes. A link to a note you haven't written yet is fine.

When there's no note to link to, use the matching free-text field instead:
- `affiliation` for a group, e.g. `Foreign Mob`;
- `haven` for a place, e.g. `A hidden yacht on the Huangpu`;
- `sire_description` for an unnamed sire, e.g. `A Lasombra Corsair`.

`clan` is one of: Banu Haqim, Brujah, Caitiff, Gangrel, Hecata, Lasombra, Malkavian, Nosferatu, Ravnos, Salubri, The Ministry, Thin-Blood, Toreador, Tremere, Tzimisce, Ventrue.

## Primers

A primer is a public page that sells a chronicle to people who haven't joined yet, such as `https://vtm-shanghai.pages.dev/old-hatreds/`. Nobody needs to log in to read it. Nothing in the app links to it, and search engines are asked to skip it, so only people you send the link to will find it. Don't put secrets in it.

```yaml
---
type: primer
slug: old-hatreds                  # the address: /old-hatreds/
subtitle: "A Vampire: The Masquerade chronicle · Shanghai, 1853"
description: "Young vampires, old grudges, and a city being born in fire."   # under the title, and in link previews
cover: "[[1853 imagined.jpeg]]"    # the opening screen, and the picture in link previews
accent: "#b01c2e"
button_label: Join the Discord     # optional: a button at the end…
button_link: https://discord.gg/…  # …going here
campaigns: ["[[Old_Hatreds]]"]
---
```

How the note becomes the page:
- Each `## Section` is one part of the page.
- An image on the line straight after a heading, like `![[photo.jpg]]`, becomes that part's background. Other images show where they are.
- A list whose items start in bold, like `- **1842.** Britain wins…`, shows the bold part as a label. A label with `↔`, like `- **Pulp ↔ Grim.** …`, becomes a dial.
- A paragraph that starts with a bold label ending in `.`, `:`, `?` or `!`, like `**The Foreigners.** …`, becomes a card. A paragraph that's all bold is shown large.
- `[[Links]]` become plain text, because the notes they point at aren't public.
- `## GM Notes` and `## Kindred Secrets` sections are left out, as everywhere.

To publish, run `npm run primer`, then commit and push. The page is online once Cloudflare has rebuilt the site, about a minute later. To look first, run `npm run dev` and open `/old-hatreds/`.

## Note text

- Write ordinary Markdown. Use `##` for sections and `###` for subsections. The app shows the note's name as its title, so a leading `# Title` line isn't repeated.
- Timeline events: start with a `## Summary` of a sentence or two saying what happened and why it mattered to Shanghai. Timeline views show it as the event's description.
- `[[Links]]` to other notes become links in the app. A link to a note the reader can't see shows as plain text.
- Images: `![[picture.jpg]]` or `![](picture.jpg)`, with the file kept in the vault. Keep image file names readable, not `…jpgutm_source…`. The sync doesn't upload images inside notes yet; the app shows a placeholder.

## Tools

Run these in Map-App. They read the vault folder set by `CONTENT_DIR` in `.env.local`.

| Command | Does |
|---|---|
| `npm run content:check` | Checks every note and writes `_reports/Content check.md` into the vault. Changes nothing else. |
| `npm run content:standardise` | Previews rewriting notes' YAML into this format, in `_reports/Standardise preview.md`. Useful after pasting in notes written the old way. |
| `npm run sync -- --dry-run` | Shows what the sync would publish, without sending anything. |
| `npm run sync` | Publishes to the app: each campaign's look and `map_year`, then every note that belongs to the campaign, read-only (edit notes in the vault and sync again). Only changed notes are sent; notes deleted from the vault are removed from the app. Needs `SUPABASE_SECRET_KEY` in Map-App's `.env.sync.local`. |
| `npm run primer` | Turns each `type: primer` note into its public page in `public/<slug>/`. See [Primers](#primers). Commit and push the result to put it online. |
| `npm run content:standardise -- --apply` | Writes those changes, after backing up every note to Map-App's `local/vault-backups/`. Only the YAML block changes; note text is never touched. |

The vault was converted to this format on 2026-09-25 with `content:standardise`. The script still understands the old field names (`Category`, `Mortal Status`, `Active Years`…), so notes pasted in the old style can be converted the same way.

## Not decided yet

- **World vs campaign in the database.** For now, world notes are copied into each campaign that uses them. A shared "world pack" table, so they're stored once, can come with generalisation.
- **Territories** (who holds which area in each era: mortal control, military, Kindred domains, clan presence) aren't notes. They're drawn on the map by GMs and world editors and stored in Supabase; each links to its faction note by name (`faction`). Region borders for Explore mode still live in `public/data` (P4c).
- **`_config/players.yaml`** (player name → Google e-mail, for `visibility` lists and `player`) and uploading images inside notes.
