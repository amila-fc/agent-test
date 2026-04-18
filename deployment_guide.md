# DigitalOcean Deployment Guide

This guide outlines the steps to deploy your Logistics Dashboard to the **DigitalOcean App Platform**. This is the recommended method as it handles SSL, scaling, and CI/CD automatically.

## 1. Repository Preparation
Ensure your code is pushed to a GitHub or GitLab repository. Your structure should look like this:
```text
/ (root)
├── client/ (React Vite App)
└── server/ (Node.js/Express App)
```

## 2. DigitalOcean App Platform Setup

### Step 1: Create a New App
1. Log in to [DigitalOcean Cloud](https://cloud.digitalocean.com/).
2. Click **Create** > **Apps**.
3. Choose **GitHub** as your source and select your repository.

### Step 2: Configure Components
DigitalOcean will detect the subdirectories. You need two components:

#### A. Backend Service (Server)
- **Source Directory**: `server`
- **Build Command**: `npm install`
- **Run Command**: `npm start`
- **Environment Variables**:
  - `GEMINI_API_KEY`: [Your Google Gemini API Key]
  - `PORT`: `8080` (DO default)

#### B. Frontend Static Site (Client)
- **Source Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: The URL of your Backend Service (e.g., `https://your-api-app.ondigitalocean.app/api`)

## 3. Handling API Routing
Since the Frontend and Backend will have different URLs on DO, you must update the API calls in [App.jsx](file:///c:/Users/amila/Downloads/CQT-OCBC-main/client/src/App.jsx) to use an environment variable:

```javascript
// In client/src/App.jsx
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const response = await axios.post(`${API_BASE}/extract`, formData);
```

## 4. Alternative: Droplet (VPS) Deployment
If you prefer using a DigitalOcean Droplet for full control:

### Step 1: Basic Setup
1. Create a **Ubuntu 22.04+ Droplet**.
2. Connect via SSH: `ssh root@your_droplet_ip`.
3. Update system: `sudo apt update && sudo apt upgrade -y`.
4. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

### Step 2: Deploy Code
1. Clone your repo: `git clone your_repo_url`.
2. Navigate to server: `cd server && npm install`.
3. Create `.env`: `nano .env` (Copy your keys here).

### Step 3: PM2 Process Management
Use PM2 to keep your server running 24/7:
```bash
sudo npm install -g pm2
pm2 start index.js --name "logistics-backend"
pm2 save
pm2 startup
```

### Step 4: Nginx & SSL
1. Install Nginx: `sudo apt install nginx`.
2. Configure Nginx: `sudo nano /etc/nginx/sites-available/default`.
   - Update the `location /` to point to your frontend build.
   - Add a `location /api` to proxy to `http://localhost:5000`.
3. **SSL**: Run `sudo apt install certbot python3-certbot-nginx` then `sudo certbot --nginx` to get a free SSL certificate.
