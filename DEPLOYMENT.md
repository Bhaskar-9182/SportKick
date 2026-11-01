# 🚀 SportKick Live Deployment Guide

SportKick is a production-ready, full-stack athletic e-commerce application built with **Node.js, Express, SQLite, and vanilla modern JavaScript**.

Follow any of the guides below to take your website live on the internet with a public URL and free HTTPS.

---

## ⚡ Option 1: Render.com (Recommended — 100% Free & Easy)

Render offers free hosting with automatic SSL certificates and continuous deployment from GitHub.

### Steps:
1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "SportKick ready for production"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/SportKick.git
   git push -u origin main
   ```
2. Go to **[render.com](https://render.com)** and sign in.
3. Click **New +** → **Web Service**.
4. Select your **SportKick** GitHub repository.
5. Configure the settings:
   * **Name:** `sportkick` (or your choice)
   * **Region:** Closest to your target users (e.g., Singapore / Frankfurt / Oregon)
   * **Branch:** `main`
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Instance Type:** `Free`
6. Under **Environment Variables**, add:
   * `NODE_ENV`: `production`
   * `SESSION_SECRET`: *(Generate a secure random string)*
7. Click **Create Web Service**. Render will build and deploy your site with a free `https://sportkick-xxxx.onrender.com` URL!

---

## 🚂 Option 2: Railway.app (Instant 1-Click)

1. Go to **[railway.app](https://railway.app)**.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository.
4. Railway automatically detects the `Dockerfile` and `Procfile`, builds native SQLite bindings, and provides a live HTTPS domain (`https://sportkick-production.up.railway.app`).

---

## 🪂 Option 3: Fly.io (Fast Global Edge Hosting)

Fly.io provides lightning-fast edge hosting with native support for SQLite persistent volumes:

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Launch application
fly launch

# 4. Deploy
fly deploy
```

---

## 🖥️ Option 4: Deploying on a VPS (Ubuntu / Debian / DigitalOcean / AWS EC2)

For custom domain with full server control using **PM2** and **Nginx**:

### 1. Install Node.js & PM2:
```bash
sudo apt update && sudo apt install -y nodejs npm nginx git
sudo npm install -g pm2
```

### 2. Clone and start with PM2:
```bash
git clone https://github.com/YOUR_USERNAME/SportKick.git /var/www/sportkick
cd /var/www/sportkick
npm install --production
NODE_ENV=production pm2 start server.js --name sportkick
pm2 save
pm2 startup
```

### 3. Setup Nginx Reverse Proxy:
Create `/etc/nginx/sites-available/sportkick`:
```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and install free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/sportkick /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🛡️ Production Security Checklist Implemented:
- [x] Reverse proxy support (`app.set("trust proxy", 1)`) for HTTPS routing
- [x] Secure HTTP headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`)
- [x] Session cookie protection (`httpOnly`, `sameSite: "lax"`, auto-secure in production)
- [x] Custom branded 404 page & API 404 handler
- [x] Centralized error handling without stack trace leaks in production
- [x] Graceful shutdown on `SIGINT` / `SIGTERM` to prevent database locks
- [x] Static asset caching headers (`maxAge: 1d`, `ETag`)
- [x] Search engine discovery files (`robots.txt`, `sitemap.xml`)
- [x] Mobile web app & OpenGraph social sharing meta tags
- [x] SVG vector favicon for all modern browsers

