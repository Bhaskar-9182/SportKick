const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "sportkick.db"));
db.pragma("journal_mode = WAL");

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#00d4ff',
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      logo TEXT,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      short_desc TEXT,
      price REAL NOT NULL,
      discount_price REAL,
      category_id INTEGER,
      brand_id INTEGER,
      size TEXT,
      color TEXT,
      stock INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      reviews INTEGER DEFAULT 0,
      image TEXT,
      images TEXT,
      featured INTEGER DEFAULT 0,
      trending INTEGER DEFAULT 0,
      new_arrival INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_id TEXT,
      product_id INTEGER,
      quantity INTEGER DEFAULT 1,
      size TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_id TEXT,
      product_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

function seed() {
  const catCount = db.prepare("SELECT COUNT(*) AS c FROM categories").get().c;
  if (catCount > 0) return;

  const insertCat = db.prepare("INSERT INTO categories (name, slug, color, image) VALUES (?, ?, ?, ?)");
  const categories = [
    ["Running", "running", "#00d4ff", "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80"],
    ["Basketball", "basketball", "#ff6b6b", "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80"],
    ["Football", "football", "#4ecdc4", "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80"],
    ["Cricket", "cricket", "#ffe66d", "https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80"],
    ["Tennis", "tennis", "#a55eea", "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80"],
    ["Badminton", "badminton", "#26de81", "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80"],
    ["Gym & Training", "gym-training", "#ff9ff3", "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80"],
    ["Hiking", "hiking", "#70a1ff", "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80"],
    ["Swimming", "swimming", "#38d1c4", "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80"],
  ];
  categories.forEach((c) => insertCat.run(c[0], c[1], c[2], c[3]));

  const insertBrand = db.prepare("INSERT INTO brands (name, logo, image) VALUES (?, ?, ?)");
  const brands = [
    ["Nike", "N", "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=600&q=80"],
    ["Adidas", "A", "https://images.unsplash.com/photo-1608233927761-4c1b96781e1a?w=600&q=80"],
    ["Puma", "P", "https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=600&q=80"],
    ["Reebok", "R", "https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&q=80"],
    ["Under Armour", "U", "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&q=80"],
    ["New Balance", "NB", "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80"],
    ["Asics", "AS", "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80"],
    ["Jordan", "J", "https://images.unsplash.com/photo-1549298812-a4e3bc46b0f7?w=600&q=80"],
    ["Yonex", "Y", "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=600&q=80"],
    ["Skechers", "SK", "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600&q=80"],
  ];
  brands.forEach((b) => insertBrand.run(b[0], b[1], b[2]));

  const catMap = {};
  db.prepare("SELECT id, slug FROM categories").all().forEach((c) => { catMap[c.slug] = c.id; });
  const brandMap = {};
  db.prepare("SELECT id, name FROM brands").all().forEach((b) => { brandMap[b.name] = b.id; });

  const insertProd = db.prepare(`
    INSERT INTO products (name, description, short_desc, price, discount_price, category_id, brand_id, size, color, stock, rating, reviews, image, images, featured, trending, new_arrival)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    ["Nike Air Zoom Pegasus 41", "Premium running shoes with responsive ZoomX cushioning for daily miles and race day speed.", "Responsive cushioning for daily miles", 12999, 10999, catMap.running, brandMap.Nike, "7,8,9,10,11,12", "White/Electric", 50, 4.5, 2, "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80", "[\"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80\",\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\",\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\",\"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80\"]", 1, 1, 1],
    ["Adidas Ultraboost 23", "Energy-returning BOOST midsole with Primeknit upper for endless comfort on every run.", "Endless comfort with BOOST", 17999, null, catMap.running, brandMap.Adidas, "7,8,9,10,11,12", "Core Black", 40, 4.5, 2, "https://images.unsplash.com/photo-1608233927761-4c1b96781e1a?w=800&q=80", "[\"https://images.unsplash.com/photo-1608233927761-4c1b96781e1a?w=800&q=80\",\"https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80\",\"https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 1, 0, 0],
    ["Puma Future Z 1.4", "Agile football boots with Fuzionfit+ compression for quick cuts and explosive speed.", "Explosive speed on the pitch", 15999, 13999, catMap.football, brandMap.Puma, "7,8,9,10,11", "Vivid Blue", 35, 5, 2, "https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80", "[\"https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80\",\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\",\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\"]", 0, 1, 0],
    ["Nike LeBron XXII", "Maximum impact protection and court dominance for the modern basketball game.", "Court dominance", 19999, null, catMap.basketball, brandMap.Nike, "8,9,10,11,12,13", "Lakers Gold", 30, 4.5, 2, "https://images.unsplash.com/photo-1596644618356-910f61a23ec4?w=800&q=80", "[\"https://images.unsplash.com/photo-1596644618356-910f61a23ec4?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 1, 0, 1],
    ["Adidas Adizero Cricket", "Lightweight cricket spikes with grippy outsole for pitch perfection.", "Lightweight pitch spikes", 11999, null, catMap.cricket, brandMap.Adidas, "7,8,9,10,11", "White/Blue", 45, 4.5, 2, "https://images.unsplash.com/photo-1515976586959-95f1430e98e6?w=800&q=80", "[\"https://images.unsplash.com/photo-1515976586959-95f1430e98e6?w=800&q=80\",\"https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80\",\"https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?w=800&q=80\",\"https://images.unsplash.com/photo-1628926379972-9415c853a02a?w=800&q=80\"]", 0, 0, 0],
    ["Asics Gel-Resolution 9", "Tennis shoes built for lateral stability and comfort during intense rallies.", "Lateral stability", 14999, 12999, catMap.tennis, brandMap.Asics, "7,8,9,10,11", "White/Silver", 40, 4.5, 2, "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80", "[\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800&q=80\",\"https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80\",\"https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80\"]", 0, 1, 0],
    ["Nike Metcon 9", "Stable, flat-heeled training shoes for every gym session and HIIT workout.", "Stable training base", 12999, null, catMap["gym-training"], brandMap.Nike, "7,8,9,10,11,12", "Black/White", 55, 4.5, 2, "https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80", "[\"https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80\",\"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80\",\"https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80\",\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\"]", 0, 0, 1],
    ["Salomon Speedcross 6", "Aggressive hiking shoes with deep lugs for muddy trails and technical terrain.", "Trail domination", 16999, null, catMap.hiking, brandMap["New Balance"], "7,8,9,10,11", "Black/Magnet", 30, 5, 2, "https://images.unsplash.com/photo-1540960384215-9e9b8d3c8e71?w=800&q=80", "[\"https://images.unsplash.com/photo-1540960384215-9e9b8d3c8e71?w=800&q=80\",\"https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80\",\"https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80\",\"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80\"]", 0, 0, 0],
    ["Nike Dri-FIT Academy Jersey", "Breathable, sweat-wicking football jersey for match days and training.", "Sweat-wicking jersey", 4999, 3999, catMap.football, brandMap.Nike, "S,M,L,XL", "Royal Blue", 60, 4.5, 2, "https://images.unsplash.com/photo-1574694168278-9447c3cc8991?w=800&q=80", "[\"https://images.unsplash.com/photo-1574694168278-9447c3cc8991?w=800&q=80\",\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\"]", 0, 0, 1],
    ["Adidas Running Shorts", "Lightweight running shorts with inner liner and secure zip pocket.", "Lightweight runner shorts", 3999, null, catMap.running, brandMap.Adidas, "S,M,L,XL", "Black", 50, 4.5, 2, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80", "[\"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80\",\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80\"]", 0, 0, 0],
    ["Puma Essentials Hoodie", "Cosy fleece hoodie for gym warm-ups and casual streetwear.", "Cosy gym fleece", 5999, 4999, catMap["gym-training"], brandMap.Puma, "S,M,L,XL", "Heather Grey", 40, 4.5, 2, "https://images.unsplash.com/photo-1556821749-42718101a182?w=800&q=80", "[\"https://images.unsplash.com/photo-1556821749-42718101a182?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\"]", 0, 1, 0],
    ["Under Armour HOVR Sonic", "Connected running shoes with real-time form coaching via UA MapMyRun.", "Connected run coaching", 13999, 11999, catMap.running, brandMap["Under Armour"], "7,8,9,10,11", "Steel/Black", 35, 4.5, 2, "https://images.unsplash.com/photo-1549279071418-ed5357ceee8e?w=800&q=80", "[\"https://images.unsplash.com/photo-1549279071418-ed5357ceee8e?w=800&q=80\",\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\",\"https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80\",\"https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80\"]", 0, 0, 0],
    ["New Balance Fresh Foam 880", "Plush cushioning for long-distance running comfort mile after mile.", "Plush long-distance comfort", 14499, null, catMap.running, brandMap["New Balance"], "7,8,9,10,11,12", "White/Grey", 45, 5, 2, "https://images.unsplash.com/photo-1600186172319-49cc44c9a1a4?w=800&q=80", "[\"https://images.unsplash.com/photo-1600186172319-49cc44c9a1a4?w=800&q=80\",\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\",\"https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80\"]", 0, 0, 0],
    ["Jordan Air 1 Retro High", "Iconic streetwear sneaker with heritage design for all-season style.", "Heritage streetwear", 17999, null, catMap.basketball, brandMap.Jordan, "8,9,10,11,12", "Chicago", 25, 4.5, 2, "https://images.unsplash.com/photo-1549298812-a4e3bc46b0f7?w=800&q=80", "[\"https://images.unsplash.com/photo-1549298812-a4e3bc46b0f7?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\",\"https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80\",\"https://images.unsplash.com/photo-1596644618356-910f61a23ec4?w=800&q=80\"]", 1, 0, 0],
    ["Nike ZoomX Vaporfly 3", "Carbon-fiber plate racing shoe built for marathon PRs and elite speed.", "Race day carbon rocket", 24999, 21999, catMap.running, brandMap.Nike, "7,8,9,10,11", "Volt/Black", 20, 4.5, 2, "https://images.unsplash.com/photo-1537907139028-896da427a60a?w=800&q=80", "[\"https://images.unsplash.com/photo-1537907139028-896da427a60a?w=800&q=80\",\"https://images.unsplash.com/photo-1575537302964-96cd47c06b1b?w=800&q=80\",\"https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 1, 1, 0],
    ["Adidas Harden Vol. 7", "Basketball shoe with lightweight Boost and lockdown fit for aggressive guards.", "Guard-grade lockdown", 15999, 13499, catMap.basketball, brandMap.Adidas, "8,9,10,11,12", "Core Black/Gold", 28, 4.5, 61, "https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80", "[\"https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80\",\"https://images.unsplash.com/photo-1608233927761-4c1b96781e1a?w=800&q=80\",\"https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80\",\"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80\"]", 0, 1, 0],
    ["Puma King Platinum", "Classic leather football boot with KINGForm technology for soft ground control.", "Classic leather touch", 12999, 10499, catMap.football, brandMap.Puma, "7,8,9,10,11", "White/Black", 33, 4.4, 52, "https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80", "[\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\",\"https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80\",\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\"]", 0, 0, 1],
    ["Reebok Nano X3", "Versatile cross-training shoe with Flexweave upper for HIIT and weightlifting.", "All-around training", 11999, null, catMap["gym-training"], brandMap.Reebok, "7,8,9,10,11", "All White", 38, 4.3, 97, "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80", "[\"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80\",\"https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80\",\"https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 0, 0, 0],
    ["Asics Gel-Kayano 30", "Stability running shoe with 4D Guidance System for overpronators seeking comfort.", "Stability for long runs", 15999, 13499, catMap.running, brandMap.Asics, "7,8,9,10,11,12", "Black/Silver", 32, 4.6, 73, "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80", "[\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\",\"https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80\"]", 0, 0, 1],
    ["Jordan Tatum 3", "Signature basketball shoe for Jayson Tatum with responsive cushioning and traction.", "Signature court play", 13999, null, catMap.basketball, brandMap.Jordan, "8,9,10,11,12", "University Red", 22, 4.7, 44, "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80", "[\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1549298812-a4e3bc46b0f7?w=800&q=80\",\"https://images.unsplash.com/photo-1596644618356-910f61a23ec4?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\"]", 0, 1, 0],
    ["New Balance 574 Classic", "Timeless lifestyle sneaker with suede/mesh upper and ENCAP midsole comfort.", "Everyday heritage", 9999, null, catMap.running, brandMap["New Balance"], "7,8,9,10,11", "Grey/Navy", 40, 4.4, 156, "https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80", "[\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\",\"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80\",\"https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80\"]", 0, 0, 0],
    ["Under Armour Project Rock", "Training shoe built with Dwayne Johnson for the hardest workouts in the gym.", "Iron paradise ready", 12999, 10999, catMap["gym-training"], brandMap["Under Armour"], "7,8,9,10,11", "Black/Graphite", 26, 4.5, 68, "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80", "[\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\",\"https://images.unsplash.com/photo-1549279071418-ed5357ceee8e?w=800&q=80\",\"https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80\",\"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80\"]", 0, 0, 0],
    ["Nike Court Lite 3", "Tennis shoe with durable outsole and Zoom Air for aggressive court movement.", "Court warrior", 9999, null, catMap.tennis, brandMap.Nike, "7,8,9,10,11", "White/Blue", 29, 4.3, 41, "https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800&q=80", "[\"https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800&q=80\",\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80\",\"https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80\"]", 0, 0, 0],
    ["Nike React Infinity Run 4", "Injury-reducing running shoe with a wider forefoot and Flyknit upper that hugs every curve of your foot.", "Injury-reducing daily runner", 14999, 12499, catMap.running, brandMap.Nike, "7,8,9,10,11,12", "White/Platinum", 42, 4.6, 134, "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80", "[\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\",\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\",\"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80\",\"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80\"]", 1, 0, 1],
    ["Adidas Predator Accuracy.1 FG", "Dominate the pitch with textured Hybridtouch upper for deadly spin and swerve on every pass.", "Deadly spin control", 18999, 15999, catMap.football, brandMap.Adidas, "7,8,9,10,11", "Solar Red/Black", 28, 4.7, 87, "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80", "[\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\",\"https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80\",\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\"]", 0, 1, 0],
    ["Puma Velocity Nitro 3", "Nitrogen-infused midsole foam delivers featherlight energy return for tempo runs and daily training.", "Featherlight energy return", 11999, 9999, catMap.running, brandMap.Puma, "7,8,9,10,11", "Electric Blue", 55, 4.4, 98, "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800&q=80", "[\"https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800&q=80\",\"https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80\",\"https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\"]", 0, 0, 1],
    ["Reebok Floatride Energy 5", "Award-winning lightweight racer with Floatride Energy foam for responsive, bouncy strides.", "Award-winning racer", 10999, null, catMap.running, brandMap.Reebok, "7,8,9,10,11", "Neon Mint/White", 38, 4.3, 72, "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80", "[\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\",\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80\",\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\"]", 0, 0, 0],
    ["Under Armour Curry 11", "Stephen Curry's latest signature shoe with UA Flow cushioning for quick handles and smooth jumpers.", "Curry's court magic", 16999, 14499, catMap.basketball, brandMap["Under Armour"], "8,9,10,11,12", "Dub Nation Blue", 24, 4.8, 115, "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80", "[\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\",\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\",\"https://images.unsplash.com/photo-1549279071418-ed5357ceee8e?w=800&q=80\",\"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80\"]", 1, 1, 1],
    ["Yonex Power Cushion 65 Z3", "Badminton shoes with Yonex's signature Power Cushion technology for explosive lunges and quick recoveries.", "Explosive court movement", 8999, 7499, catMap.badminton, brandMap.Yonex, "6,7,8,9,10,11", "White/Red", 60, 4.6, 143, "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80", "[\"https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80\",\"https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80\",\"https://images.unsplash.com/photo-1578763363228-6e8428c5e05d?w=800&q=80\",\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\"]", 1, 1, 0],
    ["Skechers Max Cushioning Elite", "Ultra-plush Hyper Burst midsole and Goodyear rubber outsole for all-day comfort on long walks and runs.", "Ultra-plush all-day comfort", 9999, 7999, catMap.running, brandMap.Skechers, "7,8,9,10,11,12", "Black/White", 48, 4.5, 167, "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80", "[\"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80\",\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\",\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\",\"https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80\"]", 0, 0, 1],
    ["Nike Dri-FIT Training Tee", "Moisture-wicking Dri-FIT fabric keeps you dry through the toughest gym sessions and outdoor workouts.", "Stay dry, stay focused", 2999, null, catMap["gym-training"], brandMap.Nike, "S,M,L,XL,XXL", "Black", 120, 4.4, 210, "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80", "[\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\"]", 0, 0, 0],
    ["Adidas Terrex AX4 Hiking Shoes", "Rugged Continental rubber outsole with Traxion grip for tackling rocky trails and muddy paths with confidence.", "Rugged trail confidence", 12999, 10999, catMap.hiking, brandMap.Adidas, "7,8,9,10,11", "Olive/Black", 34, 4.5, 79, "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80", "[\"https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80\",\"https://images.unsplash.com/photo-1540960384215-9e9b8d3c8e71?w=800&q=80\",\"https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80\",\"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80\"]", 0, 0, 1],
    ["Puma Essentials Training Tank", "Lightweight dryCELL tank top designed for unrestricted movement during high-intensity training.", "Unrestricted training", 2499, 1999, catMap["gym-training"], brandMap.Puma, "S,M,L,XL", "Forest Green", 85, 4.2, 56, "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80", "[\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80\"]", 0, 0, 0],
    ["Nike KD 16", "Kevin Durant's signature shoe with full-length Air Zoom Strobel for explosive take-offs and soft landings.", "KD's explosive take-offs", 15999, null, catMap.basketball, brandMap.Nike, "8,9,10,11,12", "Midnight Navy", 30, 4.7, 88, "https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=800&q=80", "[\"https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=800&q=80\",\"https://images.unsplash.com/photo-1596644618356-910f61a23ec4?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80\"]", 0, 1, 0],
    ["Adidas Barricade Tennis Shoes", "Heavy-duty tennis shoe with Adiwear outsole that outlasts even the most gruelling clay and hard-court seasons.", "Built to outlast", 13999, 11999, catMap.tennis, brandMap.Adidas, "7,8,9,10,11", "Ecru Tint/Blue", 36, 4.5, 64, "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80", "[\"https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80\",\"https://images.unsplash.com/photo-1562183241-b937e95585b6?w=800&q=80\",\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80\"]", 0, 0, 0],
    ["Yonex Astrox 88D Pro Racquet", "Head-heavy badminton racquet with Rotational Generator System for devastating steep smashes.", "Devastating smash power", 12999, null, catMap.badminton, brandMap.Yonex, "G4,G5", "Black/Red", 25, 4.8, 92, "https://images.unsplash.com/photo-1578763363228-6e8428c5e05d?w=800&q=80", "[\"https://images.unsplash.com/photo-1578763363228-6e8428c5e05d?w=800&q=80\",\"https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80\",\"https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80\",\"https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80\"]", 1, 0, 1],
    ["Under Armour Tech 2.0 Tee", "Anti-odour, quick-dry fabric with 4-way stretch makes this the perfect everyday training partner.", "Quick-dry training partner", 3499, 2999, catMap["gym-training"], brandMap["Under Armour"], "S,M,L,XL,XXL", "Academy Blue", 100, 4.3, 178, "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80", "[\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\"]", 0, 0, 0],
    ["New Balance FuelCell Rebel v4", "Aggressive carbon-fiber infused racer for 5K to half marathon distances with FuelCell midsole.", "Aggressive race-day speed", 13999, 11499, catMap.running, brandMap["New Balance"], "7,8,9,10,11", "Neon Dragonfly", 30, 4.7, 83, "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80", "[\"https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80\",\"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80\",\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1600186172319-49cc44c9a1a4?w=800&q=80\"]", 0, 1, 1],
    ["Nike Phantom GX Elite FG", "Next-gen football boot with NikeSkin upper and Flyknit collar for a locked-in, barefoot-like feel.", "Barefoot ball control", 21999, 18999, catMap.football, brandMap.Nike, "7,8,9,10,11", "Bright Crimson", 22, 4.8, 76, "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80", "[\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\",\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\",\"https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80\"]", 1, 0, 1],
    ["Asics Gel-Nimbus 26", "Premium neutral running shoe with FF BLAST PLUS Eco cushioning for buttery-smooth long runs.", "Buttery-smooth long runs", 16999, null, catMap.running, brandMap.Asics, "7,8,9,10,11,12", "French Blue/Silver", 40, 4.7, 121, "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80", "[\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\",\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80\",\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\"]", 0, 0, 0],
    ["Puma One8 Cricket Bat", "Virat Kohli signature English willow cricket bat with premium handle for powerful stroke play.", "Kohli's signature willow", 14999, 12999, catMap.cricket, brandMap.Puma, "SH,LH", "Natural/Blue", 18, 4.6, 54, "https://images.unsplash.com/photo-1628926379972-9415c853a02a?w=800&q=80", "[\"https://images.unsplash.com/photo-1628926379972-9415c853a02a?w=800&q=80\",\"https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80\",\"https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?w=800&q=80\",\"https://images.unsplash.com/photo-1515976586959-95f1430e98e6?w=800&q=80\"]", 1, 1, 0],
    ["Skechers GOwalk 7", "Hands-free Slip-Ins with Hyper Burst cushioning for effortless everyday walking and light gym sessions.", "Effortless slip-on comfort", 7999, 6499, catMap["gym-training"], brandMap.Skechers, "7,8,9,10,11", "Taupe", 55, 4.4, 195, "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80", "[\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\",\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\"]", 0, 0, 0],
    ["Adidas Adistar Running Tights", "Supportive compression tights with moisture-managing AEROREADY technology for cool, dry runs.", "Supportive run compression", 4999, 3999, catMap.running, brandMap.Adidas, "S,M,L,XL", "Black/Reflective", 65, 4.5, 88, "https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80", "[\"https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80\",\"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\"]", 0, 0, 0],
    ["Nike Air Max 270", "Lifestyle sneaker featuring the tallest Air unit yet for maximum visible cushioning and all-day style.", "Maximum visible cushioning", 13999, null, catMap.running, brandMap.Nike, "7,8,9,10,11,12", "White/University Red", 45, 4.6, 232, "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80", "[\"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80\",\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\",\"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80\",\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\"]", 1, 0, 0],
    ["Under Armour Storm Backpack", "Water-resistant UA Storm technology backpack with padded laptop sleeve and adjustable HeatGear straps.", "Storm-proof gear carrier", 5999, 4999, catMap.hiking, brandMap["Under Armour"], "One Size", "Graphite", 70, 4.4, 112, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80", "[\"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80\",\"https://images.unsplash.com/photo-1546938576-6e6a64f317cc?w=800&q=80\",\"https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80\",\"https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80\"]", 0, 0, 1],
    ["Yonex Nanoray Light 18i Racquet", "Ultra-lightweight badminton racquet built for rapid swing speed and deceptive net play.", "Lightning-fast swing speed", 4999, null, catMap.badminton, brandMap.Yonex, "G4,G5", "Blue/Silver", 40, 4.3, 66, "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80", "[\"https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80\",\"https://images.unsplash.com/photo-1578763363228-6e8428c5e05d?w=800&q=80\",\"https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80\",\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\"]", 0, 0, 0],
    ["Nike Pro Compression Shorts", "Body-hugging Dri-FIT compression shorts with flat-seam construction for chafe-free gym and field sessions.", "Chafe-free compression", 3499, null, catMap["gym-training"], brandMap.Nike, "S,M,L,XL", "Black", 90, 4.3, 145, "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80", "[\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\",\"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80\",\"https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80\",\"https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80\"]", 0, 0, 0],
    ["Adidas Copa Pure.1 FG", "Fusion-skin leather football boot offering modern technology with timeless Copa touch and control.", "Timeless Copa touch", 16999, 14499, catMap.football, brandMap.Adidas, "7,8,9,10,11", "White/Gold", 26, 4.6, 59, "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80", "[\"https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80\",\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1617824811217-86f887463e0b?w=800&q=80\",\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\"]", 0, 0, 1],
    ["Puma Deviate Nitro 2", "Carbon plate running shoe with NITRO foam for responsive propulsion during tempo and race efforts.", "Carbon plate speed", 13999, 11999, catMap.running, brandMap.Puma, "7,8,9,10,11", "Fire Orchid", 33, 4.5, 71, "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80", "[\"https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=800&q=80\",\"https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800&q=80\",\"https://images.unsplash.com/photo-1582588678413-dbf45f4823e9?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\"]", 0, 1, 0],
    ["Reebok CrossFit Nano 6000", "Heritage-inspired cross-training shoe with Flexweave upper and ultra-grippy rubber outsole for WODs.", "WOD-ready heritage", 9999, 8499, catMap["gym-training"], brandMap.Reebok, "7,8,9,10,11", "Chalk/Black", 42, 4.4, 63, "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80", "[\"https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80\",\"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80\",\"https://images.unsplash.com/photo-1606107565327-dc922120a07e?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 0, 0, 0],
    ["Nike Swim Jammers", "Chlorine-resistant competitive swim jammers with streamlined fit for reduced drag in the pool.", "Streamlined pool performance", 3999, 3499, catMap.swimming, brandMap.Nike, "28,30,32,34,36", "Black/Volt", 50, 4.3, 48, "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80", "[\"https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80\",\"https://images.unsplash.com/photo-1612681621150-8d2f8c945cef?w=800&q=80\",\"https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80\",\"https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&q=80\"]", 0, 0, 1],
    ["Adidas Adizero SL Running Shoe", "Race-ready lightweight shoe with Lightstrike Pro cushioning that delivers speed at a fraction of the weight.", "Lightweight race-ready", 11999, 9999, catMap.running, brandMap.Adidas, "7,8,9,10,11", "Lucid Cyan", 37, 4.5, 94, "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80", "[\"https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80\",\"https://images.unsplash.com/photo-1608233927761-4c1b96781e1a?w=800&q=80\",\"https://images.unsplash.com/photo-1512374382149-233c42b661ac?w=800&q=80\",\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\"]", 0, 0, 0],
    ["Jordan Luka 2", "Luka Dončić's signature shoe with full-length Zoom Air for explosive first steps and smooth Euro-steps.", "Luka's Euro-step magic", 14999, null, catMap.basketball, brandMap.Jordan, "8,9,10,11,12", "Cement Grey", 28, 4.6, 52, "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80", "[\"https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&q=80\",\"https://images.unsplash.com/photo-1549298812-a4e3bc46b0f7?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\",\"https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80\"]", 0, 1, 0],
    ["Asics GT-2000 12", "Structured support running shoe with 3D Guidance System for stable, balanced strides mile after mile.", "Structured support system", 13499, 10999, catMap.running, brandMap.Asics, "7,8,9,10,11,12", "Black/Safety Yellow", 44, 4.5, 108, "https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80", "[\"https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80\",\"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80\",\"https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80\",\"https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800&q=80\"]", 0, 0, 0],
    ["New Balance Tekela v4+ FG", "Kinetic-stitch upper football boot for a second-skin feel and pinpoint passing accuracy.", "Second-skin ball feel", 15999, 13999, catMap.football, brandMap["New Balance"], "7,8,9,10,11", "Bright Lapis", 20, 4.5, 38, "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80", "[\"https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80\",\"https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80\",\"https://images.unsplash.com/photo-1606890658317-7d14490b76fd?w=800&q=80\",\"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80\"]", 0, 0, 1],
    ["Skechers D'Lites Hyper Burst", "Retro-styled chunky sneaker with ultra-lightweight Hyper Burst midsole for walking and casual wear.", "Retro comfort walker", 6999, 5499, catMap.running, brandMap.Skechers, "6,7,8,9,10,11", "White/Navy/Red", 60, 4.2, 185, "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80", "[\"https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80\",\"https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80\",\"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80\",\"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80\"]", 0, 0, 0],
    ["Adidas Swim Briefs", "Performance swim briefs with Infinitex+ fabric that resists chlorine and retains shape season after season.", "Chlorine-resistant swim gear", 2999, null, catMap.swimming, brandMap.Adidas, "28,30,32,34,36", "Navy/White", 65, 4.3, 57, "https://images.unsplash.com/photo-1612681621150-8d2f8c945cef?w=800&q=80", "[\"https://images.unsplash.com/photo-1612681621150-8d2f8c945cef?w=800&q=80\",\"https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80\",\"https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80\",\"https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&q=80\"]", 0, 0, 0],
    ["Puma Cricket One8 Bowling Shoes", "All-rounder cricket shoes with Virat Kohli design, featuring multi-directional studs for pace and spin bowlers.", "Kohli's bowling grip", 8999, 7499, catMap.cricket, brandMap.Puma, "7,8,9,10,11", "White/Green", 32, 4.4, 45, "https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?w=800&q=80", "[\"https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?w=800&q=80\",\"https://images.unsplash.com/photo-1515976586959-95f1430e98e6?w=800&q=80\",\"https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80\",\"https://images.unsplash.com/photo-1628926379972-9415c853a02a?w=800&q=80\"]", 0, 0, 0],
    ["Nike Yoga Dri-FIT Tank", "Ultra-soft, sweat-wicking yoga tank with a relaxed drape that moves with you through every flow.", "Flow-ready yoga comfort", 3499, 2999, catMap["gym-training"], brandMap.Nike, "S,M,L,XL", "Smokey Mauve", 75, 4.5, 130, "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80", "[\"https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80\",\"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80\",\"https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&q=80\",\"https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80\"]", 0, 0, 0],
    ["Under Armour Charged Assert 10", "Lightweight mesh running shoe with Charged Cushioning midsole for a smooth, connected ride.", "Smooth connected ride", 8999, null, catMap.running, brandMap["Under Armour"], "7,8,9,10,11,12", "Black/White", 50, 4.3, 162, "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80", "[\"https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80\",\"https://images.unsplash.com/photo-1549279071418-ed5357ceee8e?w=800&q=80\",\"https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80\",\"https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80\"]", 0, 0, 0]
  ];
  products.forEach((p) => insertProd.run(...p));

  const hash = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run("Demo User", "demo@sportkick.com", hash, "customer");
  db.prepare("INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run("Admin", "admin@sportkick.com", hash, "admin");

  const insertReview = db.prepare(`
    INSERT INTO product_reviews (product_id, user_name, rating, comment) VALUES (?, ?, ?, ?)
  `);

  const prodList = db.prepare("SELECT id, name FROM products").all();
  if (prodList.length > 0) {
    const p1 = prodList[0] ? prodList[0].id : 1;
    const p2 = prodList[1] ? prodList[1].id : 2;
    const p3 = prodList[2] ? prodList[2].id : 3;
    const p4 = prodList[3] ? prodList[3].id : 4;
    const reviews = [
      [p1, "Rahul Sharma", 5, "Best running shoes I've owned. The cushioning is incredible for long distances."],
      [p1, "Priya Patel", 4, "Lightweight and comfortable. Runs true to size."],
      [p2, "Amit Singh", 5, "Energy-return technology is a game changer. My feet don't tire even after 10km."],
      [p3, "Sneha Reddy", 5, "Amazing grip on the field. Quick cuts feel effortless."],
      [p4, "Vikram Mehta", 5, "Worth every penny. Delivers on court with incredible stability."],
    ];
    reviews.forEach((r) => insertReview.run(r[0], r[1], r[2], r[3]));
  }
}

init();
seed();

module.exports = db;
