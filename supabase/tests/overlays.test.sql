-- Access rule tests: map overlays (world history and campaign overlays).
-- Run with `npm run test:db`. Each check prints "ok  <label>" or stops with FAIL.

\set gm       '00000000-0000-0000-0000-000000000001'
\set player   '00000000-0000-0000-0000-000000000002'
\set outsider '00000000-0000-0000-0000-000000000003'
\set shape    '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [[[121.47, 31.22], [121.48, 31.22], [121.48, 31.23], [121.47, 31.22]]]}}]}'

-- ---------------------------------------------------------------------------
\warn '== Setup: a campaign with a GM and a player; the GM is also a world editor'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
select public.create_campaign('Overlay test') as cid \gset
insert into public.invites (campaign_id) values (:'cid') returning code \gset
select set_config('request.jwt.claim.sub', :'player', false);
select public.redeem_invite(:'code');

select tests.throws('nobody makes themselves a world editor in the app',
  format($$insert into public.world_editors (user_id) values (%L)$$, :'player'));
reset role;
insert into public.world_editors (user_id) values (:'gm');   -- secret key / SQL editor
set role authenticated;

-- ---------------------------------------------------------------------------
\warn '== World history: world editors draw it, every signed-in user reads it'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('world editor sees their own world editor row',
  (select count(*) from public.world_editors), 1::bigint);
insert into public.overlays (world_pack, mode, era, name, faction, color, geojson, visibility)
  values ('shanghai-1842-1949', 'control', 'golden-age', 'French Concession',
          'French Concession Administration', '#002395', :'shape', 'campaign')
  returning id as world \gset
select tests.throws('world history is always public',
  $$insert into public.overlays (world_pack, mode, era, name) values ('shanghai-1842-1949', 'control', 'golden-age', 'Hidden')$$);
select tests.throws('a row is world history or a campaign''s, not both',
  format($$insert into public.overlays (campaign_id, world_pack, mode, era, name) values (%L, 'shanghai-1842-1949', 'control', 'golden-age', 'Both')$$, :'cid'));
select tests.throws('overlays must be GeoJSON feature collections',
  format($$insert into public.overlays (campaign_id, mode, era, name, geojson) values (%L, 'domains', 'golden-age', 'Bad', '{"type": "Polygon"}')$$, :'cid'));
select tests.throws('year ranges run forwards',
  format($$insert into public.overlays (campaign_id, mode, era, name, from_year, to_year) values (%L, 'domains', 'golden-age', 'Bad', 1935, 1930)$$, :'cid'));

select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player reads world history',
  (select name from public.overlays where id = :'world'), 'French Concession');
select tests.eq('player sees no world editor rows',
  (select count(*) from public.world_editors), 0::bigint);
select tests.throws('player cannot draw world history',
  $$insert into public.overlays (world_pack, mode, era, name, visibility) values ('shanghai-1842-1949', 'control', 'golden-age', 'Mine', 'campaign')$$);
select tests.eq('player cannot change world history',
  tests.affected(format($$update public.overlays set name = 'Mine' where id = %L$$, :'world')), 0::bigint);
select tests.eq('player cannot delete world history',
  tests.affected(format($$delete from public.overlays where id = %L$$, :'world')), 0::bigint);

select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('any signed-in user reads world history',
  (select count(*) from public.overlays where id = :'world'), 1::bigint);

reset role;
set role anon;
select tests.throws('signed-out visitors read nothing',
  $$select count(*) from public.overlays$$);
reset role;
set role authenticated;

-- ---------------------------------------------------------------------------
\warn '== Campaign overlays: GM draws them, players see them once revealed'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
insert into public.overlays (campaign_id, mode, era, name, faction, color, geojson)
  values (:'cid', 'domains', 'golden-age', 'Camarilla Elysium', 'The Camarilla', '#b7950b', :'shape')
  returning id as secret \gset
select tests.eq('campaign overlays start hidden from players',
  (select visibility from public.overlays where id = :'secret'), 'private');
select tests.eq('gm redraws the domain',
  tests.affected(format($$update public.overlays set to_year = 1932 where id = %L$$, :'secret')), 1::bigint);
select tests.eq('saving records who and when',
  (select updated_by from public.overlays where id = :'secret'), :'gm'::uuid);
select tests.throws('an overlay cannot move to another campaign',
  format($$update public.overlays set campaign_id = gen_random_uuid() where id = %L$$, :'secret'));
select tests.throws('an overlay cannot become world history',
  format($$update public.overlays set world_pack = 'shanghai-1842-1949' where id = %L$$, :'secret'));

select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player cannot see a hidden domain',
  (select count(*) from public.overlays where id = :'secret'), 0::bigint);
select tests.throws('player cannot draw campaign overlays',
  format($$insert into public.overlays (campaign_id, mode, era, name) values (%L, 'domains', 'golden-age', 'Mine')$$, :'cid'));

select set_config('request.jwt.claim.sub', :'gm', false);
update public.overlays set visibility = 'campaign' where id = :'secret';

select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player sees the domain once revealed',
  (select name from public.overlays where id = :'secret'), 'Camarilla Elysium');
select tests.eq('player cannot change a revealed domain',
  tests.affected(format($$update public.overlays set name = 'Mine' where id = %L$$, :'secret')), 0::bigint);
select tests.eq('player cannot delete a revealed domain',
  tests.affected(format($$delete from public.overlays where id = %L$$, :'secret')), 0::bigint);

select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('outsider cannot see the campaign''s overlays',
  (select count(*) from public.overlays where campaign_id = :'cid'), 0::bigint);

select set_config('request.jwt.claim.sub', :'player', false);
delete from public.memberships where user_id = :'player' and campaign_id = :'cid';
select tests.eq('ex-member cannot see the campaign''s overlays',
  (select count(*) from public.overlays where campaign_id = :'cid'), 0::bigint);

-- ---------------------------------------------------------------------------
\warn '== Clean-up: deleting the campaign deletes its overlays, not world history'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
delete from public.campaigns where id = :'cid';
reset role;
select tests.eq('campaign overlays go with the campaign',
  (select count(*) from public.overlays where campaign_id is not null), 0::bigint);
select tests.eq('world history stays',
  (select count(*) from public.overlays where campaign_id is null), 1::bigint);
delete from public.overlays;
delete from public.world_editors;
