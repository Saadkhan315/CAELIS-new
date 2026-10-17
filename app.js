"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const configReady = window.supabase && window.CAELIS_SUPABASE_URL && window.CAELIS_SUPABASE_ANON_KEY &&
    !String(window.CAELIS_SUPABASE_URL).includes("PASTE_") && !String(window.CAELIS_SUPABASE_ANON_KEY).includes("PASTE_");
  const db = configReady ? window.supabase.createClient(window.CAELIS_SUPABASE_URL, window.CAELIS_SUPABASE_ANON_KEY) : null;
  const state = { products: [], variants: [], cart: readCart(), user: null, signup: false, category: "all", search: "", sort: "featured" };
  const money = n => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const dateTime = v => v ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "Date unavailable";
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function readCart() { try { const value = JSON.parse(localStorage.getItem("caelis-cart") || "[]"); return Array.isArray(value) ? value.filter(i => i && typeof i.variant_id === "string" && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity < 100) : []; } catch { return []; } }
  function saveCart() { try { localStorage.setItem("caelis-cart", JSON.stringify(state.cart)); } catch { toast("Your browser could not save the bag."); } }
  let toastTimer;
  function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200); }
  function status(message) { $("storeStatus").textContent = message; }
  function showModal(id) { $(id).hidden = false; document.body.classList.add("modal-open"); }
  function hideModal(id) { $(id).hidden = true; if (!document.querySelector(".modal-backdrop:not([hidden])")) document.body.classList.remove("modal-open"); }
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => hideModal(b.dataset.close)));
  document.querySelectorAll(".modal-backdrop").forEach(m => m.addEventListener("click", e => { if (e.target === m) hideModal(m.id); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(m => hideModal(m.id)); });
  const nav = $("navigation"), menu = $("menuToggle");
  menu.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); menu.textContent = open ? "×" : "☰"; });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.textContent = "☰"; }));
  $("accountOpen").addEventListener("click", async () => { showModal("accountModal"); await refreshAuth(); });
  $("footerAccount").addEventListener("click", async () => { showModal("accountModal"); await refreshAuth(); });
  $("cartOpen").addEventListener("click", () => { renderCart(); showModal("cartModal"); });
  $("footerBag").addEventListener("click", () => { renderCart(); showModal("cartModal"); });
  $("authSwitch").addEventListener("click", () => { state.signup = !state.signup; $("accountTitle").textContent = state.signup ? "Create your account." : "Welcome back."; $("authSubmit").textContent = state.signup ? "Create account" : "Sign in"; $("authSwitch").textContent = state.signup ? "Already registered? Sign in" : "Need an account? Create one"; $("authPassword").autocomplete = state.signup ? "new-password" : "current-password"; });
  async function refreshAuth() {
    if (!db) { $("accountState").textContent = "Account, saved order history and checkout become available after Supabase is connected."; $("authMessage").textContent = "Store setup is required. Follow SETUP-GUIDE.md in the project repository."; return; }
    const { data } = await db.auth.getUser(); state.user = data?.user || null;
    $("accountState").textContent = state.user ? "Signed in as " + state.user.email : "Sign in or create an account to continue.";
    $("signOutButton").hidden = !state.user; $("authForm").hidden = !!state.user; $("authSwitch").hidden = !!state.user;
    if (state.user) await loadOrderHistory();
  }
  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!db) { $("authMessage").textContent = "Connect Supabase first; see SETUP-GUIDE.md."; return; }
    const email = $("authEmail").value.trim(), password = $("authPassword").value;
    $("authSubmit").disabled = true; $("authMessage").textContent = "Please wait…";
    const result = state.signup ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
    $("authSubmit").disabled = false;
    if (result.error) { $("authMessage").textContent = result.error.message; return; }
    $("authMessage").textContent = state.signup ? "Account request sent. Check your email if confirmation is enabled." : "You are signed in.";
    state.signup = false; $("authForm").reset(); await refreshAuth();
  });
  $("signOutButton").addEventListener("click", async () => { if (db) { const { error } = await db.auth.signOut(); $("authMessage").textContent = error ? error.message : "Signed out."; await refreshAuth(); } });
  async function loadOrderHistory() {
    const box = $("orderHistory"); box.replaceChildren();
    if (!db || !state.user) return;
    const { data, error } = await db.from("orders").select("id,order_number,status,payment_method,payment_status,total_pkr,created_at,customer_name,customer_phone,shipping_address,city,postal_code,country").eq("user_id", state.user.id).order("created_at", { ascending: false }).limit(25);
    if (error) { box.textContent = "Order history could not load. Please try again."; return; }
    const title = document.createElement("h3"); title.textContent = "Your order history"; box.appendChild(title);
    if (!data?.length) { const p = document.createElement("p"); p.textContent = "No orders yet. Your confirmed purchases will appear here."; box.appendChild(p); return; }
    data.forEach(o => {
      const card = document.createElement("article"); card.className = "history-card";
      card.innerHTML = "<div class='history-head'><strong>" + safe(o.order_number) + "</strong><span class='history-status'>" + safe(o.status) + "</span></div><p>Placed: " + safe(dateTime(o.created_at)) + "</p><p>Total: <strong>" + safe(money(o.total_pkr)) + "</strong> · Payment: " + safe(o.payment_method === "cod" ? "Cash on delivery" : o.payment_method) + " (" + safe(o.payment_status) + ")</p><p>Delivery: " + safe(o.customer_name) + " · " + safe(o.customer_phone) + "</p><p>" + safe(o.shipping_address) + ", " + safe(o.city) + (o.postal_code ? " " + safe(o.postal_code) : "") + ", " + safe(o.country) + "</p><button type='button' class='history-detail-button' data-history-items='" + safe(o.id) + "'>View items</button><div class='history-items' hidden></div>";
      box.appendChild(card);
    });
    box.querySelectorAll("[data-history-items]").forEach(button => button.addEventListener("click", async () => {
      const target = button.nextElementSibling;
      if (!target.hidden) { target.hidden = true; button.textContent = "View items"; return; }
      button.disabled = true; target.textContent = "Loading order items…"; target.hidden = false;
      const { data: items, error: itemError } = await db.from("order_items").select("product_name,sku,size,color,unit_price_pkr,quantity,line_total_pkr").eq("order_id", button.dataset.historyItems);
      button.disabled = false;
      if (itemError) { target.textContent = "Order items could not be loaded."; return; }
      target.innerHTML = (items || []).map(i => "<p>" + safe(i.product_name) + " · " + safe(i.color) + " / " + safe(i.size) + " × " + Number(i.quantity) + " — " + safe(money(i.line_total_pkr)) + "</p>").join("") || "No line items found.";
      button.textContent = "Hide items";
    }));
  }
  function visibleProducts() {
    let list = state.products.filter(p => (state.category === "all" || p.category.toLowerCase().replace(/\s+/g, "-") === state.category) && (p.name + " " + p.description + " " + p.category).toLowerCase().includes(state.search.toLowerCase()));
    if (state.sort === "price-low") list.sort((a,b) => Number(a.price_pkr)-Number(b.price_pkr));
    if (state.sort === "price-high") list.sort((a,b) => Number(b.price_pkr)-Number(a.price_pkr));
    if (state.sort === "name") list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  }
  function renderProducts() {
    const grid = $("productGrid"); grid.replaceChildren(); const list = visibleProducts();
    if (!list.length) { status(configReady ? "No published CAELIS products yet. This store intentionally contains no demo products. Add your real items through Store Admin." : "Store setup required: connect Supabase and publish your own products. No demo products are shown."); return; }
    status(list.length + (list.length === 1 ? " official CAELIS piece" : " official CAELIS pieces"));
    list.forEach((p, index) => {
      const variants = state.variants.filter(v => v.product_id === p.id);
      const card = document.createElement("article"); card.className = "product-card"; card.style.animationDelay = Math.min(index * 50, 250) + "ms";
      const image = p.image_url ? "<img src='" + safe(p.image_url) + "' alt='" + safe(p.name) + "' loading='lazy'>" : "<div class='product-placeholder'>CAELIS</div>";
      const sizes = [...new Set(variants.map(v => v.size))], colors = [...new Set(variants.map(v => v.color))];
      card.innerHTML = "<div class='product-image-wrap'>" + image + "</div><div class='product-card-info'><p class='product-category'>" + safe(p.category) + "</p><h3>" + safe(p.name) + "</h3><p class='product-description'>" + safe(p.description) + "</p><div class='product-price'>" + money(p.price_pkr) + "</div><label>Size<select class='variant-size' aria-label='Size for " + safe(p.name) + "'>" + sizes.map(v => "<option value='" + safe(v) + "'>" + safe(v) + "</option>").join("") + "</select></label><label>Colour<select class='variant-color' aria-label='Colour for " + safe(p.name) + "'>" + colors.map(v => "<option value='" + safe(v) + "'>" + safe(v) + "</option>").join("") + "</select></label><p class='stock-note'></p><button class='add-to-bag' type='button'>ADD TO BAG +</button></div>";
      const sizeEl = card.querySelector(".variant-size"), colorEl = card.querySelector(".variant-color"), stockNote = card.querySelector(".stock-note"), add = card.querySelector(".add-to-bag");
      function selectedVariant() { return variants.find(v => v.size === sizeEl.value && v.color === colorEl.value); }
      function updateStock() { const v = selectedVariant(); stockNote.textContent = v && v.stock > 0 ? "Available · " + v.stock + " in stock" : "Currently unavailable"; add.disabled = !v || v.stock < 1; }
      sizeEl.addEventListener("change", updateStock); colorEl.addEventListener("change", updateStock);
      add.addEventListener("click", () => { const v = selectedVariant(); if (!v) return; const item = state.cart.find(i => i.variant_id === v.id); if (item) item.quantity = Math.min(20, item.quantity + 1); else state.cart.push({ variant_id: v.id, quantity: 1 }); saveCart(); renderCart(); toast(p.name + " added to your bag."); });
      updateStock(); grid.appendChild(card);
    });
  }
  function cartLines() { return state.cart.map(item => { const variant = state.variants.find(v => v.id === item.variant_id); const product = variant && state.products.find(p => p.id === variant.product_id); return variant && product ? { ...item, variant, product } : null; }).filter(Boolean); }
  function renderCart() {
    const lines = cartLines(), box = $("cartItems"); box.replaceChildren();
    $("cartCount").textContent = String(lines.reduce((n,x) => n + x.quantity, 0));
    let subtotal = 0;
    if (!lines.length) box.textContent = state.cart.length ? "Your saved bag needs a catalogue refresh. Reload the store after products are available." : "Your bag is waiting for its first CAELIS piece.";
    lines.forEach(line => {
      subtotal += Number(line.product.price_pkr) * line.quantity;
      const row = document.createElement("div"); row.className = "cart-line";
      row.innerHTML = "<div><strong>" + safe(line.product.name) + "</strong><p>" + safe(line.variant.color) + " · Size " + safe(line.variant.size) + "</p><p>" + money(line.product.price_pkr) + " × " + line.quantity + "</p></div><div class='cart-line-actions'><button type='button' data-minus='" + safe(line.variant_id) + "' aria-label='Decrease quantity'>−</button><button type='button' data-plus='" + safe(line.variant_id) + "' aria-label='Increase quantity'>+</button><button type='button' data-remove='" + safe(line.variant_id) + "'>Remove</button></div>";
      box.appendChild(row);
    });
    $("cartSubtotal").textContent = money(subtotal);
    box.querySelectorAll("[data-minus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.minus, -1)));
    box.querySelectorAll("[data-plus]").forEach(b => b.addEventListener("click", () => changeQty(b.dataset.plus, 1)));
    box.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => { state.cart = state.cart.filter(i => i.variant_id !== b.dataset.remove); saveCart(); renderCart(); }));
    $("placeOrderButton").disabled = !lines.length || !db;
  }
  function changeQty(id, delta) { const item = state.cart.find(i => i.variant_id === id); if (!item) return; item.quantity += delta; if (item.quantity <= 0) state.cart = state.cart.filter(i => i.variant_id !== id); if (item.quantity > 20) item.quantity = 20; saveCart(); renderCart(); }
  $("checkoutForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!db) { $("checkoutMessage").textContent = "Orders are not active yet. Configure Supabase and run supabase-schema.sql first."; return; }
    const { data: userData } = await db.auth.getUser();
    if (!userData?.user) { hideModal("cartModal"); showModal("accountModal"); $("authMessage").textContent = "Please sign in or create an account before placing an order."; return; }
    const lines = cartLines(); if (!lines.length) { $("checkoutMessage").textContent = "Your bag is empty. Add an available item first."; return; }
    const items = lines.map(x => ({ variant_id: x.variant_id, quantity: x.quantity }));
    const payload = { p_items: items, p_customer_name: $("checkoutName").value.trim(), p_customer_email: $("checkoutEmail").value.trim(), p_customer_phone: $("checkoutPhone").value.trim(), p_shipping_address: $("checkoutAddress").value.trim(), p_city: $("checkoutCity").value.trim(), p_postal_code: $("checkoutPostal").value.trim(), p_country: $("checkoutCountry").value, p_payment_method: "cod" };
    $("placeOrderButton").disabled = true; $("checkoutMessage").textContent = "Submitting your order securely…";
    try {
      const { data, error } = await db.rpc("place_order", payload);
      if (error) { $("checkoutMessage").textContent = "Order not placed: " + error.message; return; }
      state.cart = []; saveCart(); renderCart();
      $("checkoutMessage").textContent = "Order confirmed: " + data.order_number + ". Total: " + money(data.total_pkr) + ". View your date, status and items in Account → Order history.";
      toast("Your CAELIS order was placed."); await loadOrderHistory(); await loadCatalogue();
    } catch { $("checkoutMessage").textContent = "We could not confirm the order. Please retry after checking your connection."; }
    finally { $("placeOrderButton").disabled = !cartLines().length || !db; }
  });
  $("productSearch").addEventListener("input", e => { state.search = e.target.value.trim(); renderProducts(); });
  $("categoryFilter").addEventListener("change", e => { state.category = e.target.value; renderProducts(); });
  $("sortProducts").addEventListener("change", e => { state.sort = e.target.value; renderProducts(); });
  document.querySelectorAll("[data-collection]").forEach(a => a.addEventListener("click", () => { state.category = a.dataset.collection; $("categoryFilter").value = state.category; renderProducts(); }));
  $("newsletterForm").addEventListener("submit", e => { e.preventDefault(); $("newsletterMessage").textContent = "Newsletter service is not connected yet. Your email has not been saved."; });
  $("currentYear").textContent = String(new Date().getFullYear());
  async function loadCatalogue() {
    if (!db) { status("Store setup required: add the Supabase project URL and public key to supabase-config.js. No demo products are shown."); renderProducts(); renderCart(); return; }
    status("Loading the CAELIS catalogue…");
    const { data: products, error: productError } = await db.from("products").select("id,name,description,category,price_pkr,image_url").eq("active", true).order("created_at", { ascending: false });
    if (productError) { status("Catalogue connection failed. Check that supabase-schema.sql was run in your Supabase project."); console.error(productError); return; }
    state.products = products || [];
    const ids = state.products.map(p => p.id);
    if (!ids.length) { state.variants = []; renderProducts(); renderCart(); return; }
    const { data: variants, error: variantError } = await db.from("product_variants").select("id,product_id,size,color,sku,stock").in("product_id", ids);
    if (variantError) { status("Products loaded, but size and colour options could not load. Check the database schema."); console.error(variantError); return; }
    state.variants = variants || []; renderProducts(); renderCart();
  }
  if (db) db.auth.onAuthStateChange(() => { setTimeout(() => { refreshAuth(); }, 0); });
  refreshAuth(); loadCatalogue();
});