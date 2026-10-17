"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const configured = window.supabase && window.CAELIS_SUPABASE_URL && window.CAELIS_SUPABASE_ANON_KEY && !String(window.CAELIS_SUPABASE_URL).includes("PASTE_") && !String(window.CAELIS_SUPABASE_ANON_KEY).includes("PASTE_");
  const db = configured ? window.supabase.createClient(window.CAELIS_SUPABASE_URL, window.CAELIS_SUPABASE_ANON_KEY) : null;
  const say = (id, message) => { $(id).textContent = message; };
  const money = n => new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(n)||0);
  const escape = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function start() {
    if (!db) { say("adminStatus","Supabase is not configured. Create supabase-config.js using the example file."); $("adminLoginPanel").hidden=false; $("adminWorkspace").hidden=true; return; }
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) { say("adminStatus","Sign in with the account assigned the protected admin role."); $("adminLoginPanel").hidden=false; $("adminWorkspace").hidden=true; return; }
    const role = data.user.app_metadata?.role;
    if (role !== "admin") { say("adminStatus","Access denied. This account does not have app_metadata.role = admin. Assign it through trusted Supabase admin controls."); $("adminLoginPanel").hidden=true; $("adminWorkspace").hidden=true; return; }
    say("adminStatus","Authenticated as store administrator."); $("adminLoginPanel").hidden=true; $("adminWorkspace").hidden=false;
    await Promise.all([loadProducts(),loadOrders()]);
  }
  $("adminLogin").addEventListener("submit", async e => { e.preventDefault(); if(!db)return; say("loginMessage","Signing in…"); const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value}); say("loginMessage",error?error.message:"Signed in."); await start(); });
  $("signOutButton").addEventListener("click", async () => { if(db) await db.auth.signOut(); $("adminWorkspace").hidden=true; $("adminLoginPanel").hidden=false; say("adminStatus","Signed out."); });
  $("productForm").addEventListener("submit", async e => {
    e.preventDefault(); if(!db)return;
    const name=$("pName").value.trim(), category=$("pCategory").value.trim().toLowerCase().replace(/\s+/g,"-"), description=$("pDescription").value.trim(), image=$("pImage").value.trim(), price=Number($("vPrice").value), size=$("vSize").value.trim(), color=$("vColor").value.trim(), stock=Number($("vStock").value), sku=$("vSku").value.trim() || ("CA-"+crypto.randomUUID().slice(0,8).toUpperCase());
    if(!name || !size || !color || !Number.isFinite(price) || price<1 || !Number.isInteger(stock) || stock<0){say("productMessage","Check the product name, price, size, colour and stock.");return;}
    $("saveProductButton").disabled=true; say("productMessage","Saving product…");
    const slug=name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+crypto.randomUUID().slice(0,6);
    const {data:product,error:pe}=await db.from("products").insert({slug,name,description,category,price_pkr:price,image_url:image||null,active:$("pPublished").value==="true"}).select().single();
    if(pe){say("productMessage","Product not saved: "+pe.message);$("saveProductButton").disabled=false;return;}
    const {error:ve}=await db.from("product_variants").insert({product_id:product.id,size,color,sku,stock});
    $("saveProductButton").disabled=false;
    if(ve){say("productMessage","Product was created, but its size/colour stock failed: "+ve.message+" Check the schema.");return;}
    say("productMessage","Saved. Your product is in the catalogue."); $("productForm").reset(); await loadProducts();
  });
  async function loadProducts() {
    const box=$("adminProducts"); box.textContent="Loading…";
    const {data,error}=await db.from("products").select("id,name,category,price_pkr,active,product_variants(id,size,color,sku,stock)").order("created_at",{ascending:false});
    if(error){box.textContent="Could not load products: "+error.message;return;} box.replaceChildren();
    if(!data?.length){box.textContent="No products yet. Add your first real CAELIS product above.";return;}
    data.forEach(p=>{const card=document.createElement("article");card.className="admin-list-item";const variants=(p.product_variants||[]).map(v=>"<div class='stock-edit'><label>"+escape(v.size)+" / "+escape(v.color)+" · "+escape(v.sku)+"<input type='number' min='0' step='1' value='"+Number(v.stock)+"' data-stock-value='"+v.id+"' aria-label='Stock for "+escape(v.size)+" "+escape(v.color)+"'></label><button type='button' data-stock-save='"+v.id+"'>Save stock</button></div>").join("");card.innerHTML="<div><strong>"+escape(p.name)+"</strong><p>"+escape(p.category)+" · "+money(p.price_pkr)+" · "+(p.active?"Published":"Draft")+"</p><div class='stock-edit-list'>"+(variants||"<p>No variants yet.</p>")+"</div></div><div class='admin-item-actions'><button type='button' data-add-variant='"+p.id+"'>Add size / colour</button><button type='button' data-publish='"+p.id+"' data-active='"+(!p.active)+"'>"+(p.active?"Unpublish":"Publish")+"</button><button type='button' data-delete='"+p.id+"'>Delete</button></div>";box.appendChild(card);});
    box.querySelectorAll("[data-stock-save]").forEach(b=>b.addEventListener("click",async()=>{const input=box.querySelector("[data-stock-value='"+b.dataset.stockSave+"']");const stock=Number(input.value);if(!Number.isInteger(stock)||stock<0){say("adminStatus","Stock must be a whole number of zero or more.");return;}b.disabled=true;const {error}=await db.from("product_variants").update({stock}).eq("id",b.dataset.stockSave);b.disabled=false;if(error)say("adminStatus","Stock was not saved: "+error.message);else say("adminStatus","Stock updated.");}));
    box.querySelectorAll("[data-add-variant]").forEach(b=>b.addEventListener("click",async()=>{const size=prompt("Size (for example S, M, L, XL):");if(!size||!size.trim())return;const color=prompt("Colour (for example Black):");if(!color||!color.trim())return;const stockText=prompt("Opening stock (whole number):","0");if(stockText===null)return;const stock=Number(stockText);if(!Number.isInteger(stock)||stock<0){say("adminStatus","Stock must be a whole number of zero or more.");return;}const sku=prompt("Unique SKU:",("CA-"+crypto.randomUUID().slice(0,8).toUpperCase()));if(!sku||!sku.trim())return;const {error}=await db.from("product_variants").insert({product_id:b.dataset.addVariant,size:size.trim(),color:color.trim(),sku:sku.trim(),stock});if(error)say("adminStatus","Variant was not saved: "+error.message);else {say("adminStatus","Size/colour variant added.");await loadProducts();}}));
    box.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await db.from("products").update({active:b.dataset.active==="true"}).eq("id",b.dataset.publish);if(error)say("adminStatus",error.message);else await loadProducts();}));
    box.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this product and its variants?"))return;const {error}=await db.from("products").delete().eq("id",b.dataset.delete);if(error)say("adminStatus",error.message);else await loadProducts();}));
  }
  async function loadOrders() {
    const box=$("adminOrders"); box.textContent="Loading…";
    const {data,error}=await db.from("orders").select("id,order_number,customer_name,customer_phone,city,status,total_pkr,created_at").order("created_at",{ascending:false}).limit(50);
    if(error){box.textContent="Could not load orders: "+error.message;return;} box.replaceChildren();
    if(!data?.length){box.textContent="No orders yet.";return;}
    data.forEach(o=>{const row=document.createElement("article");row.className="admin-list-item";row.innerHTML="<div><strong>"+escape(o.order_number)+" · "+escape(o.customer_name)+"</strong><p>"+escape(o.customer_phone)+" · "+escape(o.city)+" · "+money(o.total_pkr)+"</p><p>Status: "+escape(o.status)+"</p></div><div class='admin-item-actions'><select aria-label='Order status' data-order-status='"+o.id+"'>"+["pending","confirmed","processing","shipped","delivered","cancelled"].map(s=>"<option "+(s===o.status?"selected":"")+" value='"+s+"'>"+s+"</option>").join("")+"</select><button type='button' data-save-order='"+o.id+"'>Update</button></div>";box.appendChild(row);});
    box.querySelectorAll("[data-save-order]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.saveOrder, value=box.querySelector("[data-order-status='"+id+"']").value;const {error}=await db.from("orders").update({status:value}).eq("id",id);if(error)say("adminStatus",error.message);else {say("adminStatus","Order status updated.");await loadOrders();}}));
  }
  $("refreshProducts").addEventListener("click",loadProducts); $("refreshOrders").addEventListener("click",loadOrders);
  start();
});
