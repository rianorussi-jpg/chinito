# Chi-nito · Registro e inicio de sesión de clientes

## 1. Ejecutar solo la migración nueva

En el proyecto de Supabase que ya usan Cliente, Panel y Cocina: **SQL Editor → New query**. Copia **solo SQL** (sin comillas triples ni `sql`) de `supabase/customer_auth_migration.sql` y pulsa **Run**. No vuelvas a ejecutar `schema.sql`: conserva tu menú, pedidos y usuarios existentes.

La migración crea `customer_profiles` protegido con RLS, enlaza los pedidos nuevos con su cliente y exige una sesión válida en el servidor antes de permitir confirmar pedidos. Admin y Cocina mantienen sus permisos y flujo existentes.

## 2. Ajustes de Authentication

En **Supabase → Authentication → Providers → Email** verifica que la autenticación por correo/contraseña y el registro estén habilitados. Si la confirmación de correo está activada, el cliente tendrá que abrir el correo que recibe y confirmar su cuenta antes de iniciar sesión. En **Authentication → URL Configuration** coloca como **Site URL** el dominio real de tu cliente en Vercel y agrégalo también a la lista de **Redirect URLs** (incluye las URL reales que uses para pruebas, si corresponde). El enlace de confirmación redirige al cliente a su app. Enviar correos a clientes reales puede requerir configurar un proveedor SMTP propio; revisa los límites de correo del proyecto.

**No necesitas agregar una segunda base de datos ni cambiar las claves de Vercel.** La app sigue usando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` ya configuradas. Nunca publiques `service_role` en el frontend.

## 3. Publicación

Sube el contenido actualizado de `apps/cliente` al proyecto de Vercel del cliente y despliega. `apps/panel` y `apps/cocina` siguen igual, no necesitan redeploy. `libphonenumber-js` está incluido en el `package.json` del cliente y Vercel lo instalará junto con las demás dependencias al compilar.

## 4. Pruebas

- Regístrate con nombre, país/teléfono, email y dos contraseñas iguales. Confirma correo si Supabase lo requiere.
- Inicia sesión, recarga y cierra la pestaña. Al volver desde el mismo navegador, la sesión se recupera automáticamente si sigue vigente. Si borras los datos del navegador, cierras sesión o caduca/invalida la sesión, tendrás que ingresar otra vez.
- Sin sesión, agrega productos y pulsa **Ver carrito → Continuar**. Se abre el panel de acceso y **no se pierde el carrito**. Al iniciar sesión pasas a Checkout. Con sesión activa, Continuar pasa directamente a Checkout.
- Edita tus datos en el panel de perfil, guarda, vuelve a abrir la app: nombre y teléfono se recuperan de Supabase.
- Confirma un pedido real y verifica que aparece en Cocina y Panel, con el cliente vinculado en `orders.customer_id`.

Notas: registrarse con email/contraseña **no** verifica la titularidad del número de teléfono. Las sesiones se almacenan en el dispositivo/navegador; los sistemas operativos, el usuario o Supabase pueden invalidarlas. El pago en línea aún requiere una pasarela y confirmación de pago real antes de marcar la orden como pagada.
