-- Access rule tests: documents, sharing and document images.
-- Run with `npm run test:db`. Each check prints "ok  <label>" or stops with FAIL.

\set gm       '00000000-0000-0000-0000-000000000001'
\set player   '00000000-0000-0000-0000-000000000002'
\set outsider '00000000-0000-0000-0000-000000000003'
\set player2  '00000000-0000-0000-0000-000000000005'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'player2', 'player2@example.com', '{"full_name": "Quinn Player"}');

-- ---------------------------------------------------------------------------
\warn '== Setup: a campaign with a GM and two players'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
select public.create_campaign('Docs test') as cid \gset
insert into public.invites (campaign_id, max_uses) values (:'cid', 2) returning code \gset
select set_config('request.jwt.claim.sub', :'player', false);
select public.redeem_invite(:'code');
select set_config('request.jwt.claim.sub', :'player2', false);
select public.redeem_invite(:'code');

-- ---------------------------------------------------------------------------
\warn '== GM documents: private notes, shared lore, handouts'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
insert into public.documents (campaign_id, title, body) values (:'cid', 'GM notes', 'The Prince is a Tzimisce') returning id as notes \gset
insert into public.documents (campaign_id, title, body, visibility) values (:'cid', 'Lore', 'Shanghai, 1932', 'campaign') returning id as lore \gset
insert into public.documents (campaign_id, title, body, folder) values (:'cid', 'Handout', 'A letter', 'Handouts') returning id as handout \gset
select tests.eq('new documents are private by default', (select visibility from public.documents where id = :'notes'), 'private');
select tests.eq('author recorded', (select author_id from public.documents where id = :'notes'), :'gm'::uuid);
select tests.eq('gm shares handout with player (view)',
  tests.affected(format($$insert into public.document_grants (document_id, user_id, permission) values (%L, %L, 'view')$$, :'handout', :'player')), 1::bigint);
select tests.throws('cannot share with someone outside the campaign',
  format($$insert into public.document_grants (document_id, user_id, permission) values (%L, %L, 'view')$$, :'handout', :'outsider'));
select tests.throws('cannot fake the author',
  format($$insert into public.documents (campaign_id, title, author_id) values (%L, 'x', %L)$$, :'cid', :'player'));

-- ---------------------------------------------------------------------------
\warn '== Player 1: sees lore and their handout, not GM notes'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player sees 2 documents', (select count(*) from public.documents), 2::bigint);
select tests.eq('player cannot see gm notes', (select count(*) from public.documents where id = :'notes'), 0::bigint);
select tests.eq('player sees handout', (select title from public.documents where id = :'handout'), 'Handout');
select tests.eq('player sees only own grants', (select count(*) from public.document_grants), 1::bigint);
select tests.eq('view grant cannot edit handout',
  tests.affected(format($$update public.documents set body = 'x' where id = %L$$, :'handout')), 0::bigint);
select tests.eq('player cannot edit lore',
  tests.affected(format($$update public.documents set body = 'x' where id = %L$$, :'lore')), 0::bigint);
select tests.eq('player cannot delete lore',
  tests.affected(format($$delete from public.documents where id = %L$$, :'lore')), 0::bigint);
select tests.eq('player cannot edit gm notes',
  tests.affected(format($$update public.documents set body = 'x' where id = %L$$, :'notes')), 0::bigint);
select tests.throws('player cannot share gm handout onward',
  format($$insert into public.document_grants (document_id, user_id, permission) values (%L, %L, 'view')$$, :'handout', :'player2'));
select tests.eq('player cannot upgrade own grant',
  tests.affected(format($$update public.document_grants set permission = 'edit' where document_id = %L$$, :'handout')), 0::bigint);

-- ---------------------------------------------------------------------------
\warn '== Player 2: sees only lore'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player2', false);
select tests.eq('player2 sees 1 document', (select count(*) from public.documents), 1::bigint);
select tests.eq('player2 sees no grants', (select count(*) from public.document_grants), 0::bigint);

-- ---------------------------------------------------------------------------
\warn '== Edit grants: can change text, not who sees it'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
update public.document_grants set permission = 'edit' where document_id = :'handout' and user_id = :'player';
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('edit grant can edit handout',
  tests.affected(format($$update public.documents set body = 'A letter, annotated' where id = %L$$, :'handout')), 1::bigint);
