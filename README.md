# CAELIS — Wear Confident. Wear Elegant.

Luxury fashion storefront for CAELIS, built with HTML, CSS, JavaScript and Supabase.

## Main files
- `index.html` — customer storefront, account modal, product catalogue, shopping bag and COD checkout
- `style.css` — responsive black, antique-gold and ivory design
- `app.js` — Supabase catalogue, sign-up/sign-in/out, cart and checkout UI
- `admin.html` / `admin.js` — protected product and order management
- `supabase-schema.sql` — database tables, Row Level Security policies and stock-safe cash-on-delivery order function
- `supabase-config.js` — browser-safe project URL and public key; replace placeholders before use
- `supabase-config.js.example` — safe configuration example
- `SETUP-GUIDE.md` — beginner setup and launch limitations

## Start here
1. Follow `SETUP-GUIDE.md`.
2. Run `supabase-schema.sql` in the Supabase SQL Editor.
3. Fill `supabase-config.js` with your Supabase project URL and public/anon key.
4. Assign the admin role only through trusted Supabase administrator controls using protected `app_metadata.role = admin`.
5. Test with sample products and orders before accepting real customer orders.

**Security note:** Never put a Supabase service-role/secret key in browser files. Online card, EasyPaisa, JazzCash and NayaPay payments are not integrated. This starter has not been independently security-audited.
