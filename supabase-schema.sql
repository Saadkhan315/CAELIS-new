-- CAELIS/KALIS ecommerce schema for Supabase.
-- Run this complete file in Supabase > SQL Editor > New query.
-- Row Level Security (RLS) stays enabled. Never expose service_role/secret keys.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text,
 role text not null default 'customer' check(role in ('customer','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 120),
 description text not null default '',
 category text not null default 'Essentials',
 image_url text,
 tag text,
 is_published boolean not null default false,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.product_variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 size text not null default 'One size',
 color text not null default 'Standard',
 price numeric(12,2) not null check(price>0),
 stock integer not null default 0 check(stock>=0),
 sku text unique,
 created_at timestamptz not null default now(),
 unique(product_id,size,color)
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
 subtotal numeric(12,2) not null check(subtotal>=0),
 shipping_fee numeric(12,2) not null default 0 check(shipping_fee>=0),
 total numeric(12,2) not null check(total>=0),
 payment_method text not null check(payment_method in ('cod','manual')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending_verification','paid','refunded')),
 shipping_name text not null,
 shipping_email text not null,
 shipping_phone text not null,
 shipping_address text not null,
 shipping_city text not null,
 shipping_postal_code text not null default '',
 shipping_country text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 variant_id uuid references public.product_variants(id) on delete set null,
 product_name text not null,
 size text not null default '',
 color text not null default '',
 sku text,
 unit_price numeric(12,2) not null check(unit_price>=0),
 quantity integer not null check(quantity>0),
 line_total numeric(12,2) not null check(line_total>=0)
);
create index if not exists products_published_created_idx on public.products(is_published,created_at desc);
create index if not exists variants_product_idx on public.product_variants(product_id);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

-- New accounts are customers by default; never self-assign admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,role) values(new.id,new.email,'customer')
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
drop policy if exists "Admin updates profiles" on public.profiles;
create policy "Admin updates profiles" on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Read published products" on public.products;
create policy "Read published products" on public.products for select to anon,authenticated using(is_published=true or public.is_admin());
drop policy if exists "Admin inserts products" on public.products;
create policy "Admin inserts products" on public.products for insert to authenticated with check(public.is_admin());
drop policy if exists "Admin updates products" on public.products;
create policy "Admin updates products" on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admin deletes products" on public.products;
create policy "Admin deletes products" on public.products for delete to authenticated using(public.is_admin());

drop policy if exists "Read variants for visible products" on public.product_variants;
create policy "Read variants for visible products" on public.product_variants for select to anon,authenticated
using(exists(select 1 from public.products p where p.id=product_id and p.is_published=true) or public.is_admin());
drop policy if exists "Admin inserts variants" on public.product_variants;
create policy "Admin inserts variants" on public.product_variants for insert to authenticated with check(public.is_admin());
drop policy if exists "Admin updates variants" on public.product_variants;
create policy "Admin updates variants" on public.product_variants for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Admin deletes variants" on public.product_variants;
create policy "Admin deletes variants" on public.product_variants for delete to authenticated using(public.is_admin());

drop policy if exists "Read own orders or admin reads all" on public.orders;
create policy "Read own orders or admin reads all" on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "Admin updates orders" on public.orders;
create policy "Admin updates orders" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Read order items belonging to own order or admin" on public.order_items;
create policy "Read order items belonging to own order or admin" on public.order_items for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));

-- Checkout uses current database prices and stock, not values submitted by the browser.
-- Stock rows are locked while order is checked/created to reduce overselling.
create or replace function public.place_order(p_items jsonb,p_shipping jsonb,p_payment_method text default 'cod')
returns uuid language plpgsql security definer set search_path=public as $$
declare
 u uuid:=auth.uid(); oid uuid:=gen_random_uuid(); subtotal_amount numeric(12,2):=0;
 it jsonb; v public.product_variants%rowtype; p public.products%rowtype; q integer;
 nm text; em text; ph text; addr text; city_name text; postal text; country_name text;
begin
 if u is null then raise exception 'Sign in before placing an order.'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty.'; end if;
 if jsonb_array_length(p_items)>50 then raise exception 'Too many items in one order.'; end if;
 if p_payment_method not in ('cod','manual') then raise exception 'Invalid payment method.'; end if;
 nm:=trim(coalesce(p_shipping->>'full_name','')); em:=trim(coalesce(p_shipping->>'email',''));
 ph:=trim(coalesce(p_shipping->>'phone','')); addr:=trim(coalesce(p_shipping->>'address',''));
 city_name:=trim(coalesce(p_shipping->>'city','')); postal:=trim(coalesce(p_shipping->>'postal_code',''));
 country_name:=trim(coalesce(p_shipping->>'country',''));
 if length(nm)<2 or length(em)<5 or position('@' in em)<2 or length(ph)<7 or length(addr)<5 or length(city_name)<2 or length(country_name)<2
 then raise exception 'Please enter complete and valid delivery details.'; end if;

 -- First pass: lock variants, verify stock and calculate database prices.
 for it in select value from jsonb_array_elements(p_items) order by value->>'variant_id' loop
   if coalesce(it->>'variant_id','')='' then raise exception 'A cart item is missing its variant.'; end if;
   q:=coalesce((it->>'quantity')::integer,0);
   if q<1 or q>20 then raise exception 'Quantity must be between 1 and 20.'; end if;
   select * into v from public.product_variants where id=(it->>'variant_id')::uuid for update;
   if not found then raise exception 'A product variant no longer exists.'; end if;
   select * into p from public.products where id=v.product_id;
   if not found or not p.is_published then raise exception 'A product is no longer available.'; end if;
   if v.stock<q then raise exception 'Not enough stock for % / %.',v.size,v.color; end if;
   subtotal_amount:=subtotal_amount+(v.price*q);
 end loop;

 insert into public.orders(id,user_id,status,subtotal,shipping_fee,total,payment_method,payment_status,
 shipping_name,shipping_email,shipping_phone,shipping_address,shipping_city,shipping_postal_code,shipping_country)
 values(oid,u,'pending',subtotal_amount,0,subtotal_amount,p_payment_method,
 case when p_payment_method='manual' then 'pending_verification' else 'unpaid' end,
 nm,em,ph,addr,city_name,postal,country_name);

 for it in select value from jsonb_array_elements(p_items) order by value->>'variant_id' loop
   select * into v from public.product_variants where id=(it->>'variant_id')::uuid for update;
   select * into p from public.products where id=v.product_id;
   q:=(it->>'quantity')::integer;
   insert into public.order_items(order_id,variant_id,product_name,size,color,sku,unit_price,quantity,line_total)
   values(oid,v.id,p.name,v.size,v.color,v.sku,v.price,q,v.price*q);
   update public.product_variants set stock=stock-q where id=v.id;
 end loop;
 return oid;
end; $$;
revoke all on function public.place_order(jsonb,jsonb,text) from public;
grant execute on function public.place_order(jsonb,jsonb,text) to authenticated;
-- No public direct insert policies for orders/order_items: checkout must call place_order.
