
-- CAELIS: ecommerce database foundation
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'essentials',
  price_pkr numeric(12,2) not null check (price_pkr >= 0),
  image_url text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Each product's sizes, colours, SKUs and stock
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id)
    on delete cascade,
  size text not null,
  color text not null,
  sku text unique not null,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

-- 3. Customer orders
-- Orders must be created through a secure server-side checkout,
-- not directly by an untrusted browser.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default
    ('CA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address text not null,
  city text not null,
  postal_code text,
  country text not null default 'Pakistan',
  payment_method text not null default 'cod'
    check (payment_method in ('cod', 'easypaisa', 'jazzcash', 'nayapay', 'card')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_pkr numeric(12,2) not null check (total_pkr >= 0),
  created_at timestamptz not null default now()
);

-- 4. Items belonging to each order
-- Store snapshots so historical order details remain meaningful.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id)
    on delete cascade,
  variant_id uuid references public.product_variants(id)
    on delete set null,
  product_name text not null,
  sku text not null,
  size text not null,
  color text not null,
  unit_price_pkr numeric(12,2) not null check (unit_price_pkr >= 0),
  quantity integer not null check (quantity > 0),
  line_total_pkr numeric(12,2) not null check (line_total_pkr >= 0)
);

create index if not exists products_active_idx
  on public.products(active);

create index if not exists variants_product_idx
  on public.product_variants(product_id);

create index if not exists orders_created_idx
  on public.orders(created_at desc);

create index if not exists order_items_order_idx
  on public.order_items(order_id);

-- 5. Enable Row Level Security
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public visitors can only read published products.
create policy "Public can view active products"
on public.products
for select
to anon, authenticated
using (active = true);

-- Public visitors can only view variants of published products.
create policy "Public can view variants of active products"
on public.product_variants
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_variants.product_id
      and p.active = true
  )
);

-- Admin permissions rely on the protected app_metadata role.
-- Set this role only through a trusted Supabase admin process.
create policy "Admins manage products"
on public.products
for all
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins manage variants"
on public.product_variants
for all
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Orders and order items are private until accessed by an admin.
create policy "Admins view and manage orders"
on public.orders
for all
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins view and manage order items"
on public.order_items
for all
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Product photos bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product photos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "Admins upload product photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins update product photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins delete product photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