select tests.eq('save records who edited', (select updated_by from public.documents where id = :'handout'), :'player'::uuid);
select tests.throws('edit grant cannot change visibility',
  format($$update public.documents set visibility = 'campaign' where id = %L$$, :'handout'));
select tests.eq('edit grant cannot delete',
  tests.affected(format($$delete from public.documents where id = %L$$, :'handout')), 0::bigint);
select tests.throws('cannot move a document to another campaign',
  format($$update public.documents set campaign_id = gen_random_uuid() where id = %L$$, :'handout'));

-- ---------------------------------------------------------------------------
\warn '== Player journals: private to the author and the GMs'
-- ---------------------------------------------------------------------------
insert into public.documents (campaign_id, title, body) values (:'cid', 'My journal', 'Dear diary') returning id as journal \gset
select set_config('request.jwt.claim.sub', :'player2', false);
select tests.eq('other player cannot see journal', (select count(*) from public.documents where id = :'journal'), 0::bigint);
select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('gm can see player journal', (select count(*) from public.documents where id = :'journal'), 1::bigint);
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('author shares journal with player2',
  tests.affected(format($$insert into public.document_grants (document_id, user_id, permission) values (%L, %L, 'view')$$, :'journal', :'player2')), 1::bigint);
select tests.eq('author can make journal public',
  tests.affected(format($$update public.documents set visibility = 'campaign' where id = %L$$, :'journal')), 1::bigint);
select set_config('request.jwt.claim.sub', :'player2', false);
select tests.eq('player2 now sees journal', (select count(*) from public.documents where id = :'journal'), 1::bigint);

-- ---------------------------------------------------------------------------
\warn '== Outsiders see and create nothing'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('outsider sees no documents', (select count(*) from public.documents), 0::bigint);
select tests.eq('outsider sees no grants', (select count(*) from public.document_grants), 0::bigint);
select tests.throws('outsider cannot add documents',
  format($$insert into public.documents (campaign_id, title) values (%L, 'x')$$, :'cid'));

-- ---------------------------------------------------------------------------
\warn '== Document images follow the document'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('gm uploads image to handout',
  tests.affected(format($$insert into storage.objects (bucket_id, name) values ('document-images', %L)$$, :'cid' || '/' || :'handout' || '/map.png')), 1::bigint);
select tests.eq('gm uploads image to gm notes',
  tests.affected(format($$insert into storage.objects (bucket_id, name) values ('document-images', %L)$$, :'cid' || '/' || :'notes' || '/secret.png')), 1::bigint);
select tests.throws('path must match the document campaign',
  format($$insert into storage.objects (bucket_id, name) values ('document-images', %L)$$, gen_random_uuid() || '/' || :'handout' || '/x.png'));
select tests.throws('malformed path rejected',
  $$insert into storage.objects (bucket_id, name) values ('document-images', 'not/a-valid/path/x.png')$$);

select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player sees handout image only', (select count(*) from storage.objects), 1::bigint);
select tests.eq('player with edit grant uploads to handout',
  tests.affected(format($$insert into storage.objects (bucket_id, name) values ('document-images', %L)$$, :'cid' || '/' || :'handout' || '/p.png')), 1::bigint);
select tests.throws('player cannot upload to lore (view only)',
  format($$insert into storage.objects (bucket_id, name) values ('document-images', %L)$$, :'cid' || '/' || :'lore' || '/p.png'));

select set_config('request.jwt.claim.sub', :'player2', false);
select tests.eq('player2 sees no handout images', (select count(*) from storage.objects), 0::bigint);
select tests.eq('player2 cannot delete images',
  tests.affected($$delete from storage.objects$$), 0::bigint);

-- ---------------------------------------------------------------------------
\warn '== Leaving the campaign removes access; deleting it removes everything'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
delete from public.memberships where user_id = :'player' and campaign_id = :'cid';
select tests.eq('ex-member sees no documents, even own', (select count(*) from public.documents), 0::bigint);
select tests.eq('ex-member sees no images', (select count(*) from storage.objects), 0::bigint);
select tests.eq('ex-member cannot edit own journal',
  tests.affected(format($$update public.documents set body = 'x' where id = %L$$, :'journal')), 0::bigint);

select set_config('request.jwt.claim.sub', :'gm', false);
delete from public.campaigns where id = :'cid';
reset role;
select tests.eq('documents removed with campaign', (select count(*) from public.documents), 0::bigint);
select tests.eq('grants removed with campaign', (select count(*) from public.document_grants), 0::bigint);
