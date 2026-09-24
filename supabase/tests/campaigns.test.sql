-- Access rule tests: campaigns, memberships, invites and profiles.
-- Run with `npm run test:db`. Each check prints "ok  <label>" or stops with FAIL.

\set gm       '00000000-0000-0000-0000-000000000001'
\set player   '00000000-0000-0000-0000-000000000002'
\set outsider '00000000-0000-0000-0000-000000000003'
\set late     '00000000-0000-0000-0000-000000000004'

-- Users who sign in after the migrations
insert into auth.users (id, email, raw_user_meta_data) values
  (:'player',   'player@example.com',   '{"full_name": "Pat Player"}'),
  (:'outsider', 'outsider@example.com', '{"name": "Olly Outsider"}'),
  (:'late',     'late@example.com',     '{}');

-- ---------------------------------------------------------------------------
\warn '== Profiles are created on sign-in'
-- ---------------------------------------------------------------------------
select tests.eq('existing user backfilled', (select display_name from public.profiles where id = :'gm'), 'Gina GM');
select tests.eq('new user gets profile from full_name', (select display_name from public.profiles where id = :'player'), 'Pat Player');
select tests.eq('falls back to name', (select display_name from public.profiles where id = :'outsider'), 'Olly Outsider');
select tests.eq('falls back to email prefix', (select display_name from public.profiles where id = :'late'), 'late');

-- ---------------------------------------------------------------------------
\warn '== Signed-out visitors get nothing'
-- ---------------------------------------------------------------------------
set role anon;
select tests.throws('anon cannot read campaigns', 'select * from public.campaigns');
select tests.throws('anon cannot read profiles', 'select * from public.profiles');
select tests.throws('anon cannot create campaigns', $$select public.create_campaign('x')$$);
select tests.throws('anon cannot redeem invites', $$select public.redeem_invite('x')$$);
select tests.eq('anon can ping', public.ping(), 1);
reset role;

-- ---------------------------------------------------------------------------
\warn '== GM creates a campaign and an invite'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);

select public.create_campaign('Shanghai by Night', 'Test chronicle') as cid \gset
select tests.eq('gm sees campaign', (select count(*) from public.campaigns), 1::bigint);
select tests.eq('gm is gm', (select role from public.memberships where user_id = :'gm'), 'gm');
select tests.eq('owner recorded', (select owner_id from public.campaigns where id = :'cid'), :'gm'::uuid);
select tests.eq('gm can rename campaign',
  tests.affected(format($$update public.campaigns set name = 'Shanghai 1932' where id = %L$$, :'cid')), 1::bigint);
select tests.throws('gm cannot change owner',
  format($$update public.campaigns set owner_id = %L where id = %L$$, :'player', :'cid'));
select tests.throws('nobody inserts campaigns directly',
  $$insert into public.campaigns (name, owner_id) values ('x', auth.uid())$$);

insert into public.invites (campaign_id) values (:'cid') returning code \gset
select tests.eq('invite has 16-char code', length(:'code'), 16);
select tests.eq('invite created_by defaults to gm', (select created_by from public.invites where code = :'code'), :'gm'::uuid);
select tests.throws('gm cannot preset invite uses',
  format($$insert into public.invites (campaign_id, uses) values (%L, -100)$$, :'cid'));

-- ---------------------------------------------------------------------------
\warn '== An outsider sees nothing of the campaign'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('outsider sees no campaigns', (select count(*) from public.campaigns), 0::bigint);
select tests.eq('outsider sees no memberships', (select count(*) from public.memberships), 0::bigint);
select tests.eq('outsider sees no invites', (select count(*) from public.invites), 0::bigint);
select tests.eq('outsider sees only own profile', (select count(*) from public.profiles), 1::bigint);
select tests.throws('outsider cannot add self as member',
  format($$insert into public.memberships (campaign_id, user_id, role) values (%L, %L, 'gm')$$, :'cid', :'outsider'));
select tests.throws('outsider cannot create invites',
  format($$insert into public.invites (campaign_id) values (%L)$$, :'cid'));
select tests.eq('outsider cannot edit campaign',
  tests.affected(format($$update public.campaigns set name = 'pwned' where id = %L$$, :'cid')), 0::bigint);
select tests.eq('outsider cannot delete campaign',
  tests.affected(format($$delete from public.campaigns where id = %L$$, :'cid')), 0::bigint);
select tests.eq('invite link preview shows campaign name', (select campaign_name from public.invite_preview(:'code')), 'Shanghai 1932');
select tests.eq('unknown code previews nothing', (select count(*) from public.invite_preview('nope')), 0::bigint);
select tests.throws('unknown code cannot be redeemed', $$select public.redeem_invite('nope')$$);

-- ---------------------------------------------------------------------------
\warn '== A player joins with the invite'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('redeem returns campaign id', public.redeem_invite(:'code'), :'cid'::uuid);
select tests.eq('player sees campaign', (select count(*) from public.campaigns), 1::bigint);
select tests.eq('player joined as player', (select role from public.memberships where user_id = :'player'), 'player');
select tests.eq('player sees both members', (select count(*) from public.memberships), 2::bigint);
select tests.eq('player sees gm profile', (select display_name from public.profiles where id = :'gm'), 'Gina GM');
select tests.eq('player cannot see invites', (select count(*) from public.invites), 0::bigint);
select tests.throws('player cannot create invites',
  format($$insert into public.invites (campaign_id) values (%L)$$, :'cid'));
