# CAELIS — setup guide
This is a static HTML/CSS/JavaScript storefront. Supabase provides authentication, catalogue, stock and order data.

## 1. Connect Supabase
1. Create a Supabase project at https://supabase.com/.
2. Open SQL Editor and run the complete `supabase-schema.sql` file from this repository.
3. In Project Settings → API Keys, copy the **Project URL** and the **publishable/anon public key**.
4. Edit `supabase-config.js` and replace both `PASTE_...` values.
5. Never place a service-role or secret key in browser files. The public key is designed for browsers only when Row Level Security policies are correctly enabled.

## 2. Deploy
GitHub repository → Settings → Pages → Deploy from a branch → `main` (or the branch you choose) → `/(root)`. The first page is `index.html`; admin is `admin.html`.

## 3. Create your account and assign admin safely
1. Open the website and select Account → Create one.
2. Confirm your email if Supabase asks you to.
3. In Supabase Dashboard → Authentication → Users, select your user and edit its **app_metadata** using trusted administrator controls to add `role: admin`. The resulting JWT app metadata must contain `role = admin`.
4. Sign out and sign in again so a refreshed token includes the new claim.
5. Open `/admin.html`. Do not use a public profile table or user-editable metadata for authorization; customers must never be able to grant themselves admin rights.

## 4. Manage products
Open `/admin.html`, sign in as the admin, and add a real product, its image URL, PKR price, first size/colour, stock and SKU. Keep a product as Draft until its details and stock are correct. Product images should be your own or licensed images.

## 5. What works / what still needs setup
- Storefront: reads published products and size/colour stock from Supabase; search, category filters, sorting, local shopping bag and PKR display.
- Accounts: Supabase email/password sign-up, sign-in, sign-out and recent order display.
- Admin: role check, product creation/publish/draft/delete, stock display and order status updates.
- Cash on delivery: checkout uses the database `place_order` function. It recalculates prices from the database, locks stock rows, rejects unavailable quantities and records an order. Test this carefully before real orders.
- Online card, EasyPaisa, JazzCash and NayaPay payments are **not integrated**. They require an appropriate payment provider and server-side payment verification. Do not mark orders as paid manually unless funds are verified.
- Newsletter delivery, email/SMS notifications, shipping fee rules, returns/refunds and legal/business pages need real business details and service configuration before launch.
- This starter has not been independently security-audited. Test with sample data and have a trusted developer review it before taking real customer payments.

## Troubleshooting
- “Supabase is not configured”: edit `supabase-config.js` with your real project URL and public key.
- Products don't appear: run the SQL script, publish a product and add at least one size/colour variant with stock.
- Admin access denied: check that protected `app_metadata.role` is `admin`, then sign out and back in.
- Order rejected: sign in, verify the product is published and the selected variant has enough stock, and check the error shown in the checkout.
