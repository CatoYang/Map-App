-- P4c/P5 — Map overlays, drawn on the map
--
-- An overlay row is one territory in one era: who holds which area, drawn as
-- shapes. Each era is its own snapshot (`era` is a config.json epoch id), with
-- an optional year range for a change partway through the era.
--
-- Two kinds of row:
--   • World history (campaign_id null, world_pack set): mortal control,
--     military. Shared by every campaign in that world; any signed-in user
--     reads them; only world editors change them.
--   • Campaign overlays (campaign_id set): Kindred domains, clan presence.
--     GMs see and draw them; players see them once visibility = 'campaign'
--     (the GM's "reveal").
-- Design: docs/architecture.md §4–6.

-- ===========================================================================
-- Tables
-- ===========================================================================

-- Who may draw world history. Added by hand with the secret key (SQL editor):
--   insert into public.world_editors (user_id) values ('<profile id>');
create table public.world_editors (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.overlays (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete cascade,   -- null = world history
  world_pack  text check (char_length(world_pack) between 1 and 100),    -- set on world rows only
  mode        text not null check (mode ~ '^[a-z][a-z0-9-]{0,39}$'),     -- e.g. 'control', 'domains'
  era         text not null check (era ~ '^[a-z0-9][a-z0-9-]{0,59}$'),   -- config.json epoch id
  from_year   int check (from_year between 1 and 9999),                  -- null = from the era's start
  to_year     int check (to_year between 1 and 9999),                    -- null = to the era's end
  name        text not null check (char_length(name) between 1 and 200),
  faction     text check (char_length(faction) between 1 and 200),       -- vault faction note, e.g. 'The Camarilla'
  color       text not null default '#888888' check (color ~ '^#[0-9a-fA-F]{6}$'),
  pattern     text check (pattern ~ '^[a-z0-9-]{1,40}$'),                -- fill pattern id (StyleEngine)
  geojson     jsonb not null default '{"type": "FeatureCollection", "features": []}'::jsonb
              check (geojson->>'type' = 'FeatureCollection'
                     and jsonb_typeof(geojson->'features') = 'array'
                     and octet_length(geojson::text) <= 2000000),
  visibility  text not null default 'private' check (visibility in ('private', 'campaign')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,

  -- A row is either world history or a campaign's, never both; world history is public
  check ((campaign_id is null) = (world_pack is not null)),
  check (campaign_id is not null or visibility = 'campaign'),
  check (from_year is null or to_year is null or from_year <= to_year)
);
create index overlays_campaign_id_idx on public.overlays (campaign_id);
create index overlays_world_pack_idx  on public.overlays (world_pack) where campaign_id is null;


-- ===========================================================================
-- Helper functions
-- ===========================================================================

create function private.is_world_editor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.world_editors where user_id = (select auth.uid()));
$$;

-- Draw, change or delete this overlay: world editors for world history, GMs for a campaign's
create function private.can_edit_overlay(p_campaign uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case when p_campaign is null then private.is_world_editor()
              else private.is_gm(p_campaign) end;
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;


-- ===========================================================================
-- Triggers
-- ===========================================================================

create function private.before_overlay_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger overlays_before_update
  before update on public.overlays
  for each row execute function private.before_overlay_update();


-- ===========================================================================
-- Table permissions
-- ===========================================================================

revoke all on public.overlays, public.world_editors from anon, authenticated;

grant select on public.world_editors to authenticated;   -- own row only (policy below)

grant select, delete on public.overlays to authenticated;
grant insert (campaign_id, world_pack, mode, era, from_year, to_year, name, faction, color, pattern, geojson, visibility)
  on public.overlays to authenticated;
-- Not campaign_id / world_pack: an overlay can't move between campaigns or into world history
grant update (mode, era, from_year, to_year, name, faction, color, pattern, geojson, visibility)
  on public.overlays to authenticated;


-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.world_editors enable row level security;
alter table public.overlays      enable row level security;

create policy "read own world editor row"
  on public.world_editors for select to authenticated
  using (user_id = (select auth.uid()));

create policy "read world history and campaign overlays you can see"
  on public.overlays for select to authenticated
  using (
    campaign_id is null
    or (private.is_member(campaign_id)
        and (private.is_gm(campaign_id) or visibility = 'campaign'))
  );

create policy "editors draw overlays"
  on public.overlays for insert to authenticated
  with check (private.can_edit_overlay(campaign_id));

create policy "editors change overlays"
  on public.overlays for update to authenticated
  using (private.can_edit_overlay(campaign_id))
  with check (private.can_edit_overlay(campaign_id));

create policy "editors delete overlays"
  on public.overlays for delete to authenticated
  using (private.can_edit_overlay(campaign_id));
