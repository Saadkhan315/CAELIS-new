-- CAELIS store schema and secure cash-on-delivery checkout
-- Run this complete script in Supabase SQL Editor. Review existing data before rerunning on a live store.
create extension if not exists pgcrypto;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
 description text not null default '', category text not null default 'essentials',
 price_pkr numeric(12,2) not null check(price_pkr >= 0), sale_price_pkr numeric(12,2) check(sale_price_pkr is null or (sale_price_pkr >= 0 and sale_price_pkr < price_pkr)), image_url text,
 active boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.products add column if not exists sale_price_pkr numeric(12,2);
create table if not exists public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 size text not null, color text not null, sku text unique not null,
 stock integer not null default 0 check(stock >= 0), created_at timestamptz not null default now(),
 unique(product_id,size,color)
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 order_number text unique not null default ('CA-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 customer_name text not null, customer_email text not null, customer_phone text not null,
 shipping_address text not null, city text not null, postal_code text,
 country text not null default 'Pakistan',
 payment_method text not null default 'cod' check(payment_method in ('cod')),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','failed','refunded')),
 status text not null default 'pending' check(status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
 total_pkr numeric(12,2) not null check(total_pkr >= 0), created_at timestamptz not null default now()
);
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 variant_id uuid references public.product_variants(id) on delete set null,
 product_name text not null, sku text not null, size text not null, color text not null,
 unit_price_pkr numeric(12,2) not null check(unit_price_pkr >= 0),
 quantity integer not null check(quantity > 0), line_total_pkr numeric(12,2) not null check(line_total_pkr >= 0)
);
create index if not exists products_active_idx on public.products(active);
create index if not exists variants_product_idx on public.product_variants(product_id);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_user_idx on public.orders(user_id,created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- Return stock when an administrator cancels an order; guard against double-restocking.
alter table public.orders add column if not exists stock_restored boolean not null default false;
create or replace function public.restore_cancelled_order_stock()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' and new.stock_restored=false then
    update public.product_variants v
      set stock=v.stock+oi.quantity
      from public.order_items oi
      where oi.order_id=new.id and oi.variant_id=v.id;
    update public.orders set stock_restored=true where id=new.id;
  end if;
  return new;
end; $$;
drop trigger if exists restore_stock_after_order_cancel on public.orders;
create trigger restore_stock_after_order_cancel
after update of status on public.orders
for each row execute function public.restore_cancelled_order_stock();
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select to anon,authenticated using(active=true);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products for all to authenticated using((select auth.jwt()->'app_metadata'->>'role')='admin') with check((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Public can view variants of active products" on public.product_variants;
create policy "Public can view variants of active products" on public.product_variants for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_variants.product_id and p.active=true));
drop policy if exists "Admins manage variants" on public.product_variants;
create policy "Admins manage variants" on public.product_variants for all to authenticated using((select auth.jwt()->'app_metadata'->>'role')='admin') with check((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins view and manage orders" on public.orders;
create policy "Admins view and manage orders" on public.orders for all to authenticated using((select auth.jwt()->'app_metadata'->>'role')='admin') with check((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Customers view own orders" on public.orders;
create policy "Customers view own orders" on public.orders for select to authenticated using(user_id=auth.uid());
drop policy if exists "Admins view and manage order items" on public.order_items;
create policy "Admins view and manage order items" on public.order_items for all to authenticated using((select auth.jwt()->'app_metadata'->>'role')='admin') with check((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Customers view own order items" on public.order_items;
create policy "Customers view own order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid()));
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do nothing;
drop policy if exists "Public can view product photos" on storage.objects;
create policy "Public can view product photos" on storage.objects for select to anon,authenticated using(bucket_id='product-images');
drop policy if exists "Admins upload product photos" on storage.objects;
create policy "Admins upload product photos" on storage.objects for insert to authenticated with check(bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins update product photos" on storage.objects;
create policy "Admins update product photos" on storage.objects for update to authenticated using(bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='admin') with check(bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins delete product photos" on storage.objects;
create policy "Admins delete product photos" on storage.objects for delete to authenticated using(bucket_id='product-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');

create or replace function public.place_order(
 p_items jsonb, p_customer_name text, p_customer_email text, p_customer_phone text,
 p_shipping_address text, p_city text, p_postal_code text default '',
 p_country text default 'Pakistan', p_payment_method text default 'cod'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_user uuid := auth.uid(); v_order_id uuid; v_order_number text; v_total numeric(12,2):=0;
 v_item jsonb; v_variant public.product_variants%rowtype; v_product public.products%rowtype;
 v_qty integer; v_line numeric(12,2);
begin
 if v_user is null then raise exception 'Sign in before placing an order'; end if;
 if p_payment_method <> 'cod' then raise exception 'Only cash on delivery is currently supported'; end if;
 if length(trim(coalesce(p_customer_name,'')))<2 or length(trim(coalesce(p_customer_phone,'')))<7 or position('@' in coalesce(p_customer_email,''))<2 or length(trim(coalesce(p_shipping_address,'')))<5 or length(trim(coalesce(p_city,'')))<2 then
   raise exception 'Please provide valid delivery details';
 end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>30 then raise exception 'Your bag is empty or contains too many line items'; end if;
 insert into public.orders(user_id,customer_name,customer_email,customer_phone,shipping_address,city,postal_code,country,payment_method,payment_status,status,total_pkr)
 values(v_user,trim(p_customer_name),trim(p_customer_email),trim(p_customer_phone),trim(p_shipping_address),trim(p_city),nullif(trim(coalesce(p_postal_code,'')),''),coalesce(nullif(trim(p_country),''),'Pakistan'),'cod','pending','pending',0)
 returning id,order_number into v_order_id,v_order_number;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_qty := (v_item->>'quantity')::integer;
   if v_qty<1 or v_qty>20 then raise exception 'Invalid quantity'; end if;
   select * into v_variant from public.product_variants where id=(v_item->>'variant_id')::uuid for update;
   if not found then raise exception 'A selected size/colour is no longer available'; end if;
   if v_variant.stock<v_qty then raise exception 'Not enough stock for SKU %',v_variant.sku; end if;
   select * into v_product from public.products where id=v_variant.product_id and active=true;
   if not found then raise exception 'A selected product is no longer published'; end if;
   v_line:=v_product.price_pkr*v_qty; v_total:=v_total+v_line;
   insert into public.order_items(order_id,variant_id,product_name,sku,size,color,unit_price_pkr,quantity,line_total_pkr)
   values(v_order_id,v_variant.id,v_product.name,v_variant.sku,v_variant.size,v_variant.color,v_product.price_pkr,v_qty,v_line);
   update public.product_variants set stock=stock-v_qty where id=v_variant.id;
 end loop;
 update public.orders set total_pkr=v_total where id=v_order_id;
 return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total_pkr',v_total);
end; $$;
revoke all on function public.place_order(jsonb,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.place_order(jsonb,text,text,text,text,text,text,text,text) to authenticated;
