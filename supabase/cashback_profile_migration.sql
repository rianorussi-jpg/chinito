-- CHI-NITO · Cashback y checkout con perfil de cliente (migración incremental).
-- Ejecutar DESPUÉS de customer_auth_migration.sql. No reinicia menú ni pedidos.
-- $1 cashback por cada $10 completos pagados, una vez por pedido ENTREGADO.
-- Solo se acredita al entregar (pickup) o si el pago en línea está verificado como 'paid'.

create table if not exists public.customer_cashback_wallets (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_cashback_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('redeem','earn','refund_redeem','reverse_earn')),
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint cashback_one_movement_per_kind unique (order_id,kind),
  constraint cashback_movement_sign check (
    (kind in ('earn','refund_redeem') and amount > 0)
    or (kind in ('redeem','reverse_earn') and amount < 0)
  )
);

create index if not exists cashback_movements_customer_created
on public.customer_cashback_movements(customer_id,created_at desc);

alter table public.orders
  add column if not exists cashback_used numeric(10,2) not null default 0
    check (cashback_used >= 0),
  add column if not exists cashback_earned numeric(10,2) not null default 0
    check (cashback_earned >= 0),
  add column if not exists cashback_earned_at timestamptz,
  add column if not exists cashback_redeemed_refunded_at timestamptz,
  add column if not exists cashback_earned_reversed_at timestamptz;

alter table public.customer_cashback_wallets enable row level security;
alter table public.customer_cashback_movements enable row level security;

drop policy if exists cashback_wallet_select_own on public.customer_cashback_wallets;
create policy cashback_wallet_select_own on public.customer_cashback_wallets
  for select to authenticated using (customer_id = (select auth.uid()));
drop policy if exists cashback_movements_select_own on public.customer_cashback_movements;
create policy cashback_movements_select_own on public.customer_cashback_movements
  for select to authenticated using (customer_id = (select auth.uid()));

-- NINGÚN usuario puede escribir saldo ni movimientos desde el navegador.
revoke all on public.customer_cashback_wallets,public.customer_cashback_movements from public,anon,authenticated;
grant select on public.customer_cashback_wallets,public.customer_cashback_movements to authenticated;

-- El panel y cocina solo pueden cambiar status; nunca el total, dueño, cashback, ni 'paid'.
revoke update on public.orders from authenticated;
grant update(status) on public.orders to authenticated;

-- Los cambios reales de estado disparan la acreditación exactamente una vez.
create or replace function public.chinito_cashback_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_award numeric(10,2);
begin
  if old.status = 'Cancelado' and new.status <> 'Cancelado' then
    raise exception 'Un pedido cancelado no se puede reactivar.';
  end if;

  -- Al cancelar, devolver el cashback utilizado y revertir cualquier cashback otorgado.
  if new.status = 'Cancelado' and old.status is distinct from 'Cancelado' then
    if new.customer_id is not null then
      insert into public.customer_cashback_wallets(customer_id,balance)
      values(new.customer_id,0) on conflict (customer_id) do nothing;
      if old.cashback_used > 0 and old.cashback_redeemed_refunded_at is null then
        update public.customer_cashback_wallets
          set balance=balance+old.cashback_used, updated_at=now()
          where customer_id=new.customer_id;
        insert into public.customer_cashback_movements(customer_id,order_id,kind,amount)
          values(new.customer_id,new.id,'refund_redeem',old.cashback_used)
          on conflict (order_id,kind) do nothing;
        new.cashback_redeemed_refunded_at := now();
      end if;
      if old.cashback_earned > 0 and old.cashback_earned_at is not null
        and old.cashback_earned_reversed_at is null then
        -- Si el cliente gastó el cashback entre la entrega y una devolución posterior,
        -- se conserva la deuda (saldo negativo) hasta sus próximas acreditaciones.
        update public.customer_cashback_wallets
          set balance=balance-old.cashback_earned, updated_at=now()
          where customer_id=new.customer_id;
        insert into public.customer_cashback_movements(customer_id,order_id,kind,amount)
          values(new.customer_id,new.id,'reverse_earn',-old.cashback_earned)
          on conflict (order_id,kind) do nothing;
        new.cashback_earned_reversed_at := now();
      end if;
    end if;
    return new;
  end if;

  -- Recoger en tienda equivale a venta completada; en línea requiere confirmación real.
  if new.customer_id is not null and new.status = 'Entregado'
    and new.cashback_earned_at is null
    and (new.payment_method = 'pickup' or new.payment_status = 'paid') then
    -- El total ya incluye cualquier cashback utilizado: NO genera cashback sobre cashback.
    v_award := floor(new.total / 10);
    if v_award > 0 then
      insert into public.customer_cashback_wallets(customer_id,balance)
        values(new.customer_id,0) on conflict (customer_id) do nothing;
      update public.customer_cashback_wallets
        set balance=balance+v_award,updated_at=now()
        where customer_id=new.customer_id;
      insert into public.customer_cashback_movements(customer_id,order_id,kind,amount)
        values(new.customer_id,new.id,'earn',v_award)
        on conflict (order_id,kind) do nothing;
      new.cashback_earned := v_award;
    end if;
    new.cashback_earned_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.chinito_cashback_on_order_change() from public,anon,authenticated;
