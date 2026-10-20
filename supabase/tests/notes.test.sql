-- Access rule tests: vault notes published as documents, their GM-only text and links.
-- Run with `npm run test:db`. Each check prints "ok  <label>" or stops with FAIL.

\set gm       '00000000-0000-0000-0000-000000000001'
\set player   '00000000-0000-0000-0000-000000000002'
\set outsider '00000000-0000-0000-0000-000000000003'

-- ---------------------------------------------------------------------------
\warn '== Setup: a campaign with a GM and a player; the sync publishes notes'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
select public.create_campaign('Notes test') as cid \gset
insert into public.invites (campaign_id) values (:'cid') returning code \gset
select set_config('request.jwt.claim.sub', :'player', false);
select public.redeem_invite(:'code');
select set_config('request.jwt.claim.sub', :'gm', false);
insert into public.documents (campaign_id, title, body) values (:'cid', 'My notes', 'x') returning id as own \gset

-- The sync uses the secret key, which bypasses the rules (here: superuser)
reset role;
insert into public.documents (campaign_id, title, body, folder, visibility, source_path, note_name, note_type, meta)
  values (:'cid', 'Battle of Muddy Flat', 'Foreign forces rout the Qing camp.', 'Timeline', 'campaign',
          '01_Timeline/1854-04-04_Battle of Muddy Flat.md', '1854-04-04_Battle of Muddy Flat', 'event',
          '{"date": "1854-04-04"}')
  returning id as event \gset
insert into public.documents (campaign_id, title, body, visibility, source_path, note_name, note_type)
  values (:'cid', 'Astor House', 'A hotel on the Bund.', 'campaign', '03_Locations/Astor House.md', 'Astor House', 'location')
  returning id as hotel \gset
insert into public.documents (campaign_id, title, body, source_path, note_name, note_type)
  values (:'cid', 'The Prince', 'Rules the Old City.', '07_Kindred/The Prince.md', 'The Prince', 'kindred')
  returning id as prince \gset
insert into public.document_secrets (document_id, body)
  values (:'hotel', E'A hotel on the Bund.\n\n## Kindred Secrets\nThe Prince feeds in the cellar.');
insert into public.document_links (campaign_id, from_id, to_id, field) values
  (:'cid', :'event', :'hotel', 'location'),
  (:'cid', :'hotel', :'prince', 'body');
select tests.throws('one copy of a vault note per campaign',
  format($$insert into public.documents (campaign_id, title, source_path) values (%L, 'dup', '03_Locations/Astor House.md')$$, :'cid'));
set role authenticated;

-- ---------------------------------------------------------------------------
\warn '== Players see shared notes, not GM-only notes or GM-only sections'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player sees the timeline event',
  (select meta->>'date' from public.documents where id = :'event'), '1854-04-04');
select tests.eq('player sees the shared location without its secrets',
  (select body from public.documents where id = :'hotel'), 'A hotel on the Bund.');
select tests.eq('player cannot see a GM-only note',
  (select count(*) from public.documents where id = :'prince'), 0::bigint);
select tests.eq('player cannot read GM-only sections',
  (select count(*) from public.document_secrets), 0::bigint);
select tests.eq('player sees links between notes they can see',
  (select count(*) from public.document_links where from_id = :'event'), 1::bigint);
select tests.eq('player cannot see links to a GM-only note',
  (select count(*) from public.document_links where to_id = :'prince'), 0::bigint);
select tests.throws('player cannot add links',
  format($$insert into public.document_links (campaign_id, from_id, to_id, field) values (%L, %L, %L, 'body')$$, :'cid', :'hotel', :'event'));
select tests.throws('player cannot publish a vault note',
  format($$insert into public.documents (campaign_id, title, source_path) values (%L, 'x', 'fake.md')$$, :'cid'));

-- ---------------------------------------------------------------------------
\warn '== GMs read everything but edit notes in the vault, not the app'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('gm reads the full note',
  (select body from public.document_secrets where document_id = :'hotel'),
  E'A hotel on the Bund.\n\n## Kindred Secrets\nThe Prince feeds in the cellar.');
select tests.eq('gm sees every link', (select count(*) from public.document_links), 2::bigint);
select tests.throws('gm cannot edit a published note',
  format($$update public.documents set body = 'x' where id = %L$$, :'hotel'));
select tests.throws('gm cannot hide a published note',
  format($$update public.documents set visibility = 'private' where id = %L$$, :'event'));
select tests.eq('gm cannot delete a published note',
  tests.affected(format($$delete from public.documents where id = %L$$, :'hotel')), 0::bigint);
select tests.throws('gm cannot change GM-only sections',
  format($$update public.document_secrets set body = 'x' where document_id = %L$$, :'hotel'));
select tests.eq('gm still edits app documents',
  tests.affected(format($$update public.documents set body = 'y' where id = %L$$, :'own')), 1::bigint);

-- ---------------------------------------------------------------------------
\warn '== Outsiders see nothing'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('outsider sees no notes',
  (select count(*) from public.documents where campaign_id = :'cid'), 0::bigint);
select tests.eq('outsider sees no links', (select count(*) from public.document_links), 0::bigint);

-- The sync can still update and remove notes (its secret key has no user)
reset role;
select set_config('request.jwt.claim.sub', '', false);
update public.documents set body = 'Updated by the sync' where id = :'hotel';
select tests.eq('sync updates a published note', (select body from public.documents where id = :'hotel'), 'Updated by the sync');
delete from public.documents where id = :'hotel';
select tests.eq('removing a note removes its secrets and links',
  (select count(*) from public.document_secrets) + (select count(*) from public.document_links), 0::bigint);
delete from public.campaigns where id = :'cid';
