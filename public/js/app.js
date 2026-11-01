const API = "";
const STATE = {
  products: [],
  categories: [],
  brands: [],
  cart: [],
  wishlist: [],
  user: null,
  cartMap: new Map(),
  wishSet: new Set(),
  filters: { category: "", brand: "", q: "", min: "", max: "", size: "", sort: "" },
  currentProduct: null,
  page: 1,
  limit: 20,
  total: 0
};

function $el(id) { return document.getElementById(id); }

function formatPrice(n) {
  n = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function discountPct(price, disc) {
  if (!disc) return 0;
  return Math.round((1 - disc / price) * 100);
}

function starsHtml(rating) {
  const full = Math.floor(Number(rating) || 0);
  const half = (Number(rating) || 0) - full >= 0.3 ? 1 : 0;
  let s = "";
  for (let i = 0; i < 5; i++) {
    if (i < full) s += '<i class="fas fa-star"></i>';
    else if (i === full && half) s += '<i class="fas fa-star-half-alt"></i>';
    else s += '<i class="far fa-star"></i>';
  }
  return s;
}

async function request(path, opts = {}) {
  const options = { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts };
  if (options.body && typeof options.body === "object") options.body = JSON.stringify(options.body);
  try {
    const res = await fetch(API + path, options);
    if (res.status === 401) {
      STATE.user = null;
      updateAuthUI();
      showToast("Session expired. Please login again.", "error");
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, message: errText || `Request failed (${res.status})` };
    }
    return res.json();
  } catch (e) {
    console.error("API error:", path, e);
    return { success: false, message: "Network error. Please check your connection." };
  }
}

function showToast(msg, type = "success") {
  let t = $el("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  const icon = type === "error" ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
  t.innerHTML = icon + msg;
  t.className = "toast " + type + " show";
  setTimeout(() => { t.classList.remove("show"); }, 3000);
}

async function loadCounts() {
  try {
    const [cRes, wRes] = await Promise.all([request("/api/cart"), request("/api/wishlist")]);
    STATE.cart = cRes.cart || [];
    STATE.wishlist = wRes.wishlist || [];
    STATE.cartMap = new Map(STATE.cart.map(i => [i.product_id, i]));
    STATE.wishSet = new Set(STATE.wishlist.map(i => i.product_id));
    const cartQty = STATE.cart.reduce((a, b) => a + (b.quantity || 1), 0);
    if ($el("cartCount")) $el("cartCount").textContent = cartQty;
    if ($el("wishCount")) $el("wishCount").textContent = STATE.wishlist.length;
  } catch (e) { console.error(e); }
}

async function loadUser() {
  const res = await request("/api/me");
  STATE.user = res.success && res.user ? res.user : null;
  updateAuthUI();
  await loadCounts();
}

function updateAuthUI() {
  const userName = $el("userName");
  const loginLink = $el("loginLink");
  const logoutLink = $el("logoutLink");
  const profileLink = $el("profileLink");
  const ordersLink = $el("ordersLink");
  if (!STATE.user) {
    userName && (userName.textContent = "Hello, sign in");
    loginLink && (loginLink.style.display = "block");
    logoutLink && (logoutLink.style.display = "none");
    profileLink && (profileLink.style.display = "none");
    ordersLink && (ordersLink.style.display = "none");
  } else {
    userName && (userName.textContent = STATE.user.name);
    loginLink && (loginLink.style.display = "none");
    logoutLink && (logoutLink.style.display = "block");
    profileLink && (profileLink.style.display = "block");
    ordersLink && (ordersLink.style.display = "block");
  }
  logoutLink && (logoutLink.onclick = (e) => { e.preventDefault(); logout(); });
  loginLink && (loginLink.onclick = (e) => { e.preventDefault(); location.href = "login.html"; });
}

async function logout() {
  await request("/api/logout", { method: "POST" });
  STATE.user = null;
  STATE.cart = [];
  STATE.wishlist = [];
  STATE.cartMap = new Map();
  STATE.wishSet = new Set();
  updateAuthUI();
  await loadCounts();
  showToast("Logged out successfully");
  if ($el("cartItems")) loadCart();
  if ($el("wishlistItems")) loadWishlist();
  location.href = "index.html";
}

async function loadCategories() {
  const res = await request("/api/categories");
  STATE.categories = res.categories || [];
  renderSportTabs();
  renderCategoryFilters();
  renderCategoryCards();
}

function renderCategoryCards() {
  const container = $el("categoryCardsGrid");
  if (!container) return;
  container.innerHTML = "";
  STATE.categories.forEach(c => {
    const card = document.createElement("div");
    card.className = "category-card";
    const imgUrl = c.image || "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80";
    card.innerHTML = `
      <img src="${imgUrl}" alt="${c.name}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80';">
      <div class="category-card-overlay">
        <h3>${c.name}</h3>
        <span>Explore Gear <i class="fas fa-arrow-right"></i></span>
      </div>
    `;
    card.onclick = () => { location.href = "products.html?category=" + encodeURIComponent(c.slug); };
    container.appendChild(card);
  });
}

function renderCategoryFilters() {
  const container = $el("categoryFilters");
  if (!container) return;
  container.innerHTML = "";
  STATE.categories.forEach(c => {
    const label = document.createElement("label");
    label.className = "filter-item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "filterCat";
    input.className = "filter-cat";
    input.value = c.slug;
    if (STATE.filters.category === c.slug) input.checked = true;
    input.onchange = () => {
      STATE.filters.category = c.slug;
      STATE.page = 1;
      renderProductList("productList");
    };
    label.appendChild(input);
    label.append(" " + c.name);
    container.appendChild(label);
  });
}

function renderSportTabs() {
  const container = $el("sportTabs");
  if (!container) return;
  container.innerHTML = '<button class="tab-btn active" data-sport="all">All Sports</button>';
  STATE.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.dataset.sport = cat.slug;
    btn.dataset.color = cat.color || "#00d4ff";
    btn.textContent = cat.name;
    btn.style.borderColor = cat.color || "#00d4ff";
    btn.style.color = cat.color || "#00d4ff";
    btn.onclick = (e) => {
      container.querySelectorAll(".tab-btn").forEach(b => { b.classList.remove("active"); b.style.borderColor = "var(--border)"; b.style.color = "var(--text-muted)"; });
      btn.classList.add("active");
      btn.style.borderColor = btn.dataset.color;
      btn.style.color = btn.dataset.color;
      STATE.filters.category = cat.slug;
      STATE.filters.q = "";
      if ($el("topSearch")) $el("topSearch").value = "";
      STATE.page = 1;
      renderProductList("productList");
      renderHomeProducts();
    };
    container.appendChild(btn);
  });
}