drop trigger if exists chinito_cashback_order_state on public.orders;
create trigger chinito_cashback_order_state
before update of status,payment_status on public.orders
for each row execute function public.chinito_cashback_on_order_change();

-- Punto de entrada obligatorio para nuevos pedidos de la app cliente.
-- Calcula TODO con el catálogo existente y verifica el saldo dentro de una transacción;
-- bloquea el monedero para evitar canjes simultáneos duplicados.
create or replace function public.create_customer_order_with_cashback(
  p_pickup_label text,
  p_payment_method text,
  p_items jsonb,
  p_cashback_to_use numeric default 0
)
returns table(order_id uuid,order_number text,total numeric,status text,cashback_used numeric,cashback_balance numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_phone text;
  v_balance numeric(12,2);
  v_subtotal numeric(10,2);
  v_discount numeric(10,2);
  v_order_id uuid;
  v_number text;
  v_status text;
begin
  if v_user is null then
    raise exception 'Inicia sesión para confirmar tu pedido.' using errcode='28000';
  end if;
  select nullif(trim(full_name),''),nullif(trim(phone),'')
    into v_name,v_phone from public.customer_profiles where id=v_user;
  if v_name is null or v_phone is null then
    raise exception 'Completa tus datos desde Tu perfil antes de pedir.';
  end if;
  if p_cashback_to_use is null or p_cashback_to_use < 0
     or p_cashback_to_use <> round(p_cashback_to_use,2) then
    raise exception 'Cantidad de cashback inválida.';
  end if;

  insert into public.customer_cashback_wallets(customer_id,balance)
    values(v_user,0) on conflict(customer_id) do nothing;
  select balance into v_balance from public.customer_cashback_wallets
    where customer_id=v_user for update;
  if p_cashback_to_use > greatest(v_balance,0) then
    raise exception 'No tienes suficiente cashback disponible. Actualiza tu saldo e inténtalo de nuevo.';
  end if;

  select r.order_id,r.order_number,r.total,r.status
    into strict v_order_id,v_number,v_subtotal,v_status
    from public.create_customer_order(v_name,v_phone,p_pickup_label,p_payment_method,p_items) r;

  v_discount := least(p_cashback_to_use,v_subtotal);
  if p_cashback_to_use > v_subtotal then
    raise exception 'El cashback no puede superar el total del pedido.';
  end if;

  if v_discount > 0 then
    update public.customer_cashback_wallets
      set balance=balance-v_discount,updated_at=now() where customer_id=v_user;
    insert into public.customer_cashback_movements(customer_id,order_id,kind,amount)
      values(v_user,v_order_id,'redeem',-v_discount);
    update public.orders
      set cashback_used=v_discount,total=v_subtotal-v_discount
      where id=v_order_id;
  end if;

  return query select v_order_id,v_number,v_subtotal-v_discount,v_status,v_discount,v_balance-v_discount;
end;
$$;

revoke all on function public.create_customer_order_with_cashback(text,text,jsonb,numeric) from public,anon;
grant execute on function public.create_customer_order_with_cashback(text,text,jsonb,numeric) to authenticated;

-- Impide que un navegador evite el checkout protegido y genere pedidos con la RPC anterior.
revoke execute on function public.create_customer_order(text,text,text,text,jsonb)
  from public,anon,authenticated;

-- Actualización de saldo en el cliente sin recargar (si Realtime está habilitado).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='customer_cashback_wallets'
  ) then
    alter publication supabase_realtime add table public.customer_cashback_wallets;
  end if;
end;
$$;
