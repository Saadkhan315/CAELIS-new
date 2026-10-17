(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(v||0));
const fallback="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";
const ready=window.supabase&&window.CAELIS_SUPABASE_URL&&!window.CAELIS_SUPABASE_URL.includes("PASTE_")&&window.CAELIS_SUPABASE_ANON_KEY&&!window.CAELIS_SUPABASE_ANON_KEY.includes("PASTE_");
const db=ready?window.supabase.createClient(window.CAELIS_SUPABASE_URL,window.CAELIS_SUPABASE_ANON_KEY):null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=[],cart=[],user=null,authMode="signin",toastTimer;
const msg=(sel,t,err=false)=>{const e=$(sel);if(e){e.textContent=t;e.style.color=err?"#9a3c2f":"#6d603f";}};
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),2800)}
function show(sel){$("#overlay").hidden=false;document.body.classList.add("no-scroll");if(sel==="cart"){$("#cartDrawer").classList.add("open");$("#cartDrawer").setAttribute("aria-hidden","false")}else $(sel).hidden=false}
function close(){ $("#overlay").hidden=true;$("#cartDrawer").classList.remove("open");$("#cartDrawer").setAttribute("aria-hidden","true");["#accountModal","#checkoutModal","#ordersModal"].forEach(s=>$(s).hidden=true);document.body.classList.remove("no-scroll") }
function saveCart(){localStorage.setItem("caelis-cart",JSON.stringify(cart));renderCart()}
function count(){return cart.reduce((n,x)=>n+x.quantity,0)}
function subtotal(){return cart.reduce((n,x)=>n+x.price*x.quantity,0)}
function details(item){let p=products.find(p=>p.id===item.product_id),v=p?.variants?.find(v=>v.id===item.variant_id);return{p,v,name:p?.name||item.name||"CAELIS item",image:p?.image_url||item.image_url||fallback,price:Number(v?.price??item.price??0),size:v?.size||item.size||"",color:v?.color||item.color||""}}
function renderProducts(){
 const root=$("#productGrid");
 if(!products.length){root.innerHTML='<div class="empty-state"><p class="eyebrow">THE FIRST EDIT</p><h3>No products published yet.</h3><p>Connect Supabase, then add your own products in the admin page.</p><a class="underlined-link" href="admin.html">Open store admin ↗</a></div>';return}
 root.innerHTML=products.map(p=>{let vs=p.variants||[],price=vs.length?Math.min(...vs.map(v=>+v.price)):0,available=vs.some(v=>+v.stock>0);return `<article class="product-card"><div class="product-image-wrap"><img class="product-image" loading="lazy" src="${esc(p.image_url||fallback)}" alt="${esc(p.name)}" onerror="this.src='${fallback}'">${p.tag?`<span class="product-tag">${esc(p.tag)}</span>`:""}<button class="quick-add" data-add="${esc(p.id)}" ${available?"":"disabled"}>${available?"Choose size & colour +":"Sold out"}</button></div><div class="product-info"><div><h3 class="product-name">${esc(p.name)}</h3><p class="product-category">${esc(p.category||"CAELIS essentials")}</p></div><div class="product-price">${money(price)}</div></div></article>`}).join("");
 root.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addProduct(b.dataset.add));
}
function addProduct(id){
 const p=products.find(x=>x.id===id),vs=(p?.variants||[]).filter(v=>+v.stock>0);if(!vs.length)return toast("Currently unavailable.");
 const sizes=[...new Set(vs.map(v=>v.size).filter(Boolean))],size=sizes.length?prompt("Choose size:\n"+sizes.join(", ")): "";
 if(sizes.length&&!size)return;if(sizes.length&&!sizes.some(x=>x.toLowerCase()===size.trim().toLowerCase()))return toast("Choose a listed size.");
 const bySize=vs.filter(v=>!sizes.length||v.size.toLowerCase()===size.trim().toLowerCase()),colors=[...new Set(bySize.map(v=>v.color).filter(Boolean))],color=colors.length>1?prompt("Choose colour:\n"+colors.join(", ")):colors[0]||"";
 if(colors.length>1&&!color)return;if(colors.length&&!colors.some(x=>x.toLowerCase()===color.trim().toLowerCase()))return toast("Choose a listed colour.");
 const v=bySize.find(v=>!colors.length||v.color.toLowerCase()===color.trim().toLowerCase());if(!v)return toast("That option is unavailable.");
 const old=cart.find(x=>x.variant_id===v.id);if(old){if(old.quantity>=+v.stock)return toast("No more stock available.");old.quantity++}else cart.push({product_id:p.id,variant_id:v.id,quantity:1,name:p.name,image_url:p.image_url||fallback,price:+v.price,size:v.size,color:v.color});
 saveCart();show("cart");toast("Added to your bag.");
}
function renderCart(){
 $("#cartCount").textContent=count();$("#cartSubtotal").textContent=money(subtotal());$("#checkoutTotal").textContent=money(subtotal());
 const root=$("#cartItems");if(!cart.length){root.innerHTML='<div class="empty-state"><p>Your bag is waiting for something considered.</p><button class="button button-dark" id="continueShopping">Continue shopping</button></div>';$("#continueShopping").onclick=close;return}
 root.innerHTML=cart.map((it,i)=>{let d=details(it);return `<div class="cart-line"><img src="${esc(d.image)}" alt="${esc(d.name)}"><div><h3>${esc(d.name)}</h3><p>${esc([d.size,d.color].filter(Boolean).join(" / "))}</p><strong>${money(d.price)}</strong><div class="qty-control"><button data-qty="${i}" data-delta="-1">−</button><span>${it.quantity}</span><button data-qty="${i}" data-delta="1">+</button></div></div><button class="remove-item" data-remove="${i}">Remove</button></div>`}).join("");
 root.querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>{let i=+b.dataset.qty,n=cart[i].quantity+(+b.dataset.delta);if(n<1)cart.splice(i,1);else cart[i].quantity=Math.min(20,n);saveCart()});
 root.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.remove,1);saveCart()});
}
async function loadProducts(){
 if(!db){$("#productStatus").textContent="Connect Supabase to activate real products, accounts and orders.";products=[];renderProducts();return}
 const {data,error}=await db.from("products").select("id,name,description,category,image_url,tag,is_published,created_at,product_variants(id,product_id,size,color,price,stock,sku)").eq("is_published",true).order("created_at",{ascending:false});
 if(error){console.error(error);$("#productStatus").textContent="Could not load products. Check setup guide.";products=[]}else{products=(data||[]).map(p=>({...p,variants:p.product_variants||[]}));$("#productStatus").textContent=products.length?"Pieces selected for your everyday rotation.":"Connected. Add your first product in admin."}
 renderProducts();
}
async function refreshUser(){if(!db)return;const {data}=await db.auth.getSession();user=data?.session?.user||null;$("#accountButton").textContent=user?"My account":"Account";$("#checkoutAccountNote").textContent=user?`Signed in as ${user.email}`:"Sign in before placing an order.";if(user?.email)$("#shippingEmail").value=user.email}
async function authSubmit(e){
 e.preventDefault();if(!db)return msg("#authMessage","Connect Supabase first using SETUP-GUIDE.md.",true);
 const btn=$("#authSubmit");btn.disabled=true;
 try{let result=authMode==="signup"?await db.auth.signUp({email:$("#authEmail").value.trim(),password:$("#authPassword").value}):await db.auth.signInWithPassword({email:$("#authEmail").value.trim(),password:$("#authPassword").value});
 if(result.error)throw result.error;if(authMode==="signup"&&!result.data.session)msg("#authMessage","Account created. Check your email to confirm, then sign in.");else{await refreshUser();msg("#authMessage","You are signed in.");toast("Welcome to CAELIS.")}}
 catch(e){msg("#authMessage",e.message||"Authentication failed.",true)}finally{btn.disabled=false;btn.textContent=authMode==="signin"?"Sign in":"Create account"}
}
async function placeOrder(e){
 e.preventDefault();if(!db)return msg("#checkoutMessage","Connect Supabase first.",true);await refreshUser();
 if(!user){close();show("#accountModal");return msg("#authMessage","Sign in or create an account before checkout.")}
 if(!cart.length)return msg("#checkoutMessage","Your bag is empty.",true);
 const btn=$("#placeOrderButton");btn.disabled=true;btn.textContent="Placing order…";
 const shipping={full_name:$("#shippingName").value.trim(),email:$("#shippingEmail").value.trim(),phone:$("#shippingPhone").value.trim(),address:$("#shippingAddress").value.trim(),city:$("#shippingCity").value.trim(),postal_code:$("#shippingPostal").value.trim(),country:$("#shippingCountry").value.trim()};
 try{const {data,error}=await db.rpc("place_order",{p_items:cart.map(i=>({variant_id:i.variant_id,quantity:i.quantity})),p_shipping:shipping,p_payment_method:$("#paymentMethod").value});if(error)throw error;cart=[];saveCart();close();toast("Order placed: "+String(data).slice(0,8).toUpperCase());await loadProducts();show("#ordersModal");await loadOrders()}
 catch(err){console.error(err);msg("#checkoutMessage",err.message||"Could not place order.",true)}
 finally{btn.disabled=false;btn.textContent="Place order"}
}
async function loadOrders(){
 const root=$("#orderHistory");if(!db||!user){root.innerHTML="<p class='muted'>Sign in to view orders.</p>";return}
 root.innerHTML="<p class='muted'>Loading orders…</p>";const {data,error}=await db.from("orders").select("id,status,total,payment_method,created_at,order_items(quantity,unit_price,product_name,size,color)").order("created_at",{ascending:false}).limit(30);
 if(error){root.textContent=error.message;return}if(!data?.length){root.innerHTML="<p class='muted'>No orders yet.</p>";return}
 root.innerHTML=data.map(o=>`<article class="order-card"><div class="order-card-head"><strong>Order ${esc(o.id.slice(0,8).toUpperCase())}</strong><span class="status-pill">${esc(o.status)}</span></div><p>${new Date(o.created_at).toLocaleDateString()} · ${esc(o.payment_method)} · ${money(o.total)}</p><p>${(o.order_items||[]).map(i=>`${esc(i.product_name)} × ${i.quantity} ${esc(i.size||"")} ${esc(i.color||"")}`).join(", ")}</p></article>`).join("")
}
function init(){
 $("#year").textContent=new Date().getFullYear();try{cart=JSON.parse(localStorage.getItem("caelis-cart")||"[]");if(!Array.isArray(cart))cart=[]}catch{cart=[]}
 $("#menuToggle").onclick=()=>$("#mainNav").classList.toggle("open");$$('#mainNav a').forEach(a=>a.onclick=()=>$("#mainNav").classList.remove("open"));
 $("#bagButton").onclick=()=>show("cart");$("#accountButton").onclick=async()=>{await refreshUser();show("#accountModal")};
 $("#overlay").onclick=close;$$("[data-close]").forEach(b=>b.onclick=close);
 $("#checkoutButton").onclick=async()=>{if(!cart.length)return toast("Your bag is empty.");await refreshUser();close();show("#checkoutModal")};
 $("#authForm").onsubmit=authSubmit;$("#checkoutForm").onsubmit=placeOrder;
 $$("[data-auth-mode]").forEach(b=>b.onclick=()=>{authMode=b.dataset.authMode;$$("[data-auth-mode]").forEach(x=>x.classList.toggle("active",x===b));$("#authSubmit").textContent=authMode==="signin"?"Sign in":"Create account";msg("#authMessage","")});
 $("#ordersButton").onclick=async()=>{await refreshUser();close();show("#ordersModal");await loadOrders()};
 $("#newsletterForm").onsubmit=e=>{e.preventDefault();msg("#newsletterMessage","Thank you. Newsletter email delivery must be connected separately.");e.target.reset()};
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});renderCart();loadProducts();
 if(db){refreshUser();db.auth.onAuthStateChange((_e,s)=>{user=s?.user||null;$("#accountButton").textContent=user?"My account":"Account"})}
}
init();
})();