async function loadBrands() {
  const res = await request("/api/brands");
  STATE.brands = res.brands || [];
  renderBrandFilters();
  renderBrandGrid();
}

function renderBrandFilters() {
  const container = $el("brandFilters");
  if (!container) return;
  STATE.brands.forEach(b => {
    const label = document.createElement("label");
    label.className = "filter-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "filter-brand";
    input.value = b.name;
    label.appendChild(input);
    label.append(" " + b.name);
    container.appendChild(label);
  });
}

function renderBrandGrid() {
  const container = $el("brandGrid");
  if (!container) return;
  container.innerHTML = "";
  STATE.brands.forEach((b) => {
    const card = document.createElement("div");
    card.className = "brand-card";
    const bgImg = b.image || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80";
    card.style.backgroundImage = `linear-gradient(to top, rgba(10, 25, 47, 0.92) 0%, rgba(10, 25, 47, 0.4) 60%, rgba(10, 25, 47, 0.2) 100%), url('${bgImg}')`;
    card.innerHTML = `
      <div class="brand-badge"><i class="fas fa-star"></i></div>
      <div class="brand-details">
        <h3>${b.name}</h3>
        <span class="brand-link">Explore Collection <i class="fas fa-arrow-right"></i></span>
      </div>
    `;
    card.style.cursor = "pointer";
    card.onclick = () => { location.href = "products.html?brand=" + encodeURIComponent(b.name); };
    container.appendChild(card);
  });
}

function renderProductCard(p) {
  const price = p.discount_price || p.price;
  const off = discountPct(p.price, p.discount_price);
  const inWish = STATE.wishSet.has(p.id);
  const inCart = STATE.cartMap.has(p.id);
  return `
    <div class="product-card fade-in" onclick="appGoProduct(${p.id})" style="cursor:pointer;">
      <div class="card-image-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80';">
        ${p.new_arrival ? '<span class="card-badge badge-new">New Arrival</span>' : ""}
        ${off > 0 ? '<span class="card-badge badge-sale" style="top:auto;bottom:16px;left:16px;">' + off + '% Off</span>' : ""}
        ${p.trending ? '<span class="card-badge badge-trend" style="top:auto;bottom:16px;right:16px;">Trending</span>' : ""}
        <div class="card-actions">
          <button class="icon-btn" onclick="quickView(${p.id}); event.stopPropagation();" title="Quick view"><i class="fas fa-eye"></i></button>
          <button class="icon-btn wish-btn ${inWish ? "wish-active" : ""}" data-id="${p.id}" onclick="toggleWish(${p.id}, event); event.stopPropagation();" title="${inWish ? "Remove from wishlist" : "Add to wishlist"}"><i class="${inWish ? "fas" : "far"} fa-heart"></i></button>
          <button class="icon-btn add-cart" data-id="${p.id}" onclick="addToCart(${p.id}, 1, event); event.stopPropagation();" title="Add to cart"><i class="fas fa-shopping-bag"></i></button>
        </div>
      </div>
      <div class="card-content">
        <span class="card-category">${p.category_name || "Sports"}</span>
        <h3 class="card-title">${p.name}</h3>
        <div class="card-rating">
          <span class="stars">${starsHtml(p.rating)}</span>
          <span class="rating-text">(${p.reviews || 0})</span>
        </div>
        <div class="card-price-row">
          <span class="card-price">${formatPrice(price)}</span>
          ${p.discount_price ? `<span class="card-old">${formatPrice(p.price)}</span> <span class="card-save">Save ₹${Math.round(p.price - p.discount_price)}</span>` : ""}
        </div>
        <div class="card-footer">
          <span class="badge badge-new">Premium</span>
          <button class="card-add ${inCart ? "added" : ""}" onclick="addToCart(${p.id}, 1, event); event.stopPropagation();"><i class="fas ${inCart ? "fa-check" : "fa-shopping-bag"}"></i></button>
        </div>
      </div>
    </div>
  `;
}

