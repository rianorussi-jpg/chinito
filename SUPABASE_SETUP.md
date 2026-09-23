# Conectar Chi-nito con Supabase

## 1. Crear el proyecto
Crea **un solo proyecto de Supabase** para Cliente, Panel y Cocina.

## 2. Ejecutar el SQL
En Supabase abre **SQL Editor**, pega el contenido completo de `supabase/schema.sql` y ejecútalo.

## 3. Crear usuarios del personal
En **Authentication > Users**, crea por correo/contraseña al usuario del Panel y al de Cocina.

Luego copia el UUID de cada usuario y ejecuta en SQL Editor:

```sql
insert into public.staff_users (user_id, role)
values
  ('UUID_DEL_ADMIN', 'admin'),
  ('UUID_DE_COCINA', 'kitchen')
on conflict (user_id) do update set role=excluded.role, active=true;
```

El usuario `admin` puede entrar a Panel y Cocina. El usuario `kitchen` solo puede entrar a Cocina.

## 4. Variables en Vercel
En **los 3 proyectos de Vercel** agrega exactamente estas variables:

```text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Se obtienen en **Supabase > Project Settings > API**.

Después haz **Redeploy** de Cliente, Panel y Cocina.

> Nunca pongas `service_role` en Vercel/frontend. Esta integración solo usa la `anon key` + RLS.

## 5. Qué queda conectado
- Cliente crea pedidos reales mediante una función protegida de Supabase.
- Cocina recibe nuevos pedidos por Realtime y cambia `Nuevo → Preparando → Listo → Entregado`.
- Panel ve pedidos y ventas reales, y los estados cambian en tiempo real.
- Panel puede marcar productos `Disponible / Agotado`; Cliente lo refleja en tiempo real.
- Panel guarda nombre/horario/estado de la sucursal en `store_settings`.

## Nota sobre pagos
`Pagar en línea` crea el pedido con `payment_status = pending`; todavía no cobra tarjeta. Stripe se conecta como siguiente etapa. `Pagar al recoger` también queda como `pending` hasta que se cobre físicamente.

## 6. Actualización: editor completo de menú

Si ya ejecutaste `supabase/schema.sql` antes, **NO lo vuelvas a ejecutar**: contiene un catálogo inicial con `ON CONFLICT DO UPDATE` que sobreescribiría nombres, precios e imágenes editados posteriormente.

En el mismo proyecto Supabase, abre SQL Editor y ejecuta únicamente el contenido de `supabase/menu_editor_migration.sql` (sin copiar las líneas de Markdown ` ```sql `). Crea el bucket público `chinito-menu`, políticas de Storage para usuarios admin y actualiza las comprobaciones de pedidos. No borra productos ni órdenes actuales.

Después despliega de nuevo **apps/cliente** y **apps/panel** en sus proyectos de Vercel. **apps/cocina no cambia** y sigue leyendo los mismos pedidos de Supabase. Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben seguir siendo las mismas en ambos sitios. No utilices la `service_role` en ningún frontend.

En Panel → Menú → Nuevo producto, selecciona entre Base, Guisado, Bebida, Complemento o Extra. También puedes editar los tres Chi-nitos existentes, sin crear modelos adicionales de Chi-nito. En un Guisado puedes habilitar la venta por ½ litro y 1 litro, con sus dos precios independientes. Si deshabilitas esa opción, el guisado sigue disponible para personalizar bowls, pero desaparece de "Guisados para llevar".

Las imágenes comerciales nuevas se suben desde Panel a Supabase Storage y se publican automáticamente en Cliente. Si editas un producto **sin escoger archivo**, su imagen permanece intacta. Un producto nuevo sin imagen utiliza una imagen temporal ya incluida en la app según su categoría, que puedes reemplazar desde el editor más adelante. Se admiten JPG, PNG y WebP hasta 5 MB.

Los productos antiguos **no se eliminan físicamente** para conservar la integridad de pedidos históricos. Usa Disponibilidad o desmarca "Producto disponible" para ocultarlos del menú de venta. Los nombres/precios de los productos disponibles se actualizan en Cliente desde el catálogo de Supabase; los pedidos históricos mantienen los nombres, cantidades y precios registrados al confirmar la orden. El servidor vuelve a calcular los precios al confirmar y rechaza los productos o tamaños ya no disponibles.

**Prueba antes de producción:** con el mismo Supabase en Cliente y Panel, inicia sesión en Panel, añade un complemento de prueba, verifica que aparezca en Inicio, edita su precio e imagen, agrégalo al carrito y confirma un pedido de prueba. Comprueba el pedido en Cocina y desactiva el producto para confirmar que Cliente ya no deja pedirlo.
