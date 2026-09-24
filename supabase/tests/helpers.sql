-- Assertion helpers shared by the *.test.sql files (loaded by scripts/test-db.sh).

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.eq(label text, got anyelement, expected anyelement) returns void
language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL %: got %, expected %', label, got, expected;
  end if;
  raise notice 'ok  %', label;
end $$;

-- Passes if the statement raises an error
create function tests.throws(label text, stmt text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok  % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL %: statement succeeded: %', label, stmt;
end $$;

-- Number of rows an insert/update/delete touched
create function tests.affected(stmt text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