select tests.eq('player cannot promote self',
  tests.affected(format($$update public.memberships set role = 'gm' where user_id = %L$$, :'player')), 0::bigint);
select tests.eq('player cannot edit campaign',
  tests.affected(format($$update public.campaigns set name = 'x' where id = %L$$, :'cid')), 0::bigint);
select tests.eq('player cannot remove gm',
  tests.affected(format($$delete from public.memberships where user_id = %L$$, :'gm')), 0::bigint);
select tests.eq('player cannot delete campaign',
  tests.affected(format($$delete from public.campaigns where id = %L$$, :'cid')), 0::bigint);
select tests.eq('player cannot edit gm profile',
  tests.affected(format($$update public.profiles set display_name = 'x' where id = %L$$, :'gm')), 0::bigint);
select tests.eq('player can edit own profile',
  tests.affected(format($$update public.profiles set display_name = 'Pat' where id = %L$$, :'player')), 1::bigint);
select public.redeem_invite(:'code');
select tests.eq('redeeming again keeps role', (select role from public.memberships where user_id = :'player'), 'player');
reset role;
select tests.eq('redeeming again does not use up invite', (select uses from public.invites where code = :'code'), 1);

-- ---------------------------------------------------------------------------
\warn '== GM manages members; the owner is protected'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('gm can promote player',
  tests.affected(format($$update public.memberships set role = 'gm' where user_id = %L$$, :'player')), 1::bigint);
select tests.eq('gm can demote player',
  tests.affected(format($$update public.memberships set role = 'player' where user_id = %L$$, :'player')), 1::bigint);
select tests.throws('gm cannot move a membership to another user',
  format($$update public.memberships set user_id = %L where user_id = %L$$, :'outsider', :'player'));

select set_config('request.jwt.claim.sub', :'player', false);
reset role;
update public.memberships set role = 'gm' where user_id = :'player';   -- make player a co-GM
set role authenticated;
select tests.eq('co-gm cannot demote owner',
  tests.affected(format($$update public.memberships set role = 'player' where user_id = %L$$, :'gm')), 0::bigint);
select tests.eq('co-gm cannot remove owner',
  tests.affected(format($$delete from public.memberships where user_id = %L$$, :'gm')), 0::bigint);
select tests.eq('co-gm sees invites', (select count(*) from public.invites), 1::bigint);
reset role;
update public.memberships set role = 'player' where user_id = :'player';

-- ---------------------------------------------------------------------------
\warn '== Expired and used-up invites stop working'
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'gm', false);
insert into public.invites (campaign_id, expires_at) values (:'cid', now() - interval '1 minute') returning code as expired_code \gset
insert into public.invites (campaign_id, max_uses) values (:'cid', 1) returning code as single_code \gset
insert into public.invites (campaign_id, role, expires_at) values (:'cid', 'gm', null) returning code as gm_code \gset

select set_config('request.jwt.claim.sub', :'outsider', false);
select tests.eq('expired invite previews nothing', (select count(*) from public.invite_preview(:'expired_code')), 0::bigint);
select tests.throws('expired invite cannot be redeemed', format($$select public.redeem_invite(%L)$$, :'expired_code'));
select tests.eq('single-use invite works once', public.redeem_invite(:'single_code'), :'cid'::uuid);

select set_config('request.jwt.claim.sub', :'late', false);
select tests.throws('single-use invite is then used up', format($$select public.redeem_invite(%L)$$, :'single_code'));
select tests.eq('gm invite makes a gm', public.redeem_invite(:'gm_code'), :'cid'::uuid);
select tests.eq('late joined as gm', (select role from public.memberships where user_id = :'late'), 'gm');

-- ---------------------------------------------------------------------------
\warn '== Leaving and deleting'
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'player', false);
select tests.eq('player can leave',
  tests.affected(format($$delete from public.memberships where user_id = %L$$, :'player')), 1::bigint);
select tests.eq('after leaving, campaign is hidden', (select count(*) from public.campaigns), 0::bigint);

select set_config('request.jwt.claim.sub', :'late', false);
select tests.eq('co-gm cannot delete campaign (owner only)',
  tests.affected(format($$delete from public.campaigns where id = %L$$, :'cid')), 0::bigint);
select tests.eq('gm can revoke invite',
  tests.affected(format($$delete from public.invites where code = %L$$, :'gm_code')), 1::bigint);

select set_config('request.jwt.claim.sub', :'gm', false);
select tests.eq('owner can delete campaign',
  tests.affected(format($$delete from public.campaigns where id = %L$$, :'cid')), 1::bigint);
reset role;
select tests.eq('memberships removed with campaign', (select count(*) from public.memberships), 0::bigint);
select tests.eq('invites removed with campaign', (select count(*) from public.invites), 0::bigint);
