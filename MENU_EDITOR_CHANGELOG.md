# Chi-nito: catálogo editable

- Panel de administración: Menú permite crear productos de Base, Guisado, Bebida, Complemento y Extra, editar los existentes (incluidos los tres Chi-nitos), cambiar descripción, precio, orden, visibilidad e imagen.
- Para guisados, venta por medio litro y litro opcional con precios propios. No afecta a su selección dentro de bowls.
- Imagen previa existente se conserva al no elegir una nueva; nuevas imágenes JPG/PNG/WebP, máximo 5 MB, en bucket público `chinito-menu` con autorización admin.
- Cliente: tarjetas, bases, guisados, bebidas, complementos y extras se alimentan del catálogo ordenado de Supabase y se actualizan por Realtime.
- Checkout: el precio mostrado utiliza los valores de catálogo recibidos; el servidor recalcula el precio del pedido al confirmar.
- Cocina: no modifica su interfaz ni sus flujos, recibe los nuevos productos en los pedidos existentes.
- Ejecuta `supabase/menu_editor_migration.sql` antes de desplegar el nuevo panel. **No vuelvas a ejecutar `schema.sql`**, ya que incluye los datos iniciales del menú.
