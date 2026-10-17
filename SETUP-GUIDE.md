# CAELIS / KALIS — Complete beginner setup

Read in order. The website frontend is hosted by GitHub Pages; Supabase provides the actual database, sign-in, stock and orders.

## 1. Create the backend/database
1. Open https://supabase.com/ and sign in.
2. Click **New project**. Name it `caelis-store`, choose a region near your customers, and set a strong database password. Keep that password private.
3. Wait for the project to finish creating.
4. Open **SQL Editor** → **New query**.
5. Open `supabase-schema.sql` from this downloaded package in Notepad, copy all the text, paste it into the SQL Editor and press **Run**.
6. Make sure the query completes without an error.

## 2. Connect the website to Supabase
1. In Supabase, open **Project Settings** → **API** (the menu may be named API Keys in some versions).
2. Copy the **Project URL**.
3. Copy the **anon/public/publishable key**. Never copy a `service_role` or secret key into the website.
4. In this project folder, copy `supabase-config.js.example` and rename the copy exactly `supabase-config.js`.
5. Open `supabase-config.js` in Notepad. Replace the two placeholder values with your Project URL and public key, keeping the quotation marks. Save it.

Example shape (fake values):
```js
window.CAELIS_SUPABASE_URL = "https://your-project.supabase.co";
window.CAELIS_SUPABASE_ANON_KEY = "your-public-key";
```

## 3. Upload files to your existing GitHub repository
1. Download and unzip `caelis-kalis-store.zip`.
2. Open your repository's **Code** tab.
3. Click **Add file** → **Upload files**.
4. Upload these files from the unzipped folder to the repository's top level (root):
   - `index.html`
   - `style.css`
   - `app.js`
   - `admin.html`
   - `admin.js`
   - `supabase-config.js` (your configured file, not the example)
5. Click **Commit changes**.
6. Keep `supabase-schema.sql` and this guide for yourself; they do not need to be uploaded publicly.

## 4. Publish with GitHub Pages
1. Repository → **Settings** → **Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`; folder: `/(root)`; click **Save**.
4. Wait a few minutes. GitHub shows the exact published URL on that same page. It looks like `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

## 5. Create your own account
1. Open the published website.
2. Click **Account** → **Create account**.
3. Use an email you can access and a strong password.
4. If email confirmation is enabled, confirm via your email.
5. Sign in before checking out.

## 6. Make your own account the store admin
1. In Supabase, open **Authentication** → **Users**.
2. Find your new account and copy its user ID/UUID.
3. Open **SQL Editor** → **New query**.
4. Run this, replacing the sample ID with your own exact UUID:
```sql
update public.profiles
set role = 'admin'
where id = 'PASTE-YOUR-USER-UUID-HERE';
```
5. Open your live website URL plus `/admin.html`, for example `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html`.
6. Sign in with the same account. Only your account should be promoted to admin. Never promote customers.

## 7. Add products
1. In `admin.html`, enter product name, category, description and an image URL you have permission to use.
2. Add the first size, colour, price in PKR and stock.
3. Choose Published and click **Save product**.
4. It should appear on the storefront.
5. The admin form adds one variant. To add more sizes/colours, open Supabase **Table Editor** → `product_variants` → **Insert row** and use the product's ID, size, colour, price, stock and SKU.

## 8. Test checkout and stock
1. On the storefront, add a product, select size and colour, and open the bag.
2. Continue to checkout, sign in, enter delivery details, and select Cash on delivery.
3. Place the order.
4. The order is saved in `orders` and `order_items`, and stock decreases. Check order history in the storefront and the admin page.
5. Use admin to change order status to confirmed, processing, shipped or delivered.

## Honest launch limitations
- Cash on delivery order creation works after setup. **Online card/EasyPaisa/JazzCash payments are not integrated**; a payment gateway and server-side payment verification are required.
- The manual transfer option only marks an order as awaiting verification. Check the money yourself before dispatch.
- Shipping fee is currently zero. Configure delivery charges before selling.
- Email/SMS notifications and automatic cancellation/restocking are not configured.
- Add real return/refund policy, privacy policy, terms, contact information and business details before launch.
- This is a practical starter, not an audited production platform. Test with sample products/orders before real sales.

## Troubleshooting
- **Products don't show:** check `supabase-config.js`, confirm the SQL ran, and ensure a published product has at least one variant.
- **Sign-up error:** check Supabase Authentication settings and email confirmation.
- **Admin access denied:** confirm you promoted the correct user UUID in `profiles`, then sign out and sign in again.
- **Checkout error:** verify the user is signed in, the item is published, stock is available, and delivery details are complete.
- **GitHub deployment failure:** GitHub Pages should use Deploy from a branch, `main`, `/(root)`; upload the files at repository root, not inside an extra folder.

## Brand name
The files currently use **CAELIS**. If you want the final brand to be **KALIS**, use Find/Replace in `index.html`, `admin.html`, and `app.js` to replace visible `CAELIS` text with `KALIS`. Keep database/table names unchanged.
