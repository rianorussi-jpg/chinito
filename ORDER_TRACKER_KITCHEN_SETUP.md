# Chi-nito · Tracker de pedidos + Kitchen Mode

## Qué cambia

- Cliente: la pantalla de pedido confirmado ahora muestra estado, número, productos, pickup, total y progreso.
- Cliente: mientras exista un pedido con estado `Nuevo`, `Preparando` o `Listo`, aparece un icono de seguimiento en la parte superior.
- Cliente: `Nuevo` y `Preparando` se muestran al cliente como **Preparando · listo en 10–15 minutos**; `Listo` se muestra como **Listo para recoger**.
- Cocina: tablero dividido en **Preparando** y **Listos para recoger**.
- Cocina: botón **Nuevo pedido** para capturar un pedido manual y personalizar Chi-nitos, extras, complementos, bebidas y guisados para llevar.

## Paso obligatorio en Supabase

Ejecuta una sola vez en SQL Editor:

`supabase/kitchen_manual_orders_migration.sql`

La función creada solo puede ser usada por usuarios activos de `staff_users` con rol `admin` o `kitchen`.

## Vercel

Después sube/reemplaza:

- `apps/cliente`
- `apps/cocina`

No hay cambios necesarios en `apps/panel` para esta actualización.

Los dos proyectos siguen usando las mismas variables existentes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
