# Chi-nito · Historial y flujo de pedidos

## 1. Ejecutar en Supabase
Abre **Supabase → SQL Editor** y ejecuta únicamente:

`supabase/order_status_history_migration.sql`

Esto hace que los pedidos nuevos entren directamente en **Preparando** y convierte cualquier pedido activo antiguo que siga en **Nuevo**.

## 2. Vercel
Vuelve a desplegar las tres apps:

- `apps/cliente`
- `apps/cocina`
- `apps/panel`

No necesitas agregar variables de entorno nuevas.

## Cambios incluidos
- Cocina carga todos los pedidos activos, aunque sean de días anteriores.
- Flujo operativo: Preparando → Listo para recoger → Entregado.
- Al marcar Entregado, el pedido desaparece del tracker del cliente y de Kitchen Mode.
- Mi cuenta → Ver pedidos muestra el historial del cliente.
- Panel permite cambiar de fecha para consultar pedidos históricos.
