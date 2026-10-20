-- P4b — Vault notes published as documents (`npm run sync`, part 3)
--
-- The sync copies each vault note into the documents of every campaign it
-- belongs to (docs/content-format.md#campaigns). A published note:
--   • has `source_path` (its path in the vault) and is read-only in the app:
--     the vault is where it's edited, and the next sync would undo app edits
--   • carries what the app shows besides the text: `note_type` (event,
--     character, …), `note_name` (the file name, which [[links]] use) and
--     `meta` (the fields the app reads, e.g. date, clan, faction)
--   • is stored twice if it has GM-only sections (Kindred Secrets, GM Notes):
--     `documents.body` without them, for everyone who can see the note, and
--     `document_secrets.body` with them, for GMs only. The database refuses
--     the full text to players; hiding it in the page wouldn't be enough.
-- `document_links` records which note links to which, for "mentioned in"
-- lists; a link only shows to someone who can see both notes.
-- Only the sync (secret key) writes any of this.

-- ===========================================================================
-- Documents: published notes
-- ===========================================================================

alter table public.documents
  add column source_path text check (char_length(source_path) between 1 and 500),
  add column source_hash text,   -- the sync skips notes that haven't changed
  add column note_name   text check (char_length(note_name) between 1 and 300),
  add column note_type   text check (char_length(note_type) between 1 and 50),
  add column meta        jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object');

-- One copy of a vault note per campaign (app documents have no source_path)
alter table public.documents
  add constraint documents_campaign_source_key unique (campaign_id, source_path);

-- Vault folder paths ("Timeline / Treaty Ports & Rebellions (1842-1895) / …")
-- are longer than folders typed in the app
alter table public.documents drop constraint documents_folder_check;
alter table public.documents
  add constraint documents_folder_check check (char_length(folder) between 1 and 300);

-- Published notes can't be edited in the app. (Users can't set the new
-- columns at all: insert/update are granted on named columns only.)
create or replace function private.before_document_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.source_path is not null and (select auth.uid()) is not null then
    raise exception 'This note is published from the vault; edit it there';
  end if;
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

drop policy "gms and authors delete documents" on public.documents;
create policy "gms and authors delete documents"
  on public.documents for delete to authenticated
  using (
    source_path is null
    and private.is_member(campaign_id)
    and (private.is_gm(campaign_id) or author_id = (select auth.uid()))
  );


-- ===========================================================================
-- Full text of notes with GM-only sections
-- ===========================================================================

create table public.document_secrets (
  document_id uuid primary key references public.documents (id) on delete cascade,
  body        text not null check (char_length(body) <= 200000)   -- the whole note, secrets included
);

revoke all on public.document_secrets from anon, authenticated;
grant select on public.document_secrets to authenticated;
alter table public.document_secrets enable row level security;

create policy "gms read full notes"
  on public.document_secrets for select to authenticated
  using (private.is_gm(private.document_campaign(document_id)));


-- ===========================================================================
-- Links between notes
-- ===========================================================================

create table public.document_links (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  from_id     uuid not null references public.documents (id) on delete cascade,
  to_id       uuid not null references public.documents (id) on delete cascade,
  field       text not null check (char_length(field) between 1 and 50),   -- 'body', or the YAML field ('faction', 'location', …)
  primary key (from_id, to_id, field)
);
create index document_links_to_id_idx on public.document_links (to_id);
create index document_links_campaign_id_idx on public.document_links (campaign_id);

revoke all on public.document_links from anon, authenticated;
grant select on public.document_links to authenticated;
alter table public.document_links enable row level security;

create policy "read links between notes you can see"
  on public.document_links for select to authenticated
  using (private.can_view_document(from_id) and private.can_view_document(to_id));
