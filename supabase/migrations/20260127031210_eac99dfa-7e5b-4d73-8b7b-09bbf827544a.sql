begin;

-- 1) REMOVE the temporary debug panic trigger
drop trigger if exists __dbg_matters_before_insert on public.matters;
drop function if exists public.__dbg_matters_before_insert();

-- 2) HARD RESET: drop *all* INSERT policies on public.matters (fixed column name)
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public'
      and tablename='matters'
      and cmd='INSERT'
  loop
    execute format('drop policy if exists %I on public.matters;', p.policyname);
  end loop;
end $$;

-- 3) CREATE exactly ONE INSERT policy: owner-only, authenticated only
create policy matters_insert_owner_only
on public.matters
for insert
to authenticated
with check (owner_id = auth.uid());

commit;