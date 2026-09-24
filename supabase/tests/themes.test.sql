-- Access rule tests: campaign themes and theme images.
-- Run with `npm run test:db`. Each check prints "ok  <label>" or stops with FAIL.

\set gm       '00000000-0000-0000-0000-000000000001'
\set player   '00000000-0000-0000-0000-000000000002'
\set outsider '00000000-0000-0000-0000-000000000003'

-- ---------------------------------------------------------------------------
\warn '== Setup: a campaign with a GM and a player; the sync publishes a theme'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
select public.create_campaign('Theme test') as cid \gset
insert into public.invites (campaign_id) values (:'cid') returning code \gset
select set_config('request.jwt.claim.sub', :'player', false);
select public.redeem_invite(:'code');

select tests.eq('new campaigns have an empty theme',
  (select theme from public.campaigns where id = :'cid'), '{}'::jsonb);

-- The sync uses the secret key, which bypasses the rules (here: superuser)
reset role;
update public.campaigns
  set theme = jsonb_build_object('accent', '#b01c2e', 'background', :'cid' || '/background-1a2b3c4d.webp')
  where id = :'cid';
insert into storage.objects (bucket_id, name) values
  ('campaign-assets', :'cid' || '/background-1a2b3c4d.webp'),
  ('campaign-assets', gen_random_uuid() || '/cover-other.webp'),
  ('campaign-assets', :'cid' || '/nested/not-allowed.webp');
set role authenticated;

-- ---------------------------------------------------------------------------
\warn '== Members read the theme and its images; nobody changes them'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player reads the accent colour',
  (select theme->>'accent' from public.campaigns where id = :'cid'), '#b01c2e');
select tests.eq('player sees this campaign''s theme image only',
  (select count(*) from storage.objects where bucket_id = 'campaign-assets'), 1::bigint);
select tests.throws('player cannot upload theme images',
  format($$insert into storage.objects (bucket_id, name) values ('campaign-assets', %L)$$, :'cid' || '/x.webp'));
select tests.eq('player cannot delete theme images',
  tests.affected($$delete from storage.objects where bucket_id = 'campaign-assets'$$), 0::bigint);

select set_config('request.jwt.claim.sub', :'gm', false);
select tests.throws('gm cannot change the theme in the app (published from the vault)',
  format($$update public.campaigns set theme = '{}' where id = %L$$, :'cid'));
select tests.throws('gm cannot upload theme images in the app',
  format($$insert into storage.objects (bucket_id, name) values ('campaign-assets', %L)$$, :'cid' || '/x.webp'));

select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('outsider sees no theme images',
  (select count(*) from storage.objects where bucket_id = 'campaign-assets'), 0::bigint);

select set_config('request.jwt.claim.sub', :'player', false);
delete from public.memberships where user_id = :'player' and campaign_id = :'cid';
select tests.eq('ex-member sees no theme images',
  (select count(*) from storage.objects where bucket_id = 'campaign-assets'), 0::bigint);

select set_config('request.jwt.claim.sub', :'gm', false);
delete from public.campaigns where id = :'cid';
reset role;
