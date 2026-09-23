# Chi-nito · Cashback y perfil de solo lectura

## Actualización en Supabase (obligatoria)

En el proyecto de Supabase que usan Cliente, Panel y Cocina, abre **SQL Editor** y ejecuta **solo** `supabase/cashback_profile_migration.sql` (contenido SQL puro, sin las marcas de bloque Markdown). Es una migración incremental: no ejecutes otra vez `schema.sql` ni los SQL anteriores y no borres tablas.

La migración crea un monedero privado por cliente, un historial auditable y los campos de cashback en pedidos; configura permisos, un método seguro de creación de pedidos y la acreditación de cashback al entregar. Los clientes **solo pueden leer su propio saldo**; no pueden incrementarlo ni canjear más del disponible. El servidor usa los precios del catálogo y bloquea el saldo durante cada canje.

## Deploy

Sube `apps/cliente` a su Vercel y haz Redeploy. Conserva sus variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` actuales (no utilices `service_role` en el frontend). **Panel y Cocina no necesitan cambiar sus archivos**: siguen modificando el estado del pedido mediante el mismo campo `orders.status` y eso acredita el saldo automáticamente. El cambio SQL restringe sus actualizaciones de `orders` al campo `status`, que es el único que estas apps editan.

## Funcionamiento

- Perfil con sesión iniciada: muestra nombre, teléfono, correo y cashback. Para modificar nombre, teléfono o correo, entra a **Editar perfil**. El cambio de correo requiere confirmarlo en el nuevo correo electrónico.
- Alta y edición: teléfono con selector de banderita + prefijo internacional, sin nombre del país y en un cuadro más angosto.
- Checkout: muestra nombre y teléfono de solo lectura, obtenidos del perfil del usuario en Supabase.
- Checkout: el cliente puede activar **Usar cashback**. Se descuenta el saldo disponible hasta el total del pedido. El descuento se valida y realiza en el servidor, no en el navegador.
- Cashback acumulado: **$1 por cada $10 completos del total pagado, después del descuento**, cuando el estado cambia a **Entregado**. Se acredita una sola vez por pedido.
- El personal debe marcar **Entregado** únicamente tras recibir el pago en pickup. Para pedidos con pago en línea, solo se acredita cuando `payment_status='paid'` (confirmación real de pasarela), además de `Entregado`. **La versión anterior aún no procesa cobros de tarjeta en línea**, así que no marques pagos en línea como pagados sin integrar y verificar una pasarela de pago.
- Al cancelar un pedido, el sistema devuelve el cashback canjeado y revierte el cashback acreditado si lo hubo. Si ya gastó puntos posteriores al pedido cancelado, puede existir un saldo interno negativo a saldar con futuros pedidos; en la app el disponible nunca baja de $0.
- No se otorga saldo por compras históricas anteriores a esta migración. No se otorga cashback sobre cashback usado ni cuando un pedido solo fue creado o está en preparación.

## Pruebas recomendadas

1. Registrar un cliente e iniciar sesión; comprobar que Perfil muestre cashback $0 y sus datos sin inputs editables.
2. Hacer un pedido de $95 y completarlo en Cocina como **Entregado** con `payment_method='pickup'`; comprobar saldo de $9.
3. Hacer otro pedido de $50 y usar los $9: el checkout muestra total $41 y el saldo baja a $0. Completarlo: se acumulan $4 nuevos.
4. Intentar dos canjes simultáneos con el mismo saldo; el servidor debe aceptar como máximo uno cuando el saldo no alcanza para ambos.
5. Intentar volver a marcar el mismo pedido como Entregado; no debe acreditar doble.
6. Cancelar un pedido con cashback usado y verificar la devolución del saldo.

**Nota:** pruebas reales de transacciones, permisos y Realtime deben realizarse en tu proyecto de Supabase después de instalar la migración.
