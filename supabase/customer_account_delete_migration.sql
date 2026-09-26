-- Chi-nito: permite que cada cliente elimine su propia cuenta desde la app.
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Esta función elimina el usuario autenticado de auth.users.
-- customer_profiles y cashback usan ON DELETE CASCADE; orders.customer_id usa ON DELETE SET NULL.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para eliminar tu cuenta.' using errcode = '28000';
  end if;

  delete from auth.users
  where id = v_user;

  if not found then
    raise exception 'La cuenta ya no existe.';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
