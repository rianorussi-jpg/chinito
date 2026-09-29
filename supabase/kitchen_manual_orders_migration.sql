-- CHI-NITO · Pedidos manuales desde Kitchen Mode.
-- Ejecutar UNA VEZ después de las migraciones existentes.
-- No modifica pedidos anteriores ni el menú.

create or replace function public.create_staff_order(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_items jsonb
)
returns table(order_id uuid,order_number text,total numeric,status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_number text;
  v_total numeric;
  v_name text := coalesce(nullif(trim(p_customer_name),''),'Mostrador');
  v_phone text := coalesce(nullif(trim(p_customer_phone),''),'Sin teléfono');
begin
  if not public.is_staff() then
    raise exception 'No tienes permisos para crear pedidos desde Cocina.' using errcode='42501';
  end if;

  if to_regprocedure('public.create_customer_order_impl(text,text,text,text,jsonb)') is null then
    raise exception 'Falta la función base de pedidos. Ejecuta primero las migraciones de cliente.';
  end if;

  select r.order_id,r.order_number,r.total
    into strict v_order_id,v_number,v_total
  from public.create_customer_order_impl(
    v_name,
    v_phone,
    coalesce(nullif(trim(p_pickup_label),''),'Lo antes posible · 20–30 min'),
    'pickup',
    p_items
  ) r;

  -- Un pedido capturado directamente por cocina entra de inmediato a preparación.
  update public.orders
    set status='Preparando'
    where id=v_order_id;

  return query select v_order_id,v_number,v_total,'Preparando'::text;
end;
$$;

revoke all on function public.create_staff_order(text,text,text,jsonb) from public,anon;
grant execute on function public.create_staff_order(text,text,text,jsonb) to authenticated;