function renderSkeletonCards(count = 8) {
  return Array(count).fill(0).map(() => `
    <div class="product-card">
      <div class="card-image-wrap"><div class="skeleton image"></div></div>
      <div class="card-content">
        <div class="skeleton title"></div>
        <div class="skeleton text" style="width:50%"></div>
        <div class="skeleton rating"><div class="skeleton" style="width:70%;height:16px;margin-bottom:12px;"></div><div class="skeleton" style="width:40%;height:14px;"></div></div>
        <div class="skeleton price"></div>
        <div class="card-footer" style="border:none;padding-top:0;margin-top:0;"><span class="skeleton" style="width:30%;height:14px;"></span><div class="skeleton" style="width:44px;height:44px;border-radius:10px;"></div></div>
      </div>
    </div>
  `).join("");
}

async function renderHomeProducts() {
  const container = $el("homeProducts");
  if (!container) return;
  container.innerHTML = renderSkeletonCards();
  const activeTab = document.querySelector(".tab-btn.active");
  const sport = activeTab ? activeTab.dataset.sport : "all";
  const params = new URLSearchParams();
  if (sport !== "all") params.set("category", sport);
  params.set("limit", "12");
  const res = await request("/api/products?" + params.toString());
  const products = res.products || [];
  STATE.products = [...STATE.products, ...products];
  container.innerHTML = products.map(renderProductCard).join("");
}

async function loadDeals() {
  const container = $el("dealsProducts");
  if (!container) return;
  const res = await request("/api/products?new_arrival=1&limit=8");
  const products = res.products || [];
  STATE.products = [...STATE.products, ...products];
  container.innerHTML = products.map(renderProductCard).join("");
}

async function renderProductList(containerId, extraParams = {}) {
  const container = $el(containerId);
  if (!container) return;
  container.innerHTML = renderSkeletonCards();
  const allParams = { ...STATE.filters, ...extraParams, page: STATE.page, limit: STATE.limit };
  const qs = new URLSearchParams();
  Object.entries(allParams).forEach(([k, v]) => { if (v !== "" && v != null) qs.set(k, v); });
  const res = await request("/api/products?" + qs.toString());
  STATE.products = res.products || [];
  STATE.total = res.total || STATE.products.length;
  container.innerHTML = STATE.products.map(renderProductCard).join("");
  if ($el("productCount")) $el("productCount").textContent = STATE.total + " products found";
  renderPagination(containerId.replace("productList", "pagination"));
}

function renderPagination(containerId) {
  const container = $el(containerId);
  if (!container) return;
  const pages = Math.ceil(STATE.total / STATE.limit);
  if (pages <= 1) { container.innerHTML = ""; container.style.display = "none"; return; }
  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.gap = "10px";
  container.style.marginTop = "32px";
  let html = "";
  if (STATE.page > 1) {
    html += `<button class="page-btn" onclick="goPage(${STATE.page - 1}, event)"><i class="fas fa-chevron-left"></i></button>`;
  }
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === STATE.page ? "active" : ""}" onclick="goPage(${i}, event)">${i}</button>`;
  }
  if (STATE.page < pages) {
    html += `<button class="page-btn" onclick="goPage(${STATE.page + 1}, event)"><i class="fas fa-chevron-right"></i></button>`;
  }
  container.innerHTML = html;
}

