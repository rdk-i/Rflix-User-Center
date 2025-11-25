# 🎬 Rflix User Center

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**A modern, feature-rich user management system for Jellyfin media servers**

[Features](#-features) • [Installation](#-installation) • [Deployment](#-deployment) • [Configuration](#-configuration) • [API Docs](#-api-documentation)

</div>

---

## 📖 Overview

Rflix User Center is a comprehensive user management and automation system designed specifically for Jellyfin media servers. It provides an intuitive interface for user registration, subscription management, automated account provisioning, and powerful admin controls with real-time analytics.

## ✨ Features

### 🎯 Core Features

- **Automated User Management**: Seamlessly creates and manages Jellyfin accounts upon registration
- **Subscription System**: Flexible package-based subscriptions with automated expiration handling
- **Dynamic Form Builder**: Fully customizable registration forms managed from the Admin Dashboard
- **Setup Wizard**: Easy-to-use GUI wizard for initial server configuration
- **Multi-language Support**: i18n ready with extensible language system

### 🎨 User Interface

- **Modern Neumorphic Design**: Sleek, responsive UI with smooth animations
- **Dark/Light Mode**: Automatic theme switching based on user preference
- **Real-time Updates**: WebSocket integration for live notifications
- **Mobile Responsive**: Optimized for all screen sizes

### 🔐 Security

- **JWT Authentication**: Secure token-based authentication with HttpOnly cookies
- **CAPTCHA Integration**: Support for both Cloudflare Turnstile and Google reCAPTCHA
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Password Hashing**: Bcrypt-based secure password storage
- **Helmet.js**: Enhanced security headers

### 📊 Admin Dashboard

- **User Management**: Complete CRUD operations for users
- **Real-time Analytics**: Live statistics with interactive charts
- **Activity Monitoring**: Track user registrations, logins, and system events
- **Package Management**: Create and manage subscription packages
- **System Logs**: Comprehensive logging with search and filter capabilities
- **Approval System**: Manual approval workflow for new registrations

### 🤖 Automation & Scheduling

- **Automated Account Expiration**: Scheduled task to disable expired accounts
- **Statistics Collection**: Periodic data collection for analytics
- **Database Backups**: Automated backup scheduling
- **Orphan Cleanup**: Remove unused data automatically

### 🔔 Notifications

- **Email Notifications**: SMTP integration for email alerts
- **Telegram Bot**: Send notifications via Telegram
- **Push Notifications**: Firebase Cloud Messaging support
- **WebSocket Events**: Real-time in-app notifications

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, bcrypt, express-rate-limit
- **Logging**: Pino with pretty printing
- **Circuit Breaker**: Opossum for fault tolerance

### Frontend

- **HTML5**: Semantic markup
- **CSS3**: Vanilla CSS with Neumorphism design
- **JavaScript**: ES6+ with async/await
- **Charts**: Chart.js for analytics visualization
- **WebSocket**: Real-time communication

### Integration

- **Jellyfin API**: Direct integration with Jellyfin server
- **CAPTCHA**: Cloudflare Turnstile / Google reCAPTCHA
- **Email**: Nodemailer for SMTP
- **Telegram**: node-telegram-bot-api

## 📦 Installation

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Jellyfin Server**: Running instance with API access
- **SQLite**: Included with better-sqlite3

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/rdk-i/Rflix-User-Center.git
   cd Rflix-User-Center
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run database migrations**

   ```bash
   npm run migrate
   ```

4. **Start the server**

   ```bash
   npm start
   ```

5. **Access the Setup Wizard**

   Open your browser and navigate to:

   ```
   http://localhost:3000
   ```

   The Setup Wizard will guide you through:

   - Creating your admin account
   - Configuring Jellyfin connection
   - Setting up CAPTCHA (optional)
   - Configuring email notifications (optional)

## 🚀 Deployment

### Method 1: Docker (Recommended)

#### Using Docker Compose

1. **Create docker-compose.yml**

   ```yaml
   version: "3.8"

   services:
     rflix-user-center:
       image: rflix-user-center:latest
       build: .
       container_name: rflix-user-center
       ports:
         - "3000:3000"
       volumes:
         - ./data:/app/data
         - ./logs:/app/logs
         - ./backups:/app/backups
       environment:
         - NODE_ENV=production
         - PORT=3000
       restart: unless-stopped
       healthcheck:
         test:
           [
             "CMD",
             "node",
             "-e",
             "require('http').get('http://localhost:3000/health')",
           ]
         interval: 30s
         timeout: 3s
         retries: 3
   ```

2. **Build and run**

   ```bash
   docker-compose up -d
   ```

#### Using Docker CLI

```bash
# Build the image
docker build -t rflix-user-center .

# Run the container
docker run -d \
  --name rflix-user-center \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/backups:/app/backups \
  --restart unless-stopped \
  rflix-user-center
```

### Method 2: VPS Deployment (Ubuntu/Debian)

1. **Update system and install Node.js**

   ```bash
   # Update package list
   sudo apt update && sudo apt upgrade -y

   # Install Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Verify installation
   node --version
   npm --version
   ```

2. **Clone and setup application**

   ```bash
   # Clone repository
   cd /var/www
   git clone https://github.com/rdk-i/Rflix-User-Center.git
   cd Rflix-User-Center

   # Install dependencies
   npm install --production

   # Run migrations
   npm run migrate
   ```

3. **Setup PM2 for process management**

   ```bash
   # Install PM2 globally
   sudo npm install -g pm2

   # Start application
   pm2 start server/index.js --name rflix-user-center

   # Save PM2 configuration
   pm2 save

   # Setup PM2 to start on boot
   pm2 startup
   ```

4. **Configure Nginx as reverse proxy**

   ```bash
   # Install Nginx
   sudo apt install -y nginx

   # Create Nginx configuration
   sudo nano /etc/nginx/sites-available/rflix-user-center
   ```

   Add the following configuration:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

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

   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/rflix-user-center /etc/nginx/sites-enabled/

   # Test Nginx configuration
   sudo nginx -t

   # Restart Nginx
   sudo systemctl restart nginx
   ```

5. **Setup SSL with Let's Encrypt (Optional but recommended)**

   ```bash
   # Install Certbot
   sudo apt install -y certbot python3-certbot-nginx

   # Obtain SSL certificate
   sudo certbot --nginx -d your-domain.com

   # Auto-renewal is configured automatically
   ```

### Method 3: cPanel Deployment

1. **Upload files via File Manager or FTP**

   - Upload all files to `public_html/rflix` or desired directory
   - Ensure `.env` file is properly configured

2. **Setup Node.js Application**

   - Go to cPanel → Software → Setup Node.js App
   - Click "Create Application"
   - Configure:
     - Node.js version: 18.x or higher
     - Application mode: Production
     - Application root: `/home/username/public_html/rflix`
     - Application URL: `rflix.yourdomain.com` or subdirectory
     - Application startup file: `server/index.js`

3. **Install dependencies**

   - Click "Run NPM Install" in cPanel Node.js interface
   - Or use Terminal:
     ```bash
     cd ~/public_html/rflix
     npm install --production
     npm run migrate
     ```

4. **Start the application**
   - Click "Start" in cPanel Node.js interface
   - Application will be available at configured URL

### Method 4: Systemd Service (Linux)

1. **Create systemd service file**

   ```bash
   sudo nano /etc/systemd/system/rflix-user-center.service
   ```

   Add the following:

   ```ini
   [Unit]
   Description=Rflix User Center
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/Rflix-User-Center
   ExecStart=/usr/bin/node server/index.js
   Restart=on-failure
   RestartSec=10
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=rflix-user-center
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and start service**

   ```bash
   # Reload systemd
   sudo systemctl daemon-reload

   # Enable service to start on boot
   sudo systemctl enable rflix-user-center

   # Start service
   sudo systemctl start rflix-user-center

   # Check status
   sudo systemctl status rflix-user-center
   ```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

#### Essential Configuration

```env
# Server
NODE_ENV=production
PORT=3000

# Jellyfin Server
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your_jellyfin_api_key

# Security
JWT_SECRET=your_super_secret_jwt_key_change_this
BCRYPT_SALT_ROUNDS=12

# CAPTCHA (Choose one)
CAPTCHA_PROVIDER=turnstile
TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
```

#### Optional Configuration

```env
# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Telegram Notifications
TELEGRAM_BOT_TOKEN=your_bot_token

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Database
DB_PATH=./data/rflix.db

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Getting Jellyfin API Key

1. Login to your Jellyfin server as administrator
2. Go to Dashboard → API Keys
3. Click "+" to create new API key
4. Name it "Rflix User Center"
5. Copy the generated key to your `.env` file

### CAPTCHA Setup

#### Cloudflare Turnstile (Recommended)

1. Visit [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile)
2. Create a new site
3. Copy Site Key and Secret Key to `.env`

#### Google reCAPTCHA

1. Visit [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register a new site (v2 Checkbox)
3. Copy Site Key and Secret Key to `.env`

## � API Documentation

### Public Endpoints

#### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

#### Registration

- `GET /api/form-fields` - Get registration form fields
- `POST /api/registration` - Register new user (with approval)
- `POST /api/simple-registration/register` - Direct registration (no approval)
- `GET /api/packages` - Get available subscription packages

#### User Dashboard

- `GET /api/user/profile` - Get user profile
- `GET /api/user/subscription` - Get subscription details

### Admin Endpoints (Protected)

#### User Management

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/extend` - Extend subscription

#### Approval System

- `GET /api/admin/approvals` - Get pending approvals
- `POST /api/admin/approvals/:id/approve` - Approve registration
- `POST /api/admin/approvals/:id/reject` - Reject registration

#### Package Management

- `GET /api/admin/packages` - List packages
- `POST /api/admin/packages` - Create package
- `PUT /api/admin/packages/:id` - Update package
- `DELETE /api/admin/packages/:id` - Delete package

#### Statistics & Analytics

- `GET /api/stats/overview` - Get dashboard statistics
- `GET /api/stats/history` - Get historical data
- `GET /api/admin/logs` - Get system logs

#### Form Builder

- `GET /api/form-fields` - Get all form fields
- `POST /api/form-fields` - Create form field
- `PUT /api/form-fields/:id` - Update form field
- `DELETE /api/form-fields/:id` - Delete form field

## 📁 Project Structure

```
Rflix-User-Center/
├── server/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middlewares/     # Express middlewares
│   ├── routes/          # API routes
│   ├── scheduler/       # Scheduled tasks
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── websocket/       # WebSocket handlers
│   └── index.js         # Application entry point
├── public/
│   ├── admin_dashboard/ # Admin panel files
│   ├── js/              # Client-side JavaScript
│   ├── styles.css       # Global styles
│   ├── index.html       # Landing page
│   ├── setup.html       # Setup wizard
│   ├── admin_login.html # Admin login
│   ├── user_login.html  # User login
│   ├── user_dashboard.html # User dashboard
│   └── registration.html # Registration form
├── migrations/          # Database migrations
├── data/               # SQLite database (gitignored)
├── logs/               # Application logs (gitignored)
├── backups/            # Database backups (gitignored)
├── .env.example        # Environment variables template
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## 🔧 Development

### Available Scripts

```bash
# Start production server
npm start

# Start development server with auto-reload
npm run dev

# Run database migrations
npm run migrate

# Build Tailwind CSS (if using)
npm run build:css

# Run tests
npm test

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Migrations

Migrations are located in `migrations/` directory. To create a new migration:

1. Add SQL to `migrations/data.sql`
2. Update `migrations/run.js` if needed
3. Run `npm run migrate`

## 🐛 Troubleshooting

### Common Issues

#### Port already in use

```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change PORT in .env
```

#### Database locked error

```bash
# Stop all instances of the application
# Delete .db-shm and .db-wal files
rm data/*.db-shm data/*.db-wal
```

#### Jellyfin connection failed

- Verify `JELLYFIN_URL` is correct and accessible
- Ensure `JELLYFIN_API_KEY` is valid
- Check firewall settings
- Verify Jellyfin server is running

#### CAPTCHA not working

- Verify site key and secret key are correct
- Check domain is whitelisted in CAPTCHA provider settings
- Ensure `CAPTCHA_PROVIDER` matches your configuration

### Logs

Check application logs for detailed error information:

```bash
# View logs
tail -f logs/app.log

# View PM2 logs
pm2 logs rflix-user-center

# View Docker logs
docker logs rflix-user-center
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - The amazing media server
- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [Chart.js](https://www.chartjs.org/) - Beautiful charts
- All contributors and users of this project

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/rdk-i/Rflix-User-Center/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rdk-i/Rflix-User-Center/discussions)

---

<div align="center">

**Made with ❤️ for the Jellyfin community**

⭐ Star this repository if you find it helpful!

</div>
