begin;

-- 0) Hard sanity: ensure matters.owner_id is enforced
alter table public.matters
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null;

-- 1) Drop *any* existing INSERT policies on public.matters
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'matters'
      and cmd        = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.matters;', p.policyname);
  end loop;
end $$;

-- 2) OWNER-only insert policy (no OR)
create policy matters_insert_owner_only
on public.matters
for insert
to authenticated
with check (owner_id = auth.uid());

-- 3) ADMIN-only insert policy (separate policy, no OR)
create policy matters_insert_admin_only
on public.matters
for insert
to authenticated
with check (public.is_admin());

commit;