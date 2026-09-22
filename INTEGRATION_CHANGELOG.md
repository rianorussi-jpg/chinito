# Integración Supabase aplicada

## Cliente
- Crea pedidos reales con `create_customer_order`.
- Total calculado nuevamente en servidor usando el catálogo de Supabase.
- Disponibilidad y precios del catálogo se leen de Supabase.
- Cambios de disponibilidad llegan por Realtime.
- Muestra el número real de pedido al confirmar.

## Panel
- Eliminados pedidos/menú demo.
- Login con Supabase Auth para rol `admin`.
- Pedidos reales del día + ventas reales.
- Cambio de estado de pedidos.
- Menú y disponibilidad conectados a `menu_items`.
- Configuración de sucursal conectada a `store_settings`.
- Realtime para pedidos, menú y configuración.

## Cocina
- Eliminados pedidos demo.
- Login con Supabase Auth para roles `admin` o `kitchen`.
- Pedidos reales en Realtime.
- Flujo `Nuevo → Preparando → Listo → Entregado` persistido en Supabase.
- Base, guisados, extras, variantes y cantidades visibles en ticket.

## Seguridad
- RLS habilitado.
- Cliente no puede leer pedidos.
- Creación pública de pedidos solo mediante RPC con cálculo de precio del lado servidor.
- Panel/Cocina requieren usuario autorizado en `staff_users`.
- No se usa `service_role` en frontend.
