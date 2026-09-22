# Chi-nito React Suite

Tres apps React/Vite separadas conectadas al mismo proyecto de Supabase:

- `apps/cliente` — pedidos pickup y catálogo/disponibilidad en tiempo real.
- `apps/panel` — administración, pedidos, disponibilidad y configuración.
- `apps/cocina` — Kitchen Mode con pedidos y estados en tiempo real.

## Supabase

1. Ejecuta `supabase/schema.sql` en Supabase > SQL Editor.
2. Sigue `SUPABASE_SETUP.md` para crear los usuarios del personal.
3. Agrega en los tres proyectos de Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

4. Redeploy de las tres apps.

No uses `service_role` en frontend.

## Desarrollo local

En cada app:

```bash
npm install
npm run dev
```

O desde la raíz:

```bash
npm run dev:cliente
npm run dev:panel
npm run dev:cocina
```

## Pagos

La selección de pago en línea ya viaja al pedido, pero Stripe todavía no está conectado para cobrar. Esa integración queda como siguiente etapa.