window.goPage = function (page, e) {
  if (e) e.preventDefault();
  STATE.page = page;
  renderProductList("productList");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

async function initProductsPage() {
  // Check URL params for brand filter
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get("brand")) {
    STATE.filters.brand = urlParams.get("brand");
  }
  if (urlParams.get("q")) {
    STATE.filters.q = urlParams.get("q");
    if ($el("topSearch")) $el("topSearch").value = urlParams.get("q");
  }
  if (urlParams.get("category")) {
    STATE.filters.category = urlParams.get("category");
  }

  const sort = $el("sortSelect");
  sort && sort.addEventListener("change", (e) => { STATE.filters.sort = e.target.value; STATE.page = 1; renderProductList("productList"); });
  const apply = $el("applyFilters");
  apply && apply.addEventListener("click", () => {
    const sizeChecks = document.querySelectorAll(".filter-size:checked");
    STATE.filters.size = sizeChecks.length ? Array.from(sizeChecks).map(i => i.value).join(",") : "";
    const brandChecks = document.querySelectorAll(".filter-brand:checked");
    STATE.filters.brand = brandChecks.length ? Array.from(brandChecks).map(i => i.value).join(",") : "";
    STATE.filters.min = $el("priceMinInput") ? $el("priceMinInput").value : "";
    STATE.filters.max = $el("priceMaxInput") ? $el("priceMaxInput").value : "";
    STATE.page = 1;
    renderProductList("productList");
  });

  const clearBtn = $el("clearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      STATE.filters = { category: "", brand: "", q: "", min: "", max: "", size: "", sort: "" };
      document.querySelectorAll(".filter-size:checked, .filter-brand:checked, .filter-cat:checked").forEach(i => i.checked = false);
      if ($el("priceMinInput")) $el("priceMinInput").value = "";
      if ($el("priceMaxInput")) $el("priceMaxInput").value = "";
      if ($el("sortSelect")) $el("sortSelect").value = "";
      STATE.page = 1;
      renderProductList("productList");
    });
  }

  await renderProductList("productList");
  await loadCounts();
}

function loadProductsPage() { renderProductList("productList"); }

async function initProductDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { location.href = "products.html"; return; }
  const res = await request("/api/products/" + id);
  if (!res.success) { showToast("Product not found", "error"); location.href = "products.html"; return; }
  STATE.currentProduct = res.product;
  renderProductDetail(res.product);
  loadProductReviews(id);
  loadRelatedProducts(res.product);
  await loadCounts();
}

function renderProductDetail(p) {
  const images = p.images && p.images.length ? p.images : [p.image];
  $el("prodName") && ($el("prodName").textContent = p.name);
  $el("prodCategory") && ($el("prodCategory").textContent = p.category_name || "Sports");
  $el("prodDesc") && ($el("prodDesc").textContent = p.description || "");
  $el("metaCategory") && ($el("metaCategory").textContent = p.category_name || "-");
  $el("metaBrand") && ($el("metaBrand").textContent = p.brand_name || "-");
  $el("metaColor") && ($el("metaColor").textContent = p.color || "-");
  $el("metaStock") && ($el("metaStock").textContent = p.stock > 0 ? ("In Stock (" + p.stock + ")") : "Out of Stock");
  $el("specCategory") && ($el("specCategory").textContent = p.category_name || "-");
  $el("specBrand") && ($el("specBrand").textContent = p.brand_name || "-");
  $el("specColor") && ($el("specColor").textContent = p.color || "-");
  $el("specSize") && ($el("specSize").textContent = p.size || "-");
  $el("specRating") && ($el("specRating").textContent = (p.rating || 0) + " / 5 (" + (p.reviews || 0) + " reviews)");
  $el("specMaterial") && ($el("specMaterial").textContent = p.material || "Premium Quality");
  $el("specWeight") && ($el("specWeight").textContent = p.weight || "Lightweight");

  // Update page title
  document.title = p.name + " | SportKick";

  const price = p.discount_price || p.price;
  $el("prodPrice") && ($el("prodPrice").textContent = formatPrice(price));
  if (p.discount_price) {
    $el("prodOldPrice") && ($el("prodOldPrice").textContent = formatPrice(p.price));
    $el("prodDiscount") && ($el("prodDiscount").textContent = discountPct(p.price, p.discount_price) + "% off");
  }
  $el("prodStars") && ($el("prodStars").innerHTML = starsHtml(p.rating));
  $el("prodReviewCount") && ($el("prodReviewCount").textContent = "(" + (p.reviews || 0) + " reviews)");

  // Short description
  $el("prodShortDesc") && ($el("prodShortDesc").textContent = p.short_desc || "");

  // Stock status badge
  const stockBadge = $el("stockBadge");
  if (stockBadge) {
    if (p.stock > 10) {
      stockBadge.innerHTML = '<i class="fas fa-check-circle"></i> In Stock';
      stockBadge.className = "stock-badge in-stock";
    } else if (p.stock > 0) {
      stockBadge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Only ' + p.stock + ' left!';
      stockBadge.className = "stock-badge low-stock";
    } else {
      stockBadge.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
      stockBadge.className = "stock-badge out-stock";
    }
  }

  const main = $el("mainImg");
  const thumbs = $el("thumbList");
  if (main) {
    main.src = images[0];
    main.onerror = function() { this.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000&q=80'; };
  }
  if (thumbs) {
    thumbs.innerHTML = images.map((img, i) => `
      <div class="thumb ${i === 0 ? "active" : ""}" onclick="appSetThumb(${i}, '${img.replace(/'/g, "\\'")}')">
        <img src="${img}" alt="Thumbnail ${i+1}" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80';">
      </div>
    `).join("");
  }

  const sizeOpts = $el("sizeOptions");
  if (sizeOpts) {
    const sizes = (p.size || "7,8,9,10,11,12").split(",");
    sizeOpts.innerHTML = sizes.map(s => `<button class="size-btn" data-size="${s.trim()}">${s.trim()}</button>`).join("");
    sizeOpts.querySelectorAll(".size-btn").forEach(b => b.addEventListener("click", () => {
      sizeOpts.querySelectorAll(".size-btn").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
    }));
    if (sizeOpts.firstElementChild) sizeOpts.firstElementChild.classList.add("selected");
  }

  const addBtn = $el("addToCartBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      const sizeSel = document.querySelector(".size-btn.selected");
      const qty = parseInt($el("prodQty").value) || 1;
      addToCart(p.id, qty, null, sizeSel ? sizeSel.dataset.size : null);
    };
  }

  const buyNowBtn = $el("buyNowBtn");
  if (buyNowBtn) {
    buyNowBtn.onclick = async () => {
      const sizeSel = document.querySelector(".size-btn.selected");
      const qty = parseInt($el("prodQty").value) || 1;
      await addToCart(p.id, qty, null, sizeSel ? sizeSel.dataset.size : null);
      location.href = "cart.html";
    };
  }

  const wishBtn = $el("wishToggleBtn");
  if (wishBtn) {
    wishBtn.onclick = (e) => toggleWish(p.id, e);
    updateWishBtn(p.id);
  }
}

