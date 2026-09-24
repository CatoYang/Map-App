# Content format

How notes in the content vault (the Obsidian vault) are written, so that `npm run sync` can publish them to the app. `npm run content:check` checks every note against this guide.

Three principles:

- **The app reads only a few fields.** Everything else in the YAML and the whole note body is yours: write whatever helps. Unknown fields are kept, not rejected.
- **Secret by default.** A note is GM-only unless its `visibility` says otherwise. Sections headed *Kindred Secrets* or *GM Notes* are never shown to players.
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

## Visibility and secrets

| `visibility:` | Who sees the note in the app |
|---|---|
| *(missing)* or `gm` | GMs only |
| `players` | Everyone in the campaign |
| `[alice, bob]` | GMs, plus those players |

Player names are short handles listed in `_config/players.yaml` in the vault, which maps each handle to that player's Google e-mail. That file gets set up when the sync is built.

**Secret sections.** A heading named **Kindred Secrets** or **GM Notes**, at any level (`##` or `###`), starts a GM-only section. The section runs until the next heading of the same or a higher level. Players never see these sections, even in notes shared with them. So one note can hold both the public history of a hotel and what really happens in its basement.

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

**Not every pin needs a note.** The survey has about 1,800 buildings and most are background. Write a note when a place matters to the story.

## Types

| `type` | For | Fields the app reads (besides the common ones) |
|---|---|---|
| `location` | Places | `pin` (one or a list) or `coords`, `category`, `address`, `active_years`, `mortal_status`, `kindred_status`, `faction` |
| `character` | Mortals, including ghouls | `category`, `lifespan`, `active_years`, `mortal_status`, `status`, `affiliation`, `faction`, `location`, `domitor` (a ghoul's regnant) |
| `kindred` | Vampires | `clan`, `generation`, `sire`, `childer`, `active_years`, `kindred_status`, `faction`, `location`, `haven` |
| `faction` | Groups, mortal or Kindred | `sphere`, `active_years`, `color` |
| `event` | Timeline entries | `date`, `end_date`, `location`, `faction` |
| `placard` | Trivia and museum-style exhibits | `date` or `active_years`, `location` |
| `power` | Disciplines, rituals, ceremonies, alchemy | `discipline`, `level` |
| `reference` | Rules and setting reference (court roles, economy…) | – |
| `story` | Chronicle plans, scenarios | – |
| `index` | Pages that list other notes | – |

Link fields (`faction`, `location`, `sire`, `childer`, `domitor`) take one link or a list of them. They should point at a note of the matching type: `faction` points at `faction` notes, `location` at `location` notes, and `sire`, `childer` and `domitor` at `kindred` notes. A link to a note you haven't written yet is fine.

When there's no note to link to, use the matching free-text field instead:
- `affiliation` for a group, e.g. `Foreign Mob`;
- `haven` for a place, e.g. `A hidden yacht on the Huangpu`;
- `sire_description` for an unnamed sire, e.g. `A Lasombra Corsair`.

`clan` is one of: Banu Haqim, Brujah, Caitiff, Gangrel, Hecata, Lasombra, Malkavian, Nosferatu, Ravnos, Salubri, The Ministry, Thin-Blood, Toreador, Tremere, Tzimisce, Ventrue.

## Note text

- Write ordinary Markdown. Use `##` for sections and `###` for subsections.
- `[[Links]]` to other notes become links in the app. A link to a note the reader can't see shows as plain text.
- Images: `![[picture.jpg]]` or `![](picture.jpg)`, with the file kept in the vault. The sync uploads them. Keep image file names readable, not `…jpgutm_source…`.

## Tools

Run these in Map-App. They read the vault folder set by `CONTENT_DIR` in `.env.local`.

| Command | Does |
|---|---|
| `npm run content:check` | Checks every note and writes `_reports/Content check.md` into the vault. Changes nothing else. |
| `npm run content:standardise` | Previews rewriting notes' YAML into this format, in `_reports/Standardise preview.md`. Useful after pasting in notes written the old way. |
| `npm run content:standardise -- --apply` | Writes those changes, after backing up every note to Map-App's `local/vault-backups/`. Only the YAML block changes; note text is never touched. |

The vault was converted to this format on 2026-09-25 with `content:standardise`. The script still understands the old field names (`Category`, `Mortal Status`, `Active Years`…), so notes pasted in the old style can be converted the same way.

## Not decided yet

- **World vs campaign.** For now the whole vault publishes into one campaign. Splitting shared historical lore (a "world pack" any campaign can use) from one campaign's secrets comes with generalisation.
- **Map-only data.** Region borders, which faction controls which region when, overlay modes and colours still live in `public/data`. P4c decides how they're written.
- **`_config/players.yaml`**, and how images are uploaded, get settled when `npm run sync` is built.
