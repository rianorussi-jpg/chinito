-- CHI-NITO · Stripe Checkout (pagos en línea)
-- Ejecutar UNA VEZ después de las migraciones anteriores.
-- No borra pedidos, menú, usuarios ni cashback.

begin;

alter table public.orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_paid_at timestamptz;

create unique index if not exists orders_stripe_checkout_session_uidx
  on public.orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists orders_stripe_payment_intent_uidx
  on public.orders(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists orders_payment_status_idx
  on public.orders(payment_method,payment_status,status,created_at desc);

-- La app cliente solo lee estos datos a través de sus políticas existentes.
-- Ninguna clave de Stripe se guarda en Postgres ni se expone al navegador.

commit;
