-- CHI-NITO · Actualización incremental para el editor de menú.
-- Ejecutar UNA VEZ DESPUÉS de schema.sql. No vuelve a insertar ni a reemplazar tu menú actual.
-- Los productos nuevos usan los campos existentes de menu_items (metadata JSONB).

-- Bucket público para imágenes comerciales (no usar para documentos privados).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chinito-menu','chinito-menu',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Fotos de menú: cualquiera puede verlas, solo el admin puede subir o editar.
drop policy if exists chinito_menu_public_images_read on storage.objects;
create policy chinito_menu_public_images_read on storage.objects
for select to anon,authenticated using (bucket_id='chinito-menu');

drop policy if exists chinito_menu_admin_images_insert on storage.objects;
create policy chinito_menu_admin_images_insert on storage.objects
for insert to authenticated
with check (bucket_id='chinito-menu' and public.is_staff('admin'));

drop policy if exists chinito_menu_admin_images_update on storage.objects;
create policy chinito_menu_admin_images_update on storage.objects
for update to authenticated
using (bucket_id='chinito-menu' and public.is_staff('admin'))
with check (bucket_id='chinito-menu' and public.is_staff('admin'));

drop policy if exists chinito_menu_admin_images_delete on storage.objects;
create policy chinito_menu_admin_images_delete on storage.objects
for delete to authenticated
using (bucket_id='chinito-menu' and public.is_staff('admin'));

-- Mantén la categoría de Chi-nito reservada: alta de nuevos productos solo en las cinco categorías del menú.
-- No es necesario modificar pedidos previos ni la tabla orders.

-- Validación del modo de venta por volumen en pedidos futuros.
-- Se reemplaza la función entera de creación para validar precios, extras y disponibilidad antes de confirmar.

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
  v_base_price numeric(10,2);
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
      v_max_guisados := coalesce(nullif((v_menu.metadata->>'max_guisados')::integer,0), case v_menu.slug when 'chi-nito-1' then 1 when 'chi-nito-2' then 2 when 'chi-nito-3' then 3 else 0 end);
      if v_max_guisados = 0 then raise exception 'Chi-nito inválido'; end if;
      if jsonb_array_length(coalesce(v_item->'guisado_slugs','[]'::jsonb)) > v_max_guisados then raise exception 'Demasiados guisados para %', v_menu.name; end if;
      v_unit := v_menu.price;

      select name, price into v_base_name,v_base_price
      from public.menu_items
      where slug=(v_item->>'base_slug') and category='Base' and active=true;
      if v_base_name is null then raise exception 'Base no disponible'; end if;
      v_unit := v_unit + coalesce(v_base_price,0);

      v_guisados := '[]'::jsonb;
      for v_slug in select jsonb_array_elements_text(coalesce(v_item->'guisado_slugs','[]'::jsonb))
      loop
        select * into v_guisado_menu from public.menu_items where slug=v_slug and category='Guisado' and active=true;
        if not found then raise exception 'Guisado no disponible: %', v_slug; end if;
        v_unit := v_unit + coalesce(v_guisado_menu.price,0);
        v_guisados := v_guisados || jsonb_build_array(v_guisado_menu.name);
      end loop;
      if jsonb_array_length(v_guisados) = 0 then raise exception 'Selecciona al menos un guisado'; end if;

      for v_extra in select value from jsonb_array_elements(coalesce(v_item->'extras','[]'::jsonb))
      loop
        select * into v_extra_menu from public.menu_items where slug=(v_extra->>'catalog_slug') and active=true;
        if not found or v_extra_menu.category not in ('Bebida','Complemento','Extra') then raise exception 'Extra no disponible'; end if;
        v_unit := v_unit + (v_extra_menu.price * greatest(1, least(50, coalesce((v_extra->>'quantity')::integer,1))));
        v_extras := v_extras || jsonb_build_array(jsonb_build_object(
          'name',v_extra_menu.name,
          'quantity',greatest(1, least(50, coalesce((v_extra->>'quantity')::integer,1))),
          'price',v_extra_menu.price
        ));
      end loop;
    elsif v_kind = 'takeaway' then
      if v_menu.category <> 'Guisado' then raise exception 'Guisado para llevar inválido'; end if;
      if v_menu.metadata->>'sell_by_volume' = 'false' then raise exception 'Este guisado no se vende por volumen'; end if;
      if v_variant = '1 litro' then
        v_unit := coalesce((v_menu.metadata->>'liter_price')::numeric,0);
      elsif v_variant = '1/2 litro' then
        v_unit := coalesce((v_menu.metadata->>'half_price')::numeric,0);
      else
        raise exception 'Tamaño de guisado inválido';
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


