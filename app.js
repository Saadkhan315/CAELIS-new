"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);
  const configReady = window.supabase && window.CAELIS_SUPABASE_URL && window.CAELIS_SUPABASE_ANON_KEY &&
    !String(window.CAELIS_SUPABASE_URL).includes("PASTE_") && !String(window.CAELIS_SUPABASE_ANON_KEY).includes("PASTE_");
  const db = configReady ? window.supabase.createClient(window.CAELIS_SUPABASE_URL, window.CAELIS_SUPABASE_ANON_KEY) : null;
  const state = { products: [], variants: [], cart: loadCart(), user: null, signup: false, category: "all", search: "", sort: "featured" };
  const money = (n) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  function loadCart() { try { const x = JSON.parse(localStorage.getItem("caelis-cart") || "[]"); return Array.isArray(x) ? x.filter(i => i && typeof i.variant_id === "string" && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity < 100) : []; } catch { return []; } }
  function saveCart() { try { localStorage.setItem("caelis-cart", JSON.stringify(state.cart)); } catch { toast("Your browser could not save the bag."); } }
  function safe(text) { return String(text ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  let toastTimer;
  function toast(message) { const el = byId("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3500); }
  function status(message) { byId("storeStatus").textContent = message; }
  function showModal(id) { byId(id).hidden = false; document.body.classList.add("modal-open"); }
  function hideModal(id) { byId(id).hidden = true; if (document.querySelectorAll(".modal-backdrop:not([hidden])").length === 0) document.body.classList.remove("modal-open"); }
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => hideModal(b.dataset.close)));
  document.querySelectorAll(".modal-backdrop").forEach(m => m.addEventListener("click", e => { if (e.target === m) hideModal(m.id); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(m => hideModal(m.id)); });
  const nav = byId("navigation"), menu = byId("menuToggle");
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); menu.textContent = open ? "×" : "☰"; });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded","false"); menu.textContent="☰"; }));
  byId("accountOpen").addEventListener("click", async () => { showModal("accountModal"); await refreshAuth(); });
  byId("cartOpen").addEventListener("click", () => { renderCart(); showModal("cartModal"); });
  byId("authSwitch").addEventListener("click", () => { state.signup = !state.signup; byId("authTitle").textContent = state.signup ? "Create your account." : "Welcome back."; byId("authSubmit").textContent = state.signup ? "Create account" : "Sign in"; byId("authSwitch").textContent = state.signup ? "Already registered? Sign in" : "Need an account? Create one"; byId("authPassword").autocomplete = state.signup ? "new-password" : "current-password"; });
  async function refreshAuth() {
    if (!db) { byId("accountState").textContent = "Supabase is not configured yet. Add your Project URL and public key to supabase-config.js."; return; }
    const { data, error } = await db.auth.getUser();
    state.user = data?.user || null;
    byId("accountState").textContent = state.user ? "Signed in as " + state.user.email : "Sign in or create an account to continue.";
    byId("signOutButton").hidden = !state.user;
    byId("authForm").hidden = !!state.user;
    byId("authSwitch").hidden = !!state.user;
    if (state.user) loadOrderHistory();
  }
  byId("authForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!db) { byId("authMessage").textContent = "Add Supabase settings first; see SETUP-GUIDE.md."; return; }
    const email = byId("authEmail").value.trim(), password = byId("authPassword").value;
    byId("authSubmit").disabled = true; byId("authMessage").textContent = "Please wait…";
    const result = state.signup ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
    byId("authSubmit").disabled = false;
    if (result.error) { byId("authMessage").textContent = result.error.message; return; }
    byId("authMessage").textContent = state.signup ? "Account request sent. Check your email if confirmation is enabled, then sign in." : "You are signed in.";
    state.signup = false; byId("authForm").reset(); await refreshAuth();
  });
  byId("signOutButton").addEventListener("click", async () => { if (db) { const { error } = await db.auth.signOut(); byId("authMessage").textContent = error ? error.message : "Signed out."; await refreshAuth(); } });
  async function loadOrderHistory() {
    const box = byId("orderHistory"); box.replaceChildren();
    if (!db || !state.user) return;
    const { data, error } = await db.from("orders").select("order_number,status,total_pkr,created_at").eq("user_id", state.user.id).order("created_at", { ascending: false }).limit(10);
    if (error) { box.textContent = ""; return; }
    if (!data?.length) { box.textContent = "No orders yet."; return; }
    const title = document.createElement("h3"); title.textContent = "Your recent orders"; box.appendChild(title);
    data.forEach(o => { const p = document.createElement("p"); p.textContent = o.order_number + " · " + o.status + " · " + money(o.total_pkr); box.appendChild(p); });
  }
  function getVisibleProducts() {
    let list = state.products.filter(p => (state.category === "all" || p.category.toLowerCase().replace(/\s+/g,"-") === state.category) && (p.name + " " + p.description + " " + p.category).toLowerCase().includes(state.search.toLowerCase()));
    if (state.sort === "price-low") list.sort((a,b) => Number(a.price_pkr)-Number(b.price_pkr));
    if (state.sort === "price-high") list.sort((a,b) => Number(b.price_pkr)-Number(a.price_pkr));
    if (state.sort === "name") list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  }
  function renderProducts() {
    const grid = byId("productGrid"); grid.replaceChildren();
    const list = getVisibleProducts();
    if (!list.length) { status(configReady ? "No published CAELIS products match this view yet. Add your real products from Store Admin." : "Catalogue setup needed: configure Supabase to load your own products. No demo products are shown."); return; }
    status(list.length + (list.length === 1 ? " piece" : " pieces") + " in the CAELIS collection.");
    list.forEach((p, index) => {
      const variants = state.variants.filter(v => v.product_id === p.id);
      const card = document.createElement("article"); card.className = "product-card"; card.style.animationDelay = Math.min(index * 60, 300) + "ms";
      const image = p.image_url ? '<img src="' + safe(p.image_url) + '" alt="' + safe(p.name) + '" loading="lazy">' : '<div class="product-placeholder">CAELIS</div>';
      const sizes = [...new Set(variants.map(v => v.size))], colors = [...new Set(variants.map(v => v.color))];
      card.innerHTML = '<div class="product-image-wrap">' + image + '</div><div class="product-card-info"><p class="product-category">' + safe(p.category) + '</p><h3>' + safe(p.name) + '</h3><p class="product-description">' + safe(p.description) + '</p><div class="product-price">' + money(p.price_pkr) + '</div><label>Size<select class="variant-size" aria-label="Size for ' + safe(p.name) + '">' + sizes.map(x => '<option value="' + safe(x) + '">' + safe(x) + '</option>').join("") + '</select></label><label>Colour<select class="variant-color" aria-label="Colour for ' + safe(p.name) + '">' + colors.map(x => '<option value="' + safe(x) + '">' + safe(x) + '</option>').join("") + '</select></label><p class="stock-note"></p><button class="add-to-bag" type="button">ADD TO BAG +</button></div>';
      const sizeEl = card.querySelector(".variant-size"), colorEl = card.querySelector(".variant-color"), stockNote = card.querySelector(".stock-note"), add = card.querySelector(".add-to-bag");
      function selectedVariant() { return variants.find(v => v.size === sizeEl.value && v.color === colorEl.value); }
      function updateStock() { const v = selectedVariant(); stockNote.textContent = v && v.stock > 0 ? "Available · " + v.stock + " in stock" : "Currently unavailable"; add.disabled = !v || v.stock < 1; }
      sizeEl.addEventListener("change", updateStock); colorEl.addEventListener("change", updateStock);
      add.addEventListener("click", () => { const v = selectedVariant(); if (!v) return; const existing = state.cart.find(i => i.variant_id === v.id); if (existing) existing.quantity += 1; else state.cart.push({ variant_id: v.id, quantity: 1 }); saveCart(); renderCart(); toast(p.name + " added to your bag."); });
      updateStock(); grid.appendChild(card);
    });
  }
  function cartLines() { return state.cart.map(item => { const v = state.variants.find(x => x.id === item.variant_id); const p = v && state.products.find(x => x.id === v.product_id); return v && p ? { ...item, variant: v, product: p } : null; }).filter(Boolean); }
  function renderCart() {
    const lines = cartLines(); const box = byId("cartItems"); box.replaceChildren();
    const count = lines.reduce((n,x) => n + x.quantity,0); byId("cartCount").textContent = String(count);
    let subtotal = 0;
    if (!lines.length) { box.textContent = "Your bag is waiting for its first CAELIS piece."; }
    lines.forEach(line => {
      subtotal += Number(line.product.price_pkr) * line.quantity;
      const row = document.createElement("div"); row.className = "cart-line";
      row.innerHTML = '<div><strong>' + safe(line.product.name) + '</strong><p>' + safe(line.variant.color) + ' · Size ' + safe(line.variant.size) + '</p><p>' + money(line.product.price_pkr) + ' × ' + line.quantity + '</p></div><div class="cart-line-actions"><button type="button" data-minus="' + safe(line.variant_id) + '">−</button><button type="button" data-plus="' + safe(line.variant_id) + '">+</button><button type="button" data-remove="' + safe(line.variant_id) + '">Remove</button></div>';
      box.appendChild(row);
    });
    byId("cartSubtotal").textContent = money(subtotal);
    box.querySelectorAll("[data-minus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.minus,-1)));
    box.querySelectorAll("[data-plus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.plus,1)));
    box.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => { state.cart = state.cart.filter(x => x.variant_id !== b.dataset.remove); saveCart(); renderCart(); }));
    byId("placeOrderButton").disabled = !lines.length || !db;
  }
  function changeQty(id, delta) { const item = state.cart.find(x => x.variant_id === id); if (!item) return; item.quantity += delta; if (item.quantity <= 0) state.cart = state.cart.filter(x => x.variant_id !== id); if (item.quantity > 99) item.quantity = 99; saveCart(); renderCart(); }
  byId("checkoutForm").addEventListener("submit", async e => {
    e.preventDefault(); if (!db) { byId("checkoutMessage").textContent = "Connect Supabase before placing orders."; return; }
    const { data: userData } = await db.auth.getUser();
    if (!userData?.user) { hideModal("cartModal"); showModal("accountModal"); byId("authMessage").textContent = "Please sign in or create an account before placing an order."; return; }
    const items = cartLines().map(x => ({ variant_id: x.variant_id, quantity: x.quantity }));
    const payload = { p_items: items, p_customer_name: byId("checkoutName").value.trim(), p_customer_email: byId("checkoutEmail").value.trim(), p_customer_phone: byId("checkoutPhone").value.trim(), p_shipping_address: byId("checkoutAddress").value.trim(), p_city: byId("checkoutCity").value.trim(), p_postal_code: byId("checkoutPostal").value.trim(), p_country: byId("checkoutCountry").value, p_payment_method: "cod" };
    byId("placeOrderButton").disabled = true; byId("checkoutMessage").textContent = "Submitting your order securely…";
    const { data, error } = await db.rpc("place_order", payload);
    byId("placeOrderButton").disabled = false;
    if (error) { byId("checkoutMessage").textContent = "Order not placed: " + error.message + ". Ensure the SQL setup has been completed."; return; }
    state.cart = []; saveCart(); renderCart(); byId("checkoutMessage").textContent = "Order placed: " + data.order_number + ". Keep this number for tracking."; toast("Your CAELIS order was placed."); loadOrderHistory();
  });
  byId("productSearch").addEventListener("input", e => { state.search = e.target.value.trim(); renderProducts(); });
  byId("categoryFilter").addEventListener("change", e => { state.category = e.target.value; renderProducts(); });
  byId("sortProducts").addEventListener("change", e => { state.sort = e.target.value; renderProducts(); });
  document.querySelectorAll("[data-collection]").forEach(a => a.addEventListener("click", () => { state.category = a.dataset.collection; byId("categoryFilter").value = state.category; renderProducts(); }));
  byId("newsletterForm").addEventListener("submit", e => { e.preventDefault(); byId("newsletterMessage").textContent = "Newsletter service is not connected yet. Your email has not been saved."; });
  byId("currentYear").textContent = String(new Date().getFullYear());
  async function loadCatalogue() {
    if (!db) { status("Supabase is not configured. Add your project URL and public key in supabase-config.js. No demo products are shown."); renderProducts(); return; }
    status("Loading the CAELIS catalogue…");
    const { data: products, error: productError } = await db.from("products").select("id,name,description,category,price_pkr,image_url").eq("active",true).order("created_at",{ascending:false});
    if (productError) { status("Could not load products. Check the Supabase setup and Row Level Security."); console.error(productError); return; }
    state.products = products || [];
    const { data: variants, error: variantError } = await db.from("product_variants").select("id,product_id,size,color,sku,stock").in("product_id",state.products.map(p => p.id).length ? state.products.map(p => p.id) : ["00000000-0000-0000-0000-000000000000"]);
    if (variantError) { status("Products loaded, but sizes/colours could not load. Check the database schema."); console.error(variantError); return; }
    state.variants = variants || []; renderProducts(); renderCart();
  }
  if (db) db.auth.onAuthStateChange(() => { setTimeout(refreshAuth, 0); });
  refreshAuth(); loadCatalogue();
});
