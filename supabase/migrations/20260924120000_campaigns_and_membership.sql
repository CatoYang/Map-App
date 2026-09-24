-- P2 — Campaigns & membership
--
-- Tables: profiles, campaigns, memberships, invites
-- Access rules (Row Level Security) and the functions for creating a
-- campaign and joining one with an invite link.
-- Design: docs/architecture.md §5–6.

-- ===========================================================================
-- Private schema for helper functions used inside access rules.
-- Supabase's API only exposes the public schema, so clients can't call these.
-- ===========================================================================
create schema if not exists private;
grant usage on schema private to authenticated;


-- ===========================================================================
-- Tables
-- ===========================================================================

-- One row per signed-in user, created automatically on first sign-in.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 2000),
  world_pack  text not null default 'shanghai-1842-1949',
  ruleset     text,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('gm', 'player')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.invites (
  -- 16 hex characters, random; the invite link is /join/<code>
  code        text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  role        text not null default 'player' check (role in ('gm', 'player')),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at  timestamptz default now() + interval '7 days',   -- null = never expires
  max_uses    int check (max_uses > 0),                        -- null = unlimited
  uses        int not null default 0,
  created_at  timestamptz not null default now()
);
create index invites_campaign_id_idx on public.invites (campaign_id);


-- ===========================================================================
-- Helper functions for access rules
-- `security definer` lets them read memberships without triggering the
-- memberships rules themselves (which would loop).
-- ===========================================================================

create function private.is_member(p_campaign uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign and user_id = (select auth.uid())
  );
$$;

create function private.is_gm(p_campaign uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign and user_id = (select auth.uid()) and role = 'gm'
  );
$$;

-- True if the current user and p_user are in at least one campaign together.
create function private.shares_campaign(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

create function private.campaign_owner(p_campaign uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select owner_id from public.campaigns where id = p_campaign;
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;


-- ===========================================================================
-- Profiles: created automatically when someone signs in for the first time
-- ===========================================================================

create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url',
             new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users who signed in before this migration
insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;


-- ===========================================================================
-- Table permissions
-- Signed-out visitors (anon) get nothing. Signed-in users get only the
-- operations listed; the policies below then decide which rows.
-- Column lists stop e.g. a GM from changing a campaign's owner.
-- ===========================================================================

revoke all on public.profiles, public.campaigns, public.memberships, public.invites
  from anon, authenticated;

grant select                                   on public.profiles    to authenticated;
grant update (display_name, avatar_url)        on public.profiles    to authenticated;

grant select, delete                           on public.campaigns   to authenticated;
grant update (name, description, world_pack, ruleset)
                                               on public.campaigns   to authenticated;

grant select, delete                           on public.memberships to authenticated;
grant update (role)                            on public.memberships to authenticated;

grant select, delete                           on public.invites     to authenticated;
grant insert (campaign_id, role, expires_at, max_uses)
                                               on public.invites     to authenticated;


-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.profiles    enable row level security;
alter table public.campaigns   enable row level security;
alter table public.memberships enable row level security;
alter table public.invites     enable row level security;

-- Profiles --------------------------------------------------------------------

create policy "read own profile and campaign co-members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_campaign(id));

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Campaigns -------------------------------------------------------------------
-- Created only through create_campaign(), which also makes the creator GM.

create policy "members read their campaigns"
  on public.campaigns for select to authenticated
  using (private.is_member(id));

create policy "gms edit their campaigns"
  on public.campaigns for update to authenticated
  using (private.is_gm(id))
  with check (private.is_gm(id));

create policy "owner deletes campaign"
  on public.campaigns for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Memberships -----------------------------------------------------------------
-- Created only through create_campaign() and redeem_invite().
-- The campaign owner can't be removed or demoted.

create policy "members see who else is in the campaign"
  on public.memberships for select to authenticated
  using (private.is_member(campaign_id));

create policy "gms change roles"
  on public.memberships for update to authenticated
  using (private.is_gm(campaign_id) and user_id <> private.campaign_owner(campaign_id))
  with check (private.is_gm(campaign_id));

create policy "gms remove members, members leave"
  on public.memberships for delete to authenticated
  using (
    (private.is_gm(campaign_id) or user_id = (select auth.uid()))
    and user_id <> private.campaign_owner(campaign_id)
  );

-- Invites ---------------------------------------------------------------------
-- Only GMs see and manage invites. Players use them via redeem_invite().

create policy "gms read invites"
  on public.invites for select to authenticated
  using (private.is_gm(campaign_id));

create policy "gms create invites"
  on public.invites for insert to authenticated
  with check (private.is_gm(campaign_id) and created_by = (select auth.uid()));

create policy "gms revoke invites"
  on public.invites for delete to authenticated
  using (private.is_gm(campaign_id));


-- ===========================================================================
-- Functions the app calls (supabase.rpc('...'))
-- ===========================================================================

-- Create a campaign and make the caller its GM. Returns the new campaign id.
create function public.create_campaign(
  p_name        text,
  p_description text default null,
  p_world_pack  text default 'shanghai-1842-1949'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  insert into public.campaigns (name, description, world_pack, owner_id)
  values (p_name, p_description, p_world_pack, v_user)
  returning id into v_id;

  insert into public.memberships (campaign_id, user_id, role)
  values (v_id, v_user, 'gm');

  return v_id;
end;
$$;

-- What an invite link leads to, shown on the join page before accepting.
-- Returns no row if the code is unknown, expired or used up.
create function public.invite_preview(p_code text)
returns table (campaign_id uuid, campaign_name text, role text, already_member boolean)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.name,
    i.role,
    exists (
      select 1 from public.memberships m
      where m.campaign_id = c.id and m.user_id = (select auth.uid())
    )
  from public.invites i
  join public.campaigns c on c.id = i.campaign_id
  where i.code = p_code
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.uses < i.max_uses);
$$;

-- Join a campaign with an invite code. Returns the campaign id.
-- Existing members keep their role and don't use up the invite.
create function public.redeem_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_invite public.invites%rowtype;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  -- Lock the invite so two people can't both take its last use
  select * into v_invite from public.invites where code = p_code for update;

  if not found
     or (v_invite.expires_at is not null and v_invite.expires_at <= now())
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    raise exception 'This invite link is invalid or has expired';
  end if;

  if exists (
    select 1 from public.memberships
    where campaign_id = v_invite.campaign_id and user_id = v_user
  ) then
    return v_invite.campaign_id;
  end if;

  insert into public.memberships (campaign_id, user_id, role)
  values (v_invite.campaign_id, v_user, v_invite.role);

  update public.invites set uses = uses + 1 where code = p_code;

  return v_invite.campaign_id;
end;
$$;

-- Keep-alive target for the scheduled GitHub Action (stops free-tier pausing).
create function public.ping()
returns int
language sql stable
as $$ select 1 $$;

revoke all on function public.create_campaign(text, text, text) from public, anon;
revoke all on function public.invite_preview(text)              from public, anon;
revoke all on function public.redeem_invite(text)               from public, anon;
grant execute on function public.create_campaign(text, text, text) to authenticated;
grant execute on function public.invite_preview(text)              to authenticated;
grant execute on function public.redeem_invite(text)               to authenticated;
grant execute on function public.ping()                            to anon, authenticated;
