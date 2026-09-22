-- CHI-NITO · Supabase setup
-- Ejecuta este archivo completo en Supabase > SQL Editor.

create extension if not exists pgcrypto;
create sequence if not exists public.order_number_seq start with 1001;

create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','kitchen')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('#CN-' || nextval('public.order_number_seq')::text),
  customer_name text not null,
  customer_phone text not null,
  pickup_label text not null default 'Lo antes posible · 20–30 min',
  payment_method text not null default 'pickup' check (payment_method in ('online','pickup')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  status text not null default 'Nuevo' check (status in ('Nuevo','Preparando','Listo','Entregado','Cancelado')),
  total numeric(10,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null,
  catalog_slug text,
  name text not null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 50),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  base_name text,
  guisados jsonb not null default '[]'::jsonb,
  extras jsonb not null default '[]'::jsonb,
  variant text,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  image text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Chi-nito Centro',
  store_open boolean not null default true,
  pickup_enabled boolean not null default true,
  opening_time text not null default '11:00 a.m.',
  closing_time text not null default '9:00 p.m.',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at before update on public.menu_items
for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

create or replace function public.is_staff(required_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_users s
    where s.user_id = auth.uid()
      and s.active = true
      and (
        required_role is null
        or s.role = required_role
        or s.role = 'admin'
      )
  );
$$;

-- Catálogo inicial. Los slugs coinciden con los usados por la app cliente.
insert into public.menu_items (slug,name,category,price,image,description,active,sort_order,metadata) values
('chi-nito-1','Chi-nito 1','Chi-nito',95,'/img/product/chi-nito-1.jpg','1 base + 1 guisado',true,10,'{}'),
('chi-nito-2','Chi-nito 2','Chi-nito',115,'/img/product/chi-nito-2.jpg','1 base + hasta 2 guisados',true,20,'{}'),
('chi-nito-3','Chi-nito 3','Chi-nito',135,'/img/product/chi-nito-3.jpg','1 base + hasta 3 guisados',true,30,'{}'),
('base-arroz-frito','Arroz frito','Base',0,'/img/product/arroz-frito.jpg',null,true,40,'{}'),
('base-chow-mein','Chow mein','Base',0,'/img/product/chow-mein.jpg',null,true,50,'{}'),
('orange-chicken','ORANGE CHICKEN','Guisado',0,'/img/product/orange-chicken.jpg','Pollo crujiente en salsa de naranja, ajo, jengibre, ajonjolí y cebollín.',true,100,'{"half_price":95,"liter_price":175}'),
('bbq-pork','BBQ PORK','Guisado',0,'/img/product/bbq-pork.jpg','Cerdo estilo chino-americano, glaseado con nuestra salsa BBQ y ligeramente caramelizado.',true,110,'{"half_price":110,"liter_price":205}'),
('res-cantonesa','RES CANTONESA','Guisado',0,'/img/product/res-cantonesa.jpg','Res ligeramente crujiente con cebolla, pimientos, zanahoria y cebollín en salsa cantonesa oscura, brillante y dulce-salada.',true,120,'{"half_price":115,"liter_price":215}'),
('sweet-sour-chicken','SWEET & SOUR CHICKEN','Guisado',0,'/img/product/sweet-sour-chicken.jpg','Pollo crujiente con pimientos, cebolla y piña en salsa agridulce.',true,130,'{"half_price":100,"liter_price":185}'),
('sweet-sour-pork','SWEET & SOUR PORK','Guisado',0,'/img/product/sweet-sour-pork.jpg','Cerdo crujiente con pimientos, cebolla y piña en salsa agridulce.',true,140,'{"half_price":110,"liter_price":205}'),
('camaron-agridulce','CAMARÓN AGRIDULCE','Guisado',0,'/img/product/camaron-agridulce.jpg','Camarones crujientes estilo bombochito, pimientos, cebolla y piña en salsa agridulce.',true,150,'{"half_price":145,"liter_price":275}'),
('kung-pao-chicken','KUNG PAO CHICKEN','Guisado',0,'/img/product/kung-pao-chicken.jpg','Pollo, vegetales, cacahuate, chile seco y salsa Kung Pao.',true,160,'{"half_price":100,"liter_price":185}'),
('beef-broccoli','BEEF & BROCCOLI','Guisado',0,'/img/product/beef-broccoli.jpg','Res salteada con brócoli, zanahoria y cebolla en salsa de soya y ostión.',true,170,'{"half_price":115,"liter_price":215}'),
('veggie-wok','VEGGIE WOK','Guisado',0,'/img/product/veggie-wok.jpg','Brócoli, col, zanahoria, pimientos, cebolla, calabaza y ejotes salteados al wok.',true,180,'{"half_price":85,"liter_price":155}'),
('chinito-bites','CHI•NITO BITES','Complemento',59,'/img/product/chinito-bites.jpg','140 g · Bocados de pollo crujiente con salsa Sweet Chili, ajonjolí y cebollín.',true,200,'{}'),
('edamames-al-wok','EDAMAMES AL WOK','Complemento',59,'/img/product/edamames-al-wok.jpg','120 g · Edamames salteados con soya, chile, ajonjolí y cebollín.',true,210,'{}'),
('dumplings','DUMPLINGS','Complemento',59,'/img/product/dumplings.jpg','4 piezas · 120 g · Dumplings de cerdo y vegetales, dorados al wok.',true,220,'{}'),
('wok-fries','WOK FRIES','Complemento',59,'/img/product/wok-fries.jpg','140 g · Papas crujientes terminadas al wok con salsa dulce-picante, ajo, ajonjolí y cebollín.',true,230,'{}'),
('spring-rolls','SPRING ROLLS','Complemento',59,'/img/product/spring-rolls.jpg','3 piezas · 120 g',true,240,'{}'),
('te-casa','Té de la casa','Bebida',35,'/img/product/te-casa.jpg',null,true,300,'{}'),
('te-helado','Té helado','Bebida',35,'/img/product/te-helado.jpg',null,true,305,'{}'),
('coca-cola','Coca-Cola','Bebida',30,'/img/product/coca-cola.jpg',null,true,310,'{}'),
('coca-cola-zero','Coca-Cola Zero','Bebida',30,'/img/product/coca-cola-zero.jpg',null,true,320,'{}'),
('sprite','Sprite','Bebida',30,'/img/product/sprite.jpg',null,true,330,'{}'),
('fanta','Fanta','Bebida',30,'/img/product/fanta.jpg',null,true,340,'{}'),
('manzanita','Manzanita','Bebida',30,'/img/product/manzanita.jpg',null,true,350,'{}'),
('agua','Agua','Bebida',25,'/img/product/agua.jpg',null,true,360,'{}'),
('extra-arroz','Extra arroz','Extra',25,'/img/product/arroz-frito.jpg','125 g',true,400,'{}'),
('extra-chow-mein','Extra chow mein','Extra',25,'/img/product/chow-mein.jpg','125 g',true,410,'{}'),
('extra-orange-chicken','Extra ORANGE CHICKEN','Extra',39,'/img/product/orange-chicken.jpg','125 g',true,420,'{}'),
('extra-bbq-pork','Extra BBQ PORK','Extra',39,'/img/product/bbq-pork.jpg','125 g',true,430,'{}'),
('extra-res-cantonesa','Extra RES CANTONESA','Extra',39,'/img/product/res-cantonesa.jpg','125 g',true,440,'{}'),
('extra-sweet-sour-chicken','Extra SWEET & SOUR CHICKEN','Extra',39,'/img/product/sweet-sour-chicken.jpg','125 g',true,450,'{}'),
('extra-sweet-sour-pork','Extra SWEET & SOUR PORK','Extra',39,'/img/product/sweet-sour-pork.jpg','125 g',true,460,'{}'),
('extra-camaron-agridulce','Extra CAMARÓN AGRIDULCE','Extra',39,'/img/product/camaron-agridulce.jpg','125 g',true,470,'{}'),
('extra-kung-pao-chicken','Extra KUNG PAO CHICKEN','Extra',39,'/img/product/kung-pao-chicken.jpg','125 g',true,480,'{}'),
('extra-beef-broccoli','Extra BEEF & BROCCOLI','Extra',39,'/img/product/beef-broccoli.jpg','125 g',true,490,'{}'),
('extra-veggie-wok','Extra VEGGIE WOK','Extra',39,'/img/product/veggie-wok.jpg','125 g',true,500,'{}')
on conflict (slug) do update set
  name=excluded.name,
  category=excluded.category,
  price=excluded.price,
  image=excluded.image,
  description=excluded.description,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata;

-- RPC pública: crea el pedido y calcula el total usando precios del catálogo.
create or replace function public.create_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_payment_method text,
  p_items jsonb
)
returns table(order_id uuid, order_number text, total numeric, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_extra jsonb;
  v_slug text;
  v_name text;
  v_kind text;
  v_qty integer;
  v_unit numeric(10,2);
  v_base_name text;
  v_guisados jsonb;
  v_extras jsonb;
  v_variant text;
  v_menu public.menu_items%rowtype;
  v_extra_menu public.menu_items%rowtype;
  v_guisado_menu public.menu_items%rowtype;
  v_max_guisados integer;
begin
  if coalesce(trim(p_customer_name),'') = '' then raise exception 'Nombre requerido'; end if;
  if coalesce(trim(p_customer_phone),'') = '' then raise exception 'Teléfono requerido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'El carrito está vacío'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Demasiados productos'; end if;
  if p_payment_method not in ('online','pickup') then raise exception 'Método de pago inválido'; end if;

  insert into public.orders(customer_name,customer_phone,pickup_label,payment_method,total)
  values (trim(p_customer_name),trim(p_customer_phone),coalesce(nullif(trim(p_pickup_label),''),'Lo antes posible · 20–30 min'),p_payment_method,0)
  returning id, orders.order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_kind := coalesce(v_item->>'kind','simple');
    v_slug := v_item->>'catalog_slug';
    v_qty := greatest(1, least(50, coalesce((v_item->>'quantity')::integer,1)));
    v_variant := nullif(v_item->>'variant','');
    v_base_name := null;
    v_guisados := '[]'::jsonb;
    v_extras := '[]'::jsonb;

    select * into v_menu from public.menu_items where slug=v_slug and active=true;
    if not found then raise exception 'Producto no disponible: %', coalesce(v_slug,'sin slug'); end if;

    if v_kind = 'configured' then
      if v_menu.category <> 'Chi-nito' then raise exception 'Producto configurable inválido'; end if;
      v_max_guisados := case v_menu.slug when 'chi-nito-1' then 1 when 'chi-nito-2' then 2 when 'chi-nito-3' then 3 else 0 end;
      if v_max_guisados = 0 then raise exception 'Chi-nito inválido'; end if;
      if jsonb_array_length(coalesce(v_item->'guisado_slugs','[]'::jsonb)) > v_max_guisados then raise exception 'Demasiados guisados para %', v_menu.name; end if;
      v_unit := v_menu.price;

      select name into v_base_name
      from public.menu_items
      where slug=(v_item->>'base_slug') and category='Base' and active=true;
      if v_base_name is null then raise exception 'Base no disponible'; end if;

      v_guisados := '[]'::jsonb;
      for v_slug in select jsonb_array_elements_text(coalesce(v_item->'guisado_slugs','[]'::jsonb))
      loop
        select * into v_guisado_menu from public.menu_items where slug=v_slug and category='Guisado' and active=true;
        if not found then raise exception 'Guisado no disponible: %', v_slug; end if;
        v_guisados := v_guisados || jsonb_build_array(v_guisado_menu.name);
      end loop;
      if jsonb_array_length(v_guisados) = 0 then raise exception 'Selecciona al menos un guisado'; end if;

      for v_extra in select value from jsonb_array_elements(coalesce(v_item->'extras','[]'::jsonb))
      loop
        select * into v_extra_menu from public.menu_items where slug=(v_extra->>'catalog_slug') and active=true;
        if not found then raise exception 'Extra no disponible'; end if;
        v_unit := v_unit + (v_extra_menu.price * greatest(1, least(50, coalesce((v_extra->>'quantity')::integer,1))));
        v_extras := v_extras || jsonb_build_array(jsonb_build_object(
          'name',v_extra_menu.name,
          'quantity',greatest(1, least(50, coalesce((v_extra->>'quantity')::integer,1))),
          'price',v_extra_menu.price
        ));
      end loop;
    elsif v_kind = 'takeaway' then
      if v_menu.category <> 'Guisado' then raise exception 'Guisado para llevar inválido'; end if;
      if v_variant = '1 litro' then
        v_unit := coalesce((v_menu.metadata->>'liter_price')::numeric,0);
      else
        v_unit := coalesce((v_menu.metadata->>'half_price')::numeric,0);
      end if;
      if v_unit <= 0 then raise exception 'Precio de guisado para llevar no configurado'; end if;
    elsif v_kind = 'addon' then
      if v_menu.category <> 'Complemento' then raise exception 'Complemento inválido'; end if;
      v_unit := v_menu.price;
    elsif v_kind = 'drink' then
      if v_menu.category <> 'Bebida' then raise exception 'Bebida inválida'; end if;
      v_unit := v_menu.price;
    else
      raise exception 'Tipo de producto inválido: %', v_kind;
    end if;

    v_name := v_menu.name;
    insert into public.order_items(order_id,item_type,catalog_slug,name,quantity,unit_price,base_name,guisados,extras,variant)
    values (v_order_id,v_kind,v_menu.slug,v_name,v_qty,v_unit,v_base_name,v_guisados,v_extras,v_variant);

    v_total := v_total + (v_unit * v_qty);
  end loop;

  update public.orders set total=v_total where id=v_order_id;
  return query select v_order_id,v_order_number,v_total,'Nuevo'::text;
end;
$$;

-- RLS
alter table public.staff_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.menu_items enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists staff_read_self on public.staff_users;
create policy staff_read_self on public.staff_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists staff_orders_select on public.orders;
create policy staff_orders_select on public.orders for select to authenticated using (public.is_staff());
drop policy if exists staff_orders_update on public.orders;
create policy staff_orders_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_order_items_select on public.order_items;
create policy staff_order_items_select on public.order_items for select to authenticated using (public.is_staff());

drop policy if exists menu_public_read on public.menu_items;
create policy menu_public_read on public.menu_items for select to anon, authenticated using (true);
drop policy if exists menu_admin_update on public.menu_items;
create policy menu_admin_update on public.menu_items for update to authenticated using (public.is_staff('admin')) with check (public.is_staff('admin'));
drop policy if exists menu_admin_insert on public.menu_items;
create policy menu_admin_insert on public.menu_items for insert to authenticated with check (public.is_staff('admin'));

drop policy if exists settings_public_read on public.store_settings;
create policy settings_public_read on public.store_settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_update on public.store_settings;
create policy settings_admin_update on public.store_settings for update to authenticated using (public.is_staff('admin')) with check (public.is_staff('admin'));


-- Privilegios de API (RLS sigue siendo quien decide qué filas puede usar cada rol).
grant select on public.menu_items, public.store_settings to anon, authenticated;
grant select on public.staff_users, public.orders, public.order_items to authenticated;
grant update on public.orders, public.menu_items, public.store_settings to authenticated;
grant insert on public.menu_items to authenticated;

revoke all on function public.create_customer_order(text,text,text,text,jsonb) from public;
grant execute on function public.create_customer_order(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.is_staff(text) to authenticated;

-- Realtime (idempotente)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_items') then
    alter publication supabase_realtime add table public.order_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='menu_items') then
    alter publication supabase_realtime add table public.menu_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='store_settings') then
    alter publication supabase_realtime add table public.store_settings;
  end if;
end $$;
