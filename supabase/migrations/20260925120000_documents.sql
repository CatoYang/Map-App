-- P3 — Documents
--
-- Markdown documents in a campaign, per-player sharing, and image storage.
-- Design: docs/architecture.md §5–6.
--
-- Who can see a document:
--   • GMs of the campaign — always
--   • its author
--   • everyone in the campaign, if visibility = 'campaign'
--   • players it's been shared with (document_grants)
-- Who can edit: GMs, the author, and players with an 'edit' grant.
-- Who can delete, share, or change visibility: GMs and the author.
-- All of the above also require still being a member of the campaign.

-- ===========================================================================
-- Tables
-- ===========================================================================

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  title       text not null default 'Untitled' check (char_length(title) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 200000),
  folder      text check (char_length(folder) between 1 and 100),   -- null = no folder
  visibility  text not null default 'private' check (visibility in ('private', 'campaign')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null
);
create index documents_campaign_id_idx on public.documents (campaign_id);

-- One table per shareable item type (documents now; overlays later) so a
-- grant is deleted with its item and can never point at a missing row.
create table public.document_grants (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  permission  text not null check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index document_grants_user_id_idx on public.document_grants (user_id);


-- ===========================================================================
-- Helper functions
-- ===========================================================================

create function private.is_campaign_member(p_campaign uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships where campaign_id = p_campaign and user_id = p_user
  );
$$;

-- The current user has a grant on the document ('edit' also counts as 'view')
create function private.has_document_grant(p_doc uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.document_grants
    where document_id = p_doc
      and user_id = (select auth.uid())
      and (permission = p_permission or permission = 'edit')
  );
$$;

create function private.can_view_document(p_doc uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc
      and private.is_member(d.campaign_id)
      and (private.is_gm(d.campaign_id)
           or d.author_id = (select auth.uid())
           or d.visibility = 'campaign'
           or private.has_document_grant(d.id, 'view'))
  );
$$;

create function private.can_edit_document(p_doc uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc
      and private.is_member(d.campaign_id)
      and (private.is_gm(d.campaign_id)
           or d.author_id = (select auth.uid())
           or private.has_document_grant(d.id, 'edit'))
  );
$$;

-- Share, change visibility, delete
create function private.can_manage_document(p_doc uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc
      and private.is_member(d.campaign_id)
      and (private.is_gm(d.campaign_id) or d.author_id = (select auth.uid()))
  );
$$;

create function private.document_campaign(p_doc uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select campaign_id from public.documents where id = p_doc;
$$;

-- Image paths look like '<campaign id>/<document id>/<file>'. Returns the
-- document id if the path has that shape and matches the document's
-- campaign, otherwise null. Never raises, so a malformed name can't break
-- queries on the storage table.
create function private.image_path_document(p_name text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) <> 3 or parts[1] !~ uuid_re or parts[2] !~ uuid_re or parts[3] = '' then
    return null;
  end if;
  if private.document_campaign(parts[2]::uuid) is distinct from parts[1]::uuid then
    return null;
  end if;
  return parts[2]::uuid;
end;
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;


-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Track who last saved and when; only GMs and the author may change visibility
-- (players with an 'edit' grant can change the text, not who sees it).
create function private.before_document_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility
     and (select auth.uid()) is not null
     and not (private.is_gm(old.campaign_id) or old.author_id = (select auth.uid())) then
    raise exception 'Only the author or a GM can change who can see a document';
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger documents_before_update
  before update on public.documents
  for each row execute function private.before_document_update();


-- ===========================================================================
-- Table permissions
-- ===========================================================================

revoke all on public.documents, public.document_grants from anon, authenticated;

grant select, delete                                      on public.documents to authenticated;
grant insert (campaign_id, title, body, folder, visibility) on public.documents to authenticated;
grant update (title, body, folder, visibility)              on public.documents to authenticated;

grant select, delete                                  on public.document_grants to authenticated;
grant insert (document_id, user_id, permission)       on public.document_grants to authenticated;
grant update (permission)                             on public.document_grants to authenticated;


-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.documents       enable row level security;
alter table public.document_grants enable row level security;

-- Documents -------------------------------------------------------------------

create policy "read documents you can see"
  on public.documents for select to authenticated
  using (
    private.is_member(campaign_id)
    and (private.is_gm(campaign_id)
         or author_id = (select auth.uid())
         or visibility = 'campaign'
         or private.has_document_grant(id, 'view'))
  );

create policy "members create documents"
  on public.documents for insert to authenticated
  with check (private.is_member(campaign_id) and author_id = (select auth.uid()));

create policy "gms, authors and editors update documents"
  on public.documents for update to authenticated
  using (
    private.is_member(campaign_id)
    and (private.is_gm(campaign_id)
         or author_id = (select auth.uid())
         or private.has_document_grant(id, 'edit'))
  )
  with check (private.is_member(campaign_id));

create policy "gms and authors delete documents"
  on public.documents for delete to authenticated
  using (
    private.is_member(campaign_id)
    and (private.is_gm(campaign_id) or author_id = (select auth.uid()))
  );

-- Grants ----------------------------------------------------------------------
-- Players see their own grants; GMs and the author see and manage all of a
-- document's grants. Grants can only be given to members of the campaign.

create policy "read own grants, managers read all"
  on public.document_grants for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage_document(document_id));

create policy "managers share documents"
  on public.document_grants for insert to authenticated
  with check (
    private.can_manage_document(document_id)
    and private.is_campaign_member(private.document_campaign(document_id), user_id)
  );

create policy "managers change grants"
  on public.document_grants for update to authenticated
  using (private.can_manage_document(document_id))
  with check (private.can_manage_document(document_id));

create policy "managers remove grants"
  on public.document_grants for delete to authenticated
  using (private.can_manage_document(document_id));


-- ===========================================================================
-- Image storage
-- Private bucket; files live at '<campaign id>/<document id>/<file>' and
-- follow the document's rules: view the document → view its images, edit the
-- document → add or remove images.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-images', 'document-images', false, 5242880,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "document images: read with the document"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'document-images'
    and private.can_view_document(private.image_path_document(name))
  );

create policy "document images: editors upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'document-images'
    and private.can_edit_document(private.image_path_document(name))
  );

create policy "document images: editors delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'document-images'
    and private.can_edit_document(private.image_path_document(name))
  );
