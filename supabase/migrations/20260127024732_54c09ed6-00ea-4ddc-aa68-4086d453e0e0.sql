begin;

drop policy if exists matters_insert_owner_only on public.matters;
drop policy if exists matters_insert_admin_only on public.matters;

-- Recreate as PUBLIC-targeted policies (no TO clause)
create policy matters_insert_owner_only
on public.matters
for insert
with check (owner_id = auth.uid());

create policy matters_insert_admin_only
on public.matters
for insert
with check (public.is_admin());

commit;