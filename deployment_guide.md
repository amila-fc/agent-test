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
3. Replace the contents of that file with the **Exact Configuration** below:

```nginx
server {
    listen 80;
    server_name 167.172.75.67;

    # Frontend Static Files
    root /var/www/html/logistics-agent;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for large file processing
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

4. **Test & Restart**:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```
### Step 5: "Running" the Application
In **Droplet Mode**, you do not "start" the client like you do in development. Instead:

1. **The Backend**: Is always running via **PM2** (Step 3).
2. **The Frontend**: Is served by **Nginx** (Step 4). 

Since you've updated your `.gitignore` to include the `dist` folder, you have two options after you `git pull` on your droplet:

**Option A: Point Nginx to your repo (Quickest)**
Update your Nginx config `root` to point directly to your repo folder:
`root /root/agent-test/client/dist;`

**Option B: Copy to Web Root (Recommended)**
Copy the files to the standard Nginx directory:
```bash
sudo mkdir -p /var/www/html/logistics-agent
sudo cp -r /root/agent-test/client/dist/* /var/www/html/logistics-agent/
```
Then make sure Nginx uses: `root /var/www/html/logistics-agent;`
