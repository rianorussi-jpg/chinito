# Chi-nito React Suite

Tres apps React/Vite separadas:

- `apps/cliente` — app de pedidos pickup.
- `apps/panel` — administración de menú y pedidos.
- `apps/cocina` — Kitchen Mode.

## Ejecutar

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

Esta entrega es frontend funcional con datos demo/locales. Supabase, Stripe, impresión nativa y autenticación todavía no están conectados.