async function loadProductReviews(productId) {
  const container = $el("reviewsList");
  if (!container) return;
  const res = await request("/api/products/" + productId + "/reviews");
  const reviews = res.reviews || [];
  if (reviews.length === 0) {
    container.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review this product!</p>';
    return;
  }
  container.innerHTML = reviews.map(r => `
    <div class="review-item fade-in">
      <div class="review-header">
        <div class="review-avatar">${(r.user_name || "U").charAt(0).toUpperCase()}</div>
        <div class="review-meta">
          <strong>${r.user_name || "Anonymous"}</strong>
          <div class="stars">${starsHtml(r.rating)}</div>
        </div>
        <span class="review-date">${new Date(r.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</span>
      </div>
      <p class="review-comment">${r.comment || ""}</p>
    </div>
  `).join("");
}

async function loadRelatedProducts(product) {
  const container = $el("relatedProducts");
  if (!container) return;
  const res = await request("/api/products?category=" + (product.category_name || "") + "&limit=4");
  const products = (res.products || []).filter(p => p.id !== product.id).slice(0, 4);
  STATE.products = [...STATE.products, ...products];
  if (products.length === 0) {
    container.parentElement.style.display = "none";
    return;
  }
  container.innerHTML = products.map(renderProductCard).join("");
}

async function submitReview(e) {
  e.preventDefault();
  if (!STATE.user) { showToast("Please login to write a review", "error"); return; }
  const productId = STATE.currentProduct ? STATE.currentProduct.id : null;
  if (!productId) return;
  const rating = $el("reviewRating") ? $el("reviewRating").value : 5;
  const comment = $el("reviewComment") ? $el("reviewComment").value.trim() : "";
  if (!comment) { showToast("Please write a comment", "error"); return; }
  const res = await request("/api/products/" + productId + "/reviews", {
    method: "POST",
    body: { rating: parseInt(rating), comment }
  });
  if (res.success) {
    showToast("Review submitted successfully!");
    if ($el("reviewComment")) $el("reviewComment").value = "";
    loadProductReviews(productId);
    // Reload product to update rating
    const pRes = await request("/api/products/" + productId);
    if (pRes.success) renderProductDetail(pRes.product);
  } else {
    showToast(res.message || "Failed to submit review", "error");
  }
}

window.appSetThumb = function (i, src) {
  const main = $el("mainImg");
  if (main) main.src = src;
  document.querySelectorAll(".thumb").forEach((t, idx) => t.classList.toggle("active", idx === i));
};

async function addToCart(id, qty = 1, event, size = null) {
  if (event) event.stopPropagation();
  if (!STATE.user) {
    showToast("Please login to add items to cart", "error");
    setTimeout(() => { location.href = "login.html"; }, 1500);
    return;
  }
  const res = await request("/api/cart", { method: "POST", body: { product_id: id, quantity: qty, size } });
  if (res.success) {
    await loadCounts();
    showToast("Added to cart! 🛒");
    updateCartButtons(id, true);
  } else {
    showToast(res.message || "Failed to add to cart", "error");
  }
}

