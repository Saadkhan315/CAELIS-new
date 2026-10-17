(() => {
"use strict";
const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(v||0));
const ready=window.supabase&&window.CAELIS_SUPABASE_URL&&!window.CAELIS_SUPABASE_URL.includes("PASTE_")&&window.CAELIS_SUPABASE_ANON_KEY&&!window.CAELIS_SUPABASE_ANON_KEY.includes("PASTE_");
const db=ready?window.supabase.createClient(window.CAELIS_SUPABASE_URL,window.CAELIS_SUPABASE_ANON_KEY):null;let user=null;
const msg=(s,t,err=false)=>{$(s).textContent=t;$(s).style.color=err?"#9a3c2f":"#6d603f"};
async function check(){
 if(!db){$("#adminStatus").textContent="Supabase is not configured. Follow SETUP-GUIDE.md.";return}
 const {data:{session}}=await db.auth.getSession();user=session?.user||null;
 if(!user){$("#adminLoginPanel").hidden=false;$("#adminWorkspace").hidden=true;$("#adminStatus").textContent="Sign in to verify administrator access.";return}
 const {data:profile,error}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(error||profile?.role!=="admin"){$("#adminLoginPanel").hidden=true;$("#adminWorkspace").hidden=true;$("#adminStatus").textContent=`${user.email} is signed in, but is not an admin. Promote your account using the setup guide.`;return}
 $("#adminLoginPanel").hidden=true;$("#adminWorkspace").hidden=false;$("#adminStatus").textContent=`Administrator access confirmed: ${user.email}`;await Promise.all([loadProducts(),loadOrders()])
}
async function loadProducts(){
 const root=$("#adminProducts");root.innerHTML="<p>Loading…</p>";const {data,error}=await db.from("products").select("id,name,category,is_published,product_variants(id,size,color,price,stock)").order("created_at",{ascending:false});
 if(error){root.textContent=error.message;return}if(!data?.length){root.innerHTML="<p class='muted'>No products yet.</p>";return}
 root.innerHTML=data.map(p=>`<article class="admin-list-item"><div><strong>${esc(p.name)}</strong><p>${esc(p.category)} · ${p.is_published?"Published":"Draft"}</p><p>${(p.product_variants||[]).map(v=>`${esc(v.size)} / ${esc(v.color)} — ${money(v.price)} · stock ${v.stock}`).join("<br>")||"No variants"}</p></div><div class="admin-item-actions"><button class="mini-button" data-pub="${p.id}" data-val="${!p.is_published}">${p.is_published?"Unpublish":"Publish"}</button>${(p.product_variants||[]).map(v=>`<button class="mini-button" data-stock="${v.id}" data-valstock="${v.stock}">Stock ${v.stock} · ${esc(v.size)} ${esc(v.color)}</button>`).join("")}<button class="mini-button danger" data-del="${p.id}">Delete</button></div></article>`).join("");
 root.querySelectorAll("[data-pub]").forEach(b=>b.onclick=async()=>{let r=await db.from("products").update({is_published:b.dataset.val==="true"}).eq("id",b.dataset.pub);if(r.error)alert(r.error.message);else loadProducts()});
 root.querySelectorAll("[data-stock]").forEach(b=>b.onclick=async()=>{let x=prompt("New stock quantity (whole number):",b.dataset.valstock);if(x===null)return;let n=Number(x);if(!Number.isInteger(n)||n<0)return alert("Enter a whole number 0 or greater.");let r=await db.from("product_variants").update({stock:n}).eq("id",b.dataset.stock);if(r.error)alert(r.error.message);else loadProducts()});
 root.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this product?"))return;let r=await db.from("products").delete().eq("id",b.dataset.del);if(r.error)alert(r.error.message);else loadProducts()});
}
async function loadOrders(){
 const root=$("#adminOrders");root.innerHTML="<p>Loading…</p>";const {data,error}=await db.from("orders").select("id,status,total,payment_method,created_at,shipping_name,shipping_phone,shipping_city,order_items(product_name,quantity,size,color)").order("created_at",{ascending:false}).limit(50);
 if(error){root.textContent=error.message;return}if(!data?.length){root.innerHTML="<p class='muted'>No orders yet.</p>";return}
 root.innerHTML=data.map(o=>`<article class="admin-list-item"><div><strong>Order ${esc(o.id.slice(0,8).toUpperCase())} · ${money(o.total)}</strong><p>${esc(o.shipping_name)} · ${esc(o.shipping_phone)} · ${esc(o.shipping_city)}</p><p>${new Date(o.created_at).toLocaleString()} · ${esc(o.payment_method)}</p><p>${(o.order_items||[]).map(i=>`${esc(i.product_name)} × ${i.quantity} ${esc(i.size)} ${esc(i.color)}`).join("<br>")}</p></div><div class="admin-item-actions"><span class="status-pill">${esc(o.status)}</span><select data-status="${o.id}"><option ${o.status==="pending"?"selected":""}>pending</option><option ${o.status==="confirmed"?"selected":""}>confirmed</option><option ${o.status==="processing"?"selected":""}>processing</option><option ${o.status==="shipped"?"selected":""}>shipped</option><option ${o.status==="delivered"?"selected":""}>delivered</option><option ${o.status==="cancelled"?"selected":""}>cancelled</option></select><button class="mini-button" data-update="${o.id}">Update status</button></div></article>`).join("");
 root.querySelectorAll("[data-update]").forEach(b=>b.onclick=async()=>{let id=b.dataset.update,status=root.querySelector(`[data-status="${id}"]`).value;let r=await db.from("orders").update({status}).eq("id",id);if(r.error)alert(r.error.message);else loadOrders()});
}
$("#adminLogin").addEventListener("submit",async e=>{e.preventDefault();const {error}=await db.auth.signInWithPassword({email:$("#adminEmail").value.trim(),password:$("#adminPassword").value});if(error)msg("#loginMessage",error.message,true);else{msg("#loginMessage","Signed in.");await check()}});
$("#signOutButton").onclick=async()=>{if(db)await db.auth.signOut();await check()};
$("#refreshProducts").onclick=loadProducts;$("#refreshOrders").onclick=loadOrders;
$("#productForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!user)return;const btn=$("#saveProductButton");btn.disabled=true;btn.textContent="Saving…";
 try{
 const p={name:$("#pName").value.trim(),category:$("#pCategory").value.trim(),description:$("#pDescription").value.trim(),image_url:$("#pImage").value.trim()||null,tag:$("#pTag").value.trim()||null,is_published:$("#pPublished").value==="true",created_by:user.id};
 const {data,error}=await db.from("products").insert(p).select("id").single();if(error)throw error;
 const {error:ve}=await db.from("product_variants").insert({product_id:data.id,size:$("#vSize").value.trim(),color:$("#vColor").value.trim(),price:Number($("#vPrice").value),stock:Number($("#vStock").value),sku:$("#vSku").value.trim()||null});
 if(ve){await db.from("products").delete().eq("id",data.id);throw ve}
 msg("#productMessage","Product saved. Add other size/colour variants from Supabase Table Editor using this product ID.");e.target.reset();await loadProducts()
 }catch(err){msg("#productMessage",err.message||"Could not save product.",true)}finally{btn.disabled=false;btn.textContent="Save product"}
});
check();
})();