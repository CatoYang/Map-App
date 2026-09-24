-- Campaign look: cover image, background image and accent colour.
--
-- Published from the campaign's vault (`_campaign/campaign.yaml`) by
-- `npm run sync`, which uses the secret key and so bypasses these rules.
-- Nothing here lets a signed-in user change a theme or upload theme images.
--
-- theme = { "accent": "#b01c2e", "cover": "<storage path>", "background": "<storage path>" }

alter table public.campaigns
  add column theme jsonb not null default '{}'::jsonb
  check (jsonb_typeof(theme) = 'object');
-- (Members already read every campaign column: select is granted table-wide.)


-- ===========================================================================
-- Theme images
-- Private bucket; files live at '<campaign id>/<file>'. Any member of the
-- campaign can see them.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-assets', 'campaign-assets', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- The campaign a theme image belongs to: '<uuid>/<file>' → uuid, else null.
create function private.asset_path_campaign(p_name text)
returns uuid
language plpgsql immutable security definer set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) <> 2 or parts[2] = ''
     or parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return parts[1]::uuid;
end;
$$;

grant execute on function private.asset_path_campaign(text) to authenticated;

create policy "campaign assets: members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'campaign-assets'
    and private.is_member(private.asset_path_campaign(name))
  );
