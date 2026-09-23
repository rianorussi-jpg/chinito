-- Chi-nito: registro y sesión de clientes.
-- EJECUTAR después de schema.sql y menu_editor_migration.sql.
-- Incremental: no borra usuarios, pedidos ni productos existentes.

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists customer_profiles_select_own on public.customer_profiles;
create policy customer_profiles_select_own on public.customer_profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists customer_profiles_insert_own on public.customer_profiles;
create policy customer_profiles_insert_own on public.customer_profiles
for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists customer_profiles_update_own on public.customer_profiles;
create policy customer_profiles_update_own on public.customer_profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select,insert,update on public.customer_profiles to authenticated;

-- Vincula los NUEVOS pedidos al cliente real que los creó.
-- No se borran ni reasignan los pedidos históricos.
alter table public.orders
add column if not exists customer_id uuid references auth.users(id) on delete set null;
create index if not exists idx_chinito_orders_customer_id
  on public.orders(customer_id,created_at desc);

drop policy if exists customer_orders_select_own on public.orders;
create policy customer_orders_select_own on public.orders
for select to authenticated using (customer_id = (select auth.uid()));

drop policy if exists customer_order_items_select_own on public.order_items;
create policy customer_order_items_select_own on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())
  )
);

-- La función existente valida el catálogo, extras, inventario y totales.
-- La conservamos SIN alterar sus reglas y la envolvemos para exigir sesión
-- y vincular el pedido al cliente. Se ejecuta en una sola transacción.
do $$
begin
  if to_regprocedure('public.create_customer_order_impl(text,text,text,text,jsonb)') is null then
    alter function public.create_customer_order(text,text,text,text,jsonb)
      rename to create_customer_order_impl;
  end if;
end $$;

revoke all on function public.create_customer_order_impl(text,text,text,text,jsonb)
  from public, anon, authenticated;

create or replace function public.create_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_payment_method text,
  p_items jsonb
)
returns table(order_id uuid,order_number text,total numeric,status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total numeric;
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para confirmar tu pedido.' using errcode = '28000';
  end if;

  select r.order_id,r.order_number,r.total,r.status
  into strict v_order_id,v_order_number,v_total,v_status
  from public.create_customer_order_impl(
    p_customer_name,p_customer_phone,p_pickup_label,p_payment_method,p_items
  ) r;

  update public.orders
  set customer_id = (select auth.uid())
  where id = v_order_id;

  return query select v_order_id,v_order_number,v_total,v_status;
end;
$$;

revoke all on function public.create_customer_order(text,text,text,text,jsonb)
  from public, anon;
grant execute on function public.create_customer_order(text,text,text,text,jsonb)
  to authenticated;
