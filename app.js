"use strict";

/*
  CAELIS — Frontend interactions

  The product catalogue intentionally starts empty.
  Real products, secure admin access, database storage,
  payment processing and order management require a backend.
*/

const CAELIS_CONFIG = {
  currency: "PKR",
  locale: "en-PK"
};

// Add your real products here later, or load them from your database.
// Do not put private keys, passwords or secret API credentials here.
const products = [];

const state = {
  category: "all",
  search: "",
  sort: "featured",
  cart: loadCart()
};

const elements = {
  grid: document.getElementById("productGrid"),
  emptyCatalogue: document.getElementById("emptyCatalogue"),
  filters: document.querySelectorAll(".filter-button"),
  sort: document.getElementById("sortProducts"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("productSearch"),
  searchToggle: document.querySelector(".search-toggle"),
  closeSearch: document.getElementById("closeSearch"),
  menuToggle: document.querySelector(".menu-toggle"),
  mobileNav: document.getElementById("mobileNav"),
  cartDrawer: document.getElementById("cartDrawer"),
  cartTrigger: document.querySelector(".cart-trigger"),
  closeDrawer: document.querySelector(".close-drawer"),
  overlay: document.getElementById("overlay"),
  cartItems: document.getElementById("cartItems"),
  cartEmpty: document.getElementById("cartEmpty"),
  cartSummary: document.getElementById("cartSummary"),
  cartSubtotal: document.getElementById("cartSubtotal"),
  continueShopping: document.getElementById("continueShopping"),
  checkoutButton: document.getElementById("checkoutButton"),
  notice: document.getElementById("notice"),
  newsletterForm: document.getElementById("newsletterForm"),
  newsletterEmail: document.getElementById("newsletterEmail"),
  newsletterMessage: document.getElementById("newsletterMessage"),
  currentYear: document.getElementById("currentYear")
};

function formatPrice(amount) {
  return new Intl.NumberFormat(CAELIS_CONFIG.locale, {
    style: "currency",
    currency: CAELIS_CONFIG.currency,
    maximumFractionDigits: 0
  }).format(amount);
}

function loadCart() {
  try {
    const saved = localStorage.getItem("caelis-cart");

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.id === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    );
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem("caelis-cart", JSON.stringify(state.cart));
  } catch {
    showNotice("Your browser could not save the bag on this device.");
  }
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.classList.add("visible");

  window.clearTimeout(showNotice.timer);

  showNotice.timer = window.setTimeout(() => {
    elements.notice.classList.remove("visible");
  }, 3200);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getAvailableProducts() {
  let result = products.filter(product => {
    const matchesCategory =
      state.category === "all" ||
      product.category === state.category;

    const searchableText = [
      product.name || "",
      product.description || "",
      product.category || ""
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(
      state.search.trim().toLowerCase()
    );

    return matchesCategory && matchesSearch;
  });

  if (state.sort === "price-low") {
    result.sort((a, b) => a.price - b.price);
  } else if (state.sort === "price-high") {
    result.sort((a, b) => b.price - a.price);
  } else if (state.sort === "name") {
    result.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

function renderProducts() {
  const visibleProducts = getAvailableProducts();

  elements.grid.replaceChildren();
  elements.emptyCatalogue.hidden = visibleProducts.length > 0;

  if (visibleProducts.length === 0) {
    return;
  }

  visibleProducts.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${Math.min(index * 70, 350)}ms`;

    const image = escapeHTML(product.image || "");
    const name = escapeHTML(product.name || "CAELIS piece");
    const description = escapeHTML(product.description || "");
    const category = escapeHTML(product.category || "essentials");
    const price = formatPrice(Number(product.price) || 0);
    const id = escapeHTML(product.id);

    card.innerHTML = `
      <div class="product-image-wrap">
        ${
          image
            ? `<img class="product-image" src="${image}" alt="${name}" loading="lazy">`
            : `<div class="product-image" aria-label="Product image not yet available"></div>`
        }
        ${
          product.tag
            ? `<span class="product-tag">${escapeHTML(product.tag)}</span>`
            : ""
        }
      </div>

      <div class="product-info">
        <div class="product-name-row">
          <h3 class="product-name">${name}</h3>
          <span class="product-price">${price}</span>
        </div>

        <p class="product-description">${description}</p>

        <div class="product-meta">
          <span>${category.replace("-", " ")}</span>
          <span>${Number(product.stock) > 0 ? "Available" : "Sold out"}</span>
        </div>

        <button
          class="add-to-bag"
          type="button"
          data-add="${id}"
          ${Number(product.stock) < 1 ? "disabled" : ""}
        >
          ${Number(product.stock) > 0 ? "Add to bag +" : "Sold out"}
        </button>
      </div>
    `;

    elements.grid.appendChild(card);
  });
}

function updateCartCount() {
  const count = state.cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  document.querySelectorAll(".cart-count").forEach(counter => {
    counter.textContent = String(count);
  });
}

function renderCart() {
  elements.cartItems.replaceChildren();

  const validItems = state.cart
    .map(item => ({
      ...item,
      product: products.find(product => product.id === item.id)
    }))
    .filter(item => item.product);

  state.cart = validItems.map(item => ({
    id: item.id,
    quantity: Math.min(item.quantity, 99)
  }));

  saveCart();
  updateCartCount();

  const isEmpty = validItems.length === 0;

  elements.cartEmpty.hidden = !isEmpty;
  elements.cartSummary.hidden = isEmpty;

  let subtotal = 0;

  validItems.forEach(({ product, quantity }) => {
    subtotal += product.price * quantity;

    const line = document.createElement("article");
    line.className = "cart-line";

    const image = escapeHTML(product.image || "");
    const name = escapeHTML(product.name);
    const id = escapeHTML(product.id);

    line.innerHTML = `
      ${
        image
          ? `<img src="${image}" alt="${name}" loading="lazy">`
          : `<div aria-hidden="true"></div>`
      }
      <div>
        <h3>${name}</h3>
        <p>${formatPrice(product.price)}</p>
        <div class="cart-line-actions">
          <button class="quantity-button" data-quantity="-1" data-id="${id}" aria-label="Decrease quantity">−</button>
          <span>${quantity}</span>
          <button class="quantity-button" data-quantity="1" data-id="${id}" aria-label="Increase quantity">+</button>
          <button class="remove-item" data-remove="${id}" type="button">Remove</button>
        </div>
      </div>
    `;

    elements.cartItems.appendChild(line);
  });

  elements.cartSubtotal.textContent = formatPrice(subtotal);
}

function addToCart(productId) {
  const product = products.find(item => item.id === productId);

  if (!product) {
    showNotice("This product is not available.");
    return;
  }

  const existing = state.cart.find(item => item.id === productId);
  const currentQuantity = existing ? existing.quantity : 0;

  if (currentQuantity >= Number(product.stock)) {
    showNotice("The available stock limit has been reached.");
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: productId,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  showNotice(`${product.name} added to your bag.`);
}

function changeQuantity(productId, amount) {
  const item = state.cart.find(entry => entry.id === productId);
  const product = products.find(entry => entry.id === productId);

  if (!item || !product) return;

  const nextQuantity = item.quantity + amount;

  if (nextQuantity <= 0) {
    state.cart = state.cart.filter(entry => entry.id !== productId);
  } else if (nextQuantity <= Number(product.stock)) {
    item.quantity = nextQuantity;
  } else {
    showNotice("The requested quantity exceeds available stock.");
  }

  saveCart();
  renderCart();
}

function openCart() {
  elements.overlay.hidden = false;
  elements.cartDrawer.classList.add("open");
  elements.cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
  renderCart();
  elements.closeDrawer.focus();
}

function closeCart() {
  elements.cartDrawer.classList.remove("open");
  elements.cartDrawer.setAttribute("aria-hidden", "true");
  elements.overlay.hidden = true;
  document.body.classList.remove("drawer-open");
  elements.cartTrigger.focus();
}

function toggleMobileMenu() {
  const isOpen = !elements.mobileNav.hidden;

  elements.mobileNav.hidden = isOpen;
  elements.menuToggle.setAttribute("aria-expanded", String(!isOpen));
  elements.menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Open navigation" : "Close navigation"
  );
}

function setCategory(category) {
  state.category = category;

  elements.filters.forEach(button => {
    const active = button.dataset.category === category;

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  renderProducts();
}

elements.filters.forEach(button => {
  button.setAttribute(
    "aria-pressed",
    String(button.dataset.category === state.category)
  );

  button.addEventListener("click", () => {
    setCategory(button.dataset.category);
  });
});

elements.sort.addEventListener("change", event => {
  state.sort = event.target.value;
  renderProducts();
});

elements.searchToggle.addEventListener("click", () => {
  elements.searchForm.hidden = !elements.searchForm.hidden;

  if (!elements.searchForm.hidden) {
    elements.searchInput.focus();
  } else {
    state.search = "";
    elements.searchInput.value = "";
    renderProducts();
  }
});

elements.searchForm.addEventListener("submit", event => {
  event.preventDefault();
  state.search = elements.searchInput.value;
  renderProducts();
});

elements.searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  renderProducts();
});

elements.closeSearch.addEventListener("click", () => {
  elements.searchForm.hidden = true;
  elements.searchInput.value = "";
  state.search = "";
  renderProducts();
});

elements.grid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (button) {
    addToCart(button.dataset.add);
  }
});

elements.cartItems.addEventListener("click", event => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");

  if (quantityButton) {
    changeQuantity(
      quantityButton.dataset.id,
      Number(quantityButton.dataset.quantity)
    );
  }

  if (removeButton) {
    state.cart = state.cart.filter(
      item => item.id !== removeButton.dataset.remove
    );

    saveCart();
    renderCart();
  }
});

elements.cartTrigger.addEventListener("click", openCart);
elements.closeDrawer.addEventListener("click", closeCart);
elements.overlay.addEventListener("click", closeCart);

elements.continueShopping.addEventListener("click", () => {
  closeCart();
  document.getElementById("collection").scrollIntoView({
    behavior: "smooth"
  });
});

elements.menuToggle.addEventListener("click", toggleMobileMenu);

elements.mobileNav.addEventListener("click", event => {
  if (event.target.closest("a")) {
    elements.mobileNav.hidden = true;
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.menuToggle.setAttribute("aria-label", "Open navigation");
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" &&
      elements.cartDrawer.classList.contains("open")) {
    closeCart();
  } else if (event.key === "Escape" &&
             !elements.searchForm.hidden) {
    elements.searchForm.hidden = true;
  }
});

elements.checkoutButton.addEventListener("click", () => {
  showNotice(
    "Secure checkout is not connected yet. Connect your backend before accepting orders."
  );
});

/*
  The newsletter form is intentionally not presented as a real
  subscription until a mailing-list service or backend is connected.
*/
elements.newsletterForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!elements.newsletterForm.reportValidity()) return;

  elements.newsletterMessage.textContent =
    "The mailing list is not connected yet. Please check back soon.";
});

elements.currentYear.textContent = String(new Date().getFullYear());

renderProducts();
renderCart();
