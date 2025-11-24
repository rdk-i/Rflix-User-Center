# Rflix-User-Center Deployment Guide

This guide details how to deploy Rflix-User-Center on a Debian-based Linux server (e.g., Ubuntu, Debian).

## 1. Server Preparation

Update your system packages:

```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js (v20 LTS recommended):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install Git and Process Manager (PM2):

```bash
sudo apt install -y git
sudo npm install -g pm2
```

## 2. Application Setup

Clone the repository:

```bash
git clone https://github.com/rdk-i/Rflix-User-Center
cd Rflix-User-Center
```

Install dependencies:

```bash
npm install --production
```

Run Database Migrations:

```bash
# This creates the SQLite database and all necessary tables
npm run migrate
```

## 3. Configuration (Setup Wizard)

1.  Start the application temporarily:
    ```bash
    npm start
    ```
2.  Open your web browser and access `http://YOUR_SERVER_IP:3000`.
3.  Complete the **Setup Wizard**:
    - **Server Config**: Set Port (default 3000) and Environment (Production).
    - **Jellyfin**: Enter your Jellyfin URL and API Key.
    - **Security**: Generate a secure JWT Secret.
    - **Admin Account**: Create your initial Super Admin account.
4.  Once finished, stop the server (Ctrl+C).

## 4. Production Deployment with PM2

Start the application in the background using PM2:

```bash
pm2 start server/index.js --name "rflix-api"
```

Save the PM2 list and set it to start on boot:

```bash
pm2 save
pm2 startup
```

## 5. Reverse Proxy (Nginx) - Optional but Recommended

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a configuration file:

```bash
sudo nano /etc/nginx/sites-available/rflix
```

Add the following content (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/rflix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Certificate (HTTPS)

Secure your domain with a free Let's Encrypt certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 7. Maintenance & Updates

To update the application in the future:

```bash
cd Rflix-User-Center
git pull
npm install
npm run migrate
pm2 restart rflix-api
```

## Troubleshooting

- **Logs**: View application logs with `pm2 logs rflix-api`.
- **Database**: The SQLite database is located at `data/rflix.db`. Ensure the `data` directory has write permissions.