function updateCartButtons(id, added) {
  document.querySelectorAll(`.add-cart[data-id="${id}"], .card-add[data-id="${id}"]`).forEach(b => {
    if (b.classList.contains("card-add")) {
      b.innerHTML = added ? '<i class="fas fa-check"></i>' : '<i class="fas fa-shopping-bag"></i>';
      b.classList.toggle("added", added);
    } else {
      b.innerHTML = added ? '<i class="fas fa-check"></i>' : '<i class="fas fa-shopping-bag"></i>';
      b.title = added ? "Added to cart" : "Add to cart";
    }
  });
  const detailBtn = $el("addToCartBtn");
  if (detailBtn) {
    detailBtn.innerHTML = added ? '<i class="fas fa-check"></i> Added to Cart' : '<i class="fas fa-shopping-bag"></i> Add to Cart';
    detailBtn.classList.toggle("btn-cyan", !added);
    detailBtn.classList.toggle("btn-primary", added);
    setTimeout(() => {
      detailBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
      detailBtn.classList.remove("btn-primary");
      detailBtn.classList.add("btn-cyan");
    }, 1500);
  }
  $el("prodMsg") && ($el("prodMsg").textContent = added ? "Added to cart!" : "");
}

async function toggleWish(id, event) {
  if (event) event.stopPropagation();
  if (!STATE.user) {
    showToast("Please login to add items to wishlist", "error");
    setTimeout(() => { location.href = "login.html"; }, 1500);
    return;
  }
  const res = await request("/api/wishlist", { method: "POST", body: { product_id: id } });
  if (res.success) {
    await loadCounts();
    if (res.action === "added") STATE.wishSet.add(id); else STATE.wishSet.delete(id);
    document.querySelectorAll(`.wish-btn[data-id="${id}"]`).forEach(b => {
      b.classList.toggle("wish-active", res.action === "added");
      const i = b.querySelector("i");
      if (i) i.className = res.action === "added" ? "fas fa-heart" : "far fa-heart";
    });
    updateWishBtn(id);
    showToast(res.action === "added" ? "Added to wishlist ❤️" : "Removed from wishlist");
    if (location.pathname.endsWith("wishlist.html")) loadWishlist();
  } else {
    showToast(res.message || "Failed", "error");
  }
}

function updateWishBtn(id) {
  const detailBtn = $el("wishToggleBtn");
  if (!detailBtn) return;
  const heart = detailBtn.querySelector("i");
  const text = detailBtn.querySelector("#wishText");
  if (STATE.wishSet.has(id)) {
    if (heart) heart.className = "fas fa-heart";
    if (text) text.textContent = "Added to Wishlist";
    detailBtn.classList.add("wish-active-btn");
  } else {
    if (heart) heart.className = "far fa-heart";
    if (text) text.textContent = "Add to Wishlist";
    detailBtn.classList.remove("wish-active-btn");
  }
}

async function quickView(id) {
  const p = STATE.products.find(x => x.id === id) || (await request("/api/products/" + id)).product;
  if (!p) return;
  // Navigate to product detail page
  location.href = "product.html?id=" + id;
}

async function loadCart() {
  const res = await request("/api/cart");
  STATE.cart = res.cart || [];
  STATE.cartMap = new Map(STATE.cart.map(i => [i.product_id, i]));
  const container = $el("cartItems");
  const empty = $el("cartEmpty");
  if (!container) return;
  if (STATE.cart.length === 0) {
    container.style.display = "none";
    if (empty) empty.style.display = "block";
    updateCartTotals([]);
    return;
  }
  if (empty) empty.style.display = "none";
  container.style.display = "flex";
  container.innerHTML = STATE.cart.map(item => {
    const price = item.discount_price || item.price;
    return `
      <div class="cart-item fade-in">
        <img src="${item.image}" alt="${item.name}" loading="lazy" onclick="appGoProduct(${item.product_id})" style="cursor:pointer;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80';">
        <div class="cart-item-info">
          <h4><a href="product.html?id=${item.product_id}" style="color:inherit;">${item.name}</a></h4>
          <p>Size: ${item.size || "N/A"} \u2022 ${item.category_name || "Sports"}</p>
        </div>
        <div class="cart-item-price">${formatPrice(price)}</div>
        <div class="cart-item-qty">
          <button onclick="appUpdateQty(${item.id}, -1)">\u2013</button>
          <span>${item.quantity}</span>
          <button onclick="appUpdateQty(${item.id}, 1)">+</button>
        </div>
        <div class="cart-item-remove" onclick="appRemoveCart(${item.id})"><i class="fas fa-trash"></i> Remove</div>
      </div>
    `;
  }).join("");
  updateCartTotals(STATE.cart);
  if (STATE.user) {
    if ($el("checkoutName") && !$el("checkoutName").value) $el("checkoutName").value = STATE.user.name || "";
    if ($el("checkoutEmail") && !$el("checkoutEmail").value) $el("checkoutEmail").value = STATE.user.email || "";
  }
  await loadCounts();
}

