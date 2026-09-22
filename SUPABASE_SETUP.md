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
