-- CAELIS live database hardening patch (2026-10-31)
-- Safe to apply to the existing CAELIS schema. Does not add products or orders.
-- Checkout stays SECURITY DEFINER because it must atomically validate stock and create
-- order rows despite customer-facing RLS. It checks auth.uid(), pins search_path,
-- derives all prices from database rows, and is executable only by authenticated users.

REVOKE EXECUTE ON FUNCTION public.restore_cancelled_order_stock() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address text,
  p_city text,
  p_postal_code text DEFAULT ''::text,
  p_country text DEFAULT 'Pakistan'::text,
  p_payment_method text DEFAULT 'cod'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_qty integer;
  v_unit_price numeric(12,2);
  v_line numeric(12,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in before placing an order'; END IF;
  IF coalesce(p_payment_method, '') <> 'cod' THEN RAISE EXCEPTION 'Only cash on delivery is currently supported'; END IF;
  IF length(trim(coalesce(p_customer_name, ''))) < 2
     OR length(trim(coalesce(p_customer_phone, ''))) < 7
     OR position('@' in coalesce(p_customer_email, '')) < 2
     OR length(trim(coalesce(p_shipping_address, ''))) < 5
     OR length(trim(coalesce(p_city, ''))) < 2 THEN
    RAISE EXCEPTION 'Please provide valid delivery details';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Order items must be a JSON array';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'Your bag is empty or contains too many line items';
  END IF;

  INSERT INTO public.orders(user_id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code, country, payment_method, payment_status, status, total_pkr)
  VALUES (v_user, trim(p_customer_name), trim(p_customer_email), trim(p_customer_phone), trim(p_shipping_address), trim(p_city),
          nullif(trim(coalesce(p_postal_code, '')), ''), coalesce(nullif(trim(p_country), ''), 'Pakistan'), 'cod', 'pending', 'pending', 0)
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Each order item must be an object';
    END IF;
    BEGIN
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Each order item must have a valid quantity';
    END;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    BEGIN
      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = (v_item->>'variant_id')::uuid
      FOR UPDATE;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'A selected size/colour is invalid';
    END;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected size/colour is no longer available'; END IF;
    IF v_variant.stock < v_qty THEN RAISE EXCEPTION 'Not enough stock for SKU %', v_variant.sku; END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected product is no longer published'; END IF;

    v_unit_price := CASE
      WHEN v_product.sale_price_pkr IS NOT NULL AND v_product.sale_price_pkr <= v_product.price_pkr
      THEN v_product.sale_price_pkr
      ELSE v_product.price_pkr
    END;
    v_line := v_unit_price * v_qty;
    v_total := v_total + v_line;

    INSERT INTO public.order_items(order_id, variant_id, product_name, sku, size, color, unit_price_pkr, quantity, line_total_pkr)
    VALUES (v_order_id, v_variant.id, v_product.name, v_variant.sku, v_variant.size, v_variant.color, v_unit_price, v_qty, v_line);
    UPDATE public.product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
  END LOOP;

  UPDATE public.orders SET total_pkr = v_total WHERE id = v_order_id;
  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_pkr', v_total);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- Cover the order_items.variant_id foreign key noted by the performance advisor.
CREATE INDEX IF NOT EXISTS order_items_variant_idx ON public.order_items(variant_id);
