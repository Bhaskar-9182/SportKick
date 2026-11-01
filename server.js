try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch (e) {
  // Optional .env file
}

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

// Production reverse proxy support (Render, Railway, Fly.io, Nginx, Cloudflare)
if (isProd) {
  app.set("trust proxy", 1);
}

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session Configuration
app.use(session({
  name: "sportkick_sid",
  secret: process.env.SESSION_SECRET || "sportkick_secret_key_2026_premium",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Static files with HTTP caching in production
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: isProd ? "1d" : 0,
  etag: true
}));

app.get("/api/health", (req, res) => res.json({ ok: true, server: "SportKick" }));

app.get("/api/categories", (req, res) => {
  const rows = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json({ success: true, categories: rows });
});

app.get("/api/brands", (req, res) => {
  const rows = db.prepare("SELECT * FROM brands ORDER BY name").all();
  res.json({ success: true, brands: rows });
});

app.get("/api/products", (req, res) => {
  try {
    let { category, brand, q, min, max, size, sort, featured, trending, new_arrival, page, limit } = req.query;
    let sql = `SELECT p.*, c.name AS category_name, c.color AS category_color, b.name AS brand_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id WHERE 1=1`;
    const params = [];
    if (category) { sql += " AND c.slug = ?"; params.push(category); }
    if (brand) { sql += " AND b.name = ?"; params.push(brand); }
    if (q) { sql += " AND (p.name LIKE ? OR p.description LIKE ? OR p.short_desc LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (min) { sql += " AND p.price >= ?"; params.push(parseFloat(min)); }
    if (max) { sql += " AND p.price <= ?"; params.push(parseFloat(max)); }
    if (size) { sql += " AND p.size LIKE ?"; params.push(`%${size}%`); }
    if (featured === "1") sql += " AND p.featured = 1";
    if (trending === "1") sql += " AND p.trending = 1";
    if (new_arrival === "1") sql += " AND p.new_arrival = 1";
    if (sort === "price_asc") sql += " ORDER BY p.price ASC";
    else if (sort === "price_desc") sql += " ORDER BY p.price DESC";
    else if (sort === "rating") sql += " ORDER BY p.rating DESC";
    else sql += " ORDER BY p.created_at DESC";

    const pLimit = Math.min(parseInt(limit) || 24, 100);
    const pPage = Math.max(parseInt(page) || 1, 1);
    const offset = (pPage - 1) * pLimit;
    sql += " LIMIT ? OFFSET ?";
    params.push(pLimit, offset);

    const countSql = `SELECT COUNT(*) AS total FROM (${sql.replace(/ LIMIT \? OFFSET \?$/, "")})`;
    const countParams = params.slice(0, -2);
    const totalRow = db.prepare(countSql).get(...countParams);
    const total = totalRow.total;

    const rows = db.prepare(sql).all(...params);
    rows.forEach((r) => {
      try { r.images = JSON.parse(r.images || "[]"); } catch (e) { r.images = [r.image]; }
    });
    res.json({ success: true, products: rows, total, page: pPage, limit: pLimit });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/api/products/:id", (req, res) => {
  const row = db.prepare(`SELECT p.*, c.name AS category_name, c.color AS category_color, b.name AS brand_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands b ON p.brand_id = b.id WHERE p.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Product not found" });
  try { row.images = JSON.parse(row.images || "[]"); } catch (e) { row.images = [row.image]; }
  res.json({ success: true, product: row });
});

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: "All fields are required" });
  if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: "Invalid email address" });
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return res.status(400).json({ success: false, message: "Email already registered" });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(name, email, hash);
  req.session.userId = info.lastInsertRowid;
  req.session.userName = name;
  req.session.userEmail = email;
  req.session.userRole = "customer";
  res.json({ success: true, user: { id: info.lastInsertRowid, name, email, role: "customer" } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(400).json({ success: false, message: "Invalid email or password" });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(400).json({ success: false, message: "Invalid email or password" });
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;
  req.session.userRole = user.role;
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.clearCookie("sportkick_sid").json({ success: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ success: false, user: null });
  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.json({ success: false, user: null });
  res.json({ success: true, user });
});

function cartKey(req) {
  return req.session && req.session.userId ? `user_id = ${req.session.userId}` : `session_id = '${req.sessionID}'`;
}

app.get("/api/cart", (req, res) => {
  const rows = db.prepare(`SELECT c.*, p.name, p.price, p.discount_price, p.image, p.stock, p.size AS product_size FROM cart c JOIN products p ON c.product_id = p.id WHERE ${cartKey(req)} ORDER BY c.created_at DESC`).all();
  res.json({ success: true, cart: rows });
});

app.post("/api/cart", (req, res) => {
  const { product_id, quantity = 1, size } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: "Product is required" });
  const prod = db.prepare("SELECT stock FROM products WHERE id = ?").get(product_id);
  if (!prod) return res.status(404).json({ success: false, message: "Product not found" });
  const key = cartKey(req);
  const existing = db.prepare(`SELECT * FROM cart WHERE ${key} AND product_id = ?`).get(product_id);
  const newQty = existing ? (existing.quantity || 1) + parseInt(quantity) : parseInt(quantity);
  if (newQty > prod.stock) return res.status(400).json({ success: false, message: "Not enough stock available" });
  if (existing) {
    db.prepare(`UPDATE cart SET quantity = ? WHERE ${key} AND product_id = ?`).run(newQty, product_id);
  } else {
    const idPart = key.includes("user_id") ? req.session.userId : req.sessionID;
    const col = key.includes("user_id") ? "user_id" : "session_id";
    db.prepare(`INSERT INTO cart (${col}, product_id, quantity, size) VALUES (?, ?, ?, ?)`).run(idPart, product_id, newQty, size || null);
  }
  res.json({ success: true, message: "Added to cart" });
});

app.put("/api/cart/:id", (req, res) => {
  const { quantity } = req.body;
  const qty = parseInt(quantity);
  if (qty < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
  db.prepare(`UPDATE cart SET quantity = ? WHERE id = ? AND ${cartKey(req)}`).run(qty, req.params.id);
  res.json({ success: true });
});

app.delete("/api/cart/:id", (req, res) => {
  db.prepare(`DELETE FROM cart WHERE id = ? AND ${cartKey(req)}`).run(req.params.id);
  res.json({ success: true });
});

app.get("/api/wishlist", (req, res) => {
  const rows = db.prepare(`SELECT w.*, p.name, p.price, p.discount_price, p.image FROM wishlist w JOIN products p ON w.product_id = p.id WHERE ${cartKey(req)} ORDER BY w.created_at DESC`).all();
  res.json({ success: true, wishlist: rows });
});

app.post("/api/wishlist", (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: "Product is required" });
  const key = cartKey(req);
  const existing = db.prepare(`SELECT * FROM wishlist WHERE ${key} AND product_id = ?`).get(product_id);
  if (existing) {
    db.prepare(`DELETE FROM wishlist WHERE id = ?`).run(existing.id);
    return res.json({ success: true, action: "removed" });
  }
  const idPart = key.includes("user_id") ? req.session.userId : req.sessionID;
  const col = key.includes("user_id") ? "user_id" : "session_id";
  db.prepare(`INSERT INTO wishlist (${col}, product_id) VALUES (?, ?)`).run(idPart, product_id);
  res.json({ success: true, action: "added" });
});

app.delete("/api/wishlist/:id", (req, res) => {
  db.prepare(`DELETE FROM wishlist WHERE id = ? AND ${cartKey(req)}`).run(req.params.id);
  res.json({ success: true });
});

app.post("/api/orders", (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ success: false, message: "Please login to place an order" });
  const { total } = req.body;
  if (!total || parseFloat(total) <= 0) return res.status(400).json({ success: false, message: "Invalid order total" });
  const info = db.prepare("INSERT INTO orders (user_id, total) VALUES (?, ?)").run(req.session.userId, parseFloat(total));
  db.prepare(`DELETE FROM cart WHERE user_id = ?`).run(req.session.userId);
  res.json({ success: true, orderId: info.lastInsertRowid, total: parseFloat(total) });
});

app.get("/api/products/:id/reviews", (req, res) => {
  const rows = db.prepare(`SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC`).all(req.params.id);
  res.json({ success: true, reviews: rows });
});

app.post("/api/products/:id/reviews", (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ success: false, message: "Please login to write a review" });
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
  db.prepare(`INSERT INTO product_reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)`).run(req.params.id, req.session.userId, req.session.userName, parseInt(rating), comment || "");
  const stats = db.prepare(`SELECT COUNT(*) AS cnt, AVG(rating) AS avg FROM product_reviews WHERE product_id = ?`).get(req.params.id);
  db.prepare(`UPDATE products SET reviews = ?, rating = ROUND(?, 2) WHERE id = ?`).run(stats.cnt, Math.round(stats.avg * 10) / 10, req.params.id);
  res.json({ success: true, message: "Review submitted" });
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API endpoint not found" });
  }
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).json({
    success: false,
    message: isProd ? "Internal server error" : err.message
  });
});

const server = app.listen(PORT, () => {
  console.log(`SportKick server running in ${isProd ? "production" : "development"} mode at http://localhost:${PORT}`);
});

// Graceful process shutdown
function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    try { db.close(); } catch (e) {}
    console.log("Closed remaining connections. Exiting process.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