function updateCartTotals(items) {
  const subtotal = items.reduce((a, b) => a + ((b.discount_price || b.price) * (b.quantity || 1)), 0);
  const savings = items.reduce((a, b) => {
    if (b.discount_price) return a + ((b.price - b.discount_price) * (b.quantity || 1));
    return a;
  }, 0);
  $el("cartSubtotal") && ($el("cartSubtotal").textContent = formatPrice(subtotal));
  $el("cartTotal") && ($el("cartTotal").textContent = formatPrice(subtotal));
  $el("cartSavings") && ($el("cartSavings").textContent = savings > 0 ? ("You save " + formatPrice(savings)) : "");
  $el("cartItemCount") && ($el("cartItemCount").textContent = items.length + " item" + (items.length !== 1 ? "s" : "") + " in cart");
}

window.appUpdateQty = async function (id, delta) {
  const item = STATE.cart.find(x => x.id === id);
  if (!item) return;
  const newQty = (item.quantity || 1) + delta;
  if (newQty < 1) { appRemoveCart(id); return; }
  await request("/api/cart/" + id, { method: "PUT", body: { quantity: newQty } });
  loadCart();
};

window.appRemoveCart = async function (id) {
  await request("/api/cart/" + id, { method: "DELETE" });
  loadCart();
  showToast("Item removed from cart");
};

async function placeOrder() {
  if (!STATE.user) { showToast("Please login to place order", "error"); location.href = "login.html"; return; }
  const name = $el("checkoutName") ? $el("checkoutName").value.trim() : "";
  const email = $el("checkoutEmail") ? $el("checkoutEmail").value.trim() : "";
  const phone = $el("checkoutPhone") ? $el("checkoutPhone").value.trim() : "";
  if (!name || !email || !phone) { showToast("Please fill all checkout details", "error"); return; }
  const total = STATE.cart.reduce((a, b) => a + ((b.discount_price || b.price) * (b.quantity || 1)), 0);
  const res = await request("/api/orders", { method: "POST", body: { total } });
  if (res.success) {
    $el("orderMsg") && ($el("orderMsg").textContent = "Order placed successfully! Order #" + res.orderId);
    $el("orderMsg") && ($el("orderMsg").style.color = "#26de81");
    STATE.cart = [];
    STATE.cartMap = new Map();
    await loadCounts();
    loadCart();
    showToast("🎉 Order placed successfully!");
  } else {
    showToast(res.message || "Order failed", "error");
  }
}

async function loadWishlist() {
  const res = await request("/api/wishlist");
  STATE.wishlist = res.wishlist || [];
  STATE.wishSet = new Set(STATE.wishlist.map(i => i.product_id));
  const container = $el("wishlistItems");
  const empty = $el("wishlistEmpty");
  if (!container) return;
  if (STATE.wishlist.length === 0) {
    container.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  container.innerHTML = STATE.wishlist.map(item => {
    const price = item.discount_price || item.price;
    return `
      <div class="wishlist-item fade-in">
        <img src="${item.image}" alt="${item.name}" loading="lazy" onclick="appGoProduct(${item.product_id})" style="cursor:pointer;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80';">
        <div class="wishlist-item-info">
          <h4><a href="product.html?id=${item.product_id}" style="color:inherit;">${item.name}</a></h4>
          <p>${item.category_name || "Sports"} \u2022 ${item.brand_name || ""}</p>
        </div>
        <div class="wishlist-item-price">${formatPrice(price)}</div>
        <div class="wishlist-item-actions">
          <button class="btn btn-sm btn-cyan" onclick="addToCart(${item.product_id}, 1, null, null)"><i class="fas fa-shopping-bag"></i> Add to Cart</button>
          <div class="wishlist-item-remove" onclick="toggleWish(${item.product_id}, null)"><i class="fas fa-trash"></i> Remove</div>
        </div>
      </div>
    `;
  }).join("");
  await loadCounts();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $el("loginEmail").value.trim();
  const password = $el("loginPassword").value;
  const err = $el("loginError");
  const btn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    err && (err.textContent = "Please fill in all fields");
    err && (err.style.display = "block");
    return;
  }

  // Show loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
  }

  err && (err.style.display = "none");
  const res = await request("/api/login", { method: "POST", body: { email, password } });
  if (res.success) {
    STATE.user = res.user;
    updateAuthUI();
    await loadCounts();
    showToast("Welcome back, " + STATE.user.name + "! 👋");
    setTimeout(() => { location.href = "index.html"; }, 500);
  } else {
    err && (err.textContent = res.message || "Login failed. Please check your credentials.");
    err && (err.style.display = "block");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = $el("regName").value.trim();
  const email = $el("regEmail").value.trim();
  const password = $el("regPassword").value;
  const confirm = $el("regConfirmPassword").value;
  const err = $el("registerError");
  const btn = e.target.querySelector('button[type="submit"]');

  err && (err.style.display = "none");
  if (!name || !email || !password || !confirm) { err && (err.textContent = "All fields are required"); err && (err.style.display = "block"); return; }
  if (password !== confirm) { err && (err.textContent = "Passwords do not match"); err && (err.style.display = "block"); return; }
  if (password.length < 6) { err && (err.textContent = "Password must be at least 6 characters"); err && (err.style.display = "block"); return; }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
  }

  const res = await request("/api/register", { method: "POST", body: { name, email, password } });
  if (res.success) {
    STATE.user = res.user;
    updateAuthUI();
    await loadCounts();
    showToast("Account created successfully! 🎉");
    setTimeout(() => { location.href = "index.html"; }, 500);
  } else {
    err && (err.textContent = res.message || "Registration failed");
    err && (err.style.display = "block");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
  }
}

