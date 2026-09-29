-- CHI-NITO · Flujo Preparando -> Listo -> Entregado + historial.
-- Ejecutar UNA VEZ después de las migraciones existentes.
-- Hace que TODO pedido nuevo entre directamente a Preparando.

begin;

-- Los pedidos creados sin status explícito nacen en Preparando.
alter table public.orders alter column status set default 'Preparando';

-- Convierte pedidos activos antiguos que aún estuvieran en Nuevo.
update public.orders
set status='Preparando'
where status='Nuevo';

-- Protección adicional: incluso si alguna función antigua intenta insertar "Nuevo",
-- el pedido entra a cocina como Preparando.
create or replace function public.chinito_force_preparing_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is null or new.status = 'Nuevo' then
    new.status := 'Preparando';
  end if;
  return new;
end;
$$;

drop trigger if exists chinito_orders_force_preparing on public.orders;
create trigger chinito_orders_force_preparing
before insert on public.orders
for each row execute function public.chinito_force_preparing_on_insert();

commit;
