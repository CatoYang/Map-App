-- Minimal stand-in for the parts of Supabase the migrations rely on, so they
-- can be tested against plain Postgres (see scripts/test-db.sh).

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb not null default '{}'
);

-- Supabase reads the signed-in user's id from the request's JWT. Tests set it
-- with: select set_config('request.jwt.claim.sub', '<uuid>', false);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase grants API roles everything in public by default; RLS and the
-- migrations' own revokes narrow it down. Mirror that here.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- A user who signed in before the migrations ran (tests the profile backfill)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'gm@example.com', '{"full_name": "Gina GM", "avatar_url": "https://example.com/g.png"}');