function initSearch() {
  const input = $el("topSearch");
  const sugg = $el("searchSuggestions");
  const searchBtn = $el("searchBtn");
  if (!input) return;

  // Search button click
  if (searchBtn) {
    searchBtn.onclick = () => {
      const q = input.value.trim();
      if (q) {
        location.href = "products.html?q=" + encodeURIComponent(q);
      }
    };
  }

  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { sugg && (sugg.style.display = "none"); return; }
    timer = setTimeout(async () => {
      const res = await request("/api/products?q=" + encodeURIComponent(q) + "&limit=6");
      const products = res.products || [];
      if (sugg) {
        if (products.length) {
          sugg.innerHTML = products.map(p => `
            <div class="sugg-item" onclick="appGoProduct(${p.id})">
              <span class="label">${p.name}</span>
              <span class="price">${formatPrice(p.discount_price || p.price)}</span>
            </div>
          `).join("");
          sugg.style.display = "block";
        } else {
          sugg.innerHTML = '<div class="sugg-item" style="justify-content:center;color:var(--text-muted);">No products found</div>';
          sugg.style.display = "block";
        }
      }
    }, 250);
  });
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sugg && (sugg.style.display = "none");
      STATE.filters.q = input.value;
      location.href = "products.html?q=" + encodeURIComponent(input.value);
    }
  });
  document.addEventListener("click", (e) => {
    if (sugg && !sugg.contains(e.target) && e.target !== input) sugg.style.display = "none";
  });
  const qs = new URLSearchParams(location.search);
  if (qs.get("q")) { input.value = qs.get("q"); STATE.filters.q = qs.get("q"); }
}

window.appGoProduct = function (id) {
  location.href = "product.html?id=" + id;
};

function initMobileMenu() {
  const btn = $el("mobileMenu");
  const links = document.querySelector(".nav-links");
  if (btn && links) {
    btn.onclick = () => { links.classList.toggle("show-mobile"); };
  }
}

function initHomeFilters() {
  const tabs = $el("sportTabs");
  if (!tabs) return;
}

function initCartPage() {
  const place = $el("placeOrderBtn");
  if (place) place.addEventListener("click", placeOrder);
}

function initAuthPages() {
  const loginForm = $el("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  const registerForm = $el("registerForm");
  if (registerForm) registerForm.addEventListener("submit", handleRegister);
}

// Navigation icon clicks
function initNavIcons() {
  const cartIcon = $el("cartIcon");
  if (cartIcon) cartIcon.onclick = () => { location.href = "cart.html"; };
  const wishIcon = $el("wishIcon");
  if (wishIcon) wishIcon.onclick = () => { location.href = "wishlist.html"; };
  const userBtn = $el("userBtn");
  if (userBtn) {
    userBtn.onclick = () => {
      if (!STATE.user) {
        location.href = "login.html";
      }
    };
  }
  // Brand logo click -> home
  const brand = document.querySelector(".brand");
  if (brand) {
    brand.style.cursor = "pointer";
    brand.onclick = () => { location.href = "index.html"; };
  }
}

// Qty controls on product detail page
function initQtyControls() {
  const qtyMinus = $el("qtyMinus");
  const qtyPlus = $el("qtyPlus");
  const qtyInput = $el("prodQty");
  if (qtyMinus && qtyInput) {
    qtyMinus.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    };
  }
  if (qtyPlus && qtyInput) {
    qtyPlus.onclick = () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val < 99) qtyInput.value = val + 1;
    };
  }
}

// Review form
function initReviewForm() {
  const form = $el("reviewForm");
  if (form) form.addEventListener("submit", submitReview);

  // Star rating selector
  const starBtns = document.querySelectorAll(".star-select-btn");
  starBtns.forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.value;
      if ($el("reviewRating")) $el("reviewRating").value = val;
      starBtns.forEach((b, i) => {
        b.innerHTML = i < parseInt(val) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        b.classList.toggle("active", i < parseInt(val));
      });
    };
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initNavIcons();
  initSearch();
  initMobileMenu();
  initQtyControls();
  initReviewForm();

  // Load user session first
  await loadUser();

  await loadCategories();
  await loadBrands();

  if ($el("homeProducts")) { await renderHomeProducts(); await loadDeals(); }
  if ($el("productList")) await initProductsPage();
  if ($el("prodName")) await initProductDetail();
  if ($el("cartItems")) { initCartPage(); await loadCart(); }
  if ($el("wishlistItems")) await loadWishlist();
  if ($el("loginForm") || $el("registerForm")) initAuthPages();
});
