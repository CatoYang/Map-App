-- Campaign settings published from the campaign's vault note by `npm run sync`
-- (like `theme`, only the sync's secret key can change them).
--
-- settings = { "map_year": 1855 }   -- the year the campaign's map opens at

alter table public.campaigns
  add column settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(settings) = 'object');
-- (Members already read every campaign column: select is granted table-wide.)
