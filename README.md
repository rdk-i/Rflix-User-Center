# Rflix-API

> **Comprehensive Jellyfin User Management System** with admin & user dashboards, subscription management, and advanced features.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.18+-blue)
![SQLite](https://img.shields.io/badge/SQLite-3+-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 📋 Features

### Core Features

- ✅ **User Registration** with subscription packages (1-12 months)
- ✅ **Admin Approval** workflow for new registrations
- ✅ **Automatic User Disabling** when subscription expires
- ✅ **JWT Authentication** with access & refresh tokens
- ✅ **Role-Based Access Control (RBAC)**
- ✅ **Captcha Protection** (Cloudflare Turnstile / Google reCAPTCHA)
- ✅ **Modern Dark Theme** (Zinc Palette)
- ✅ **Setup Wizard (GUI)** for easy first-time installation

### Advanced Features

- 📧 **Email & Telegram Notifications**
- 📊 **Usage Statistics & Analytics**
- 🎫 **Discount Coupons**
- 🔄 **Self-Service Renewal**
- 📝 **Audit Logging** with IP & User-Agent tracking
- 🌐 **i18n Support** (Indonesian & English)
- 💾 **User Backup & Restore**
- 🔒 **API Rate Limiting**
- 🔌 **Webhook Outbound Integration**

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Jellyfin Server with API access

### Installation (New Method - GUI Wizard)

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/rflix-api.git
   cd rflix-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm run dev
   ```

4. **Open Setup Wizard**
   Access `http://localhost:3000` in your browser. You will be greeted by the **Rflix Setup Wizard**.

   Follow the on-screen instructions to:

   - Configure Server & Jellyfin connection.
   - Generate Security Keys.
   - Create your first Admin Account.
   - Initialize Database.

### Access the Application

Once setup is complete, you can access the application via these clean URLs:

- **User Login**: `http://localhost:3000/user`
- **Admin Login**: `http://localhost:3000/admin`
- **Registration**: `http://localhost:3000/registration`

---

## 📁 Project Structure

```
rflix-api/
├── server/
│   ├── controllers/      # Request handlers
│   ├── routes/           # API routes
│   ├── services/         # Business logic & external services
│   ├── scheduler/        # Background tasks
│   ├── middlewares/      # Express middlewares
│   ├── models/           # Database models
│   ├── utils/            # Helper utilities
│   ├── config/           # Configuration files
│   └── index.js          # Main server file
├── public/               # Static files (HTML, CSS, JS)
├── migrations/           # Database migrations
├── data/                 # SQLite database
├── logs/                 # Application logs
├── backups/              # Database backups
└── tests/                # Test files
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options. The Setup Wizard will automatically generate a `.env` file for you.

### Captcha Configuration

**Cloudflare Turnstile (Default):**

1. Get keys from https://dash.cloudflare.com/
2. Set `CAPTCHA_PROVIDER=turnstile`
3. Add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`

**Google reCAPTCHA:**

1. Get keys from https://www.google.com/recaptcha/admin
2. Set `CAPTCHA_PROVIDER=recaptcha`
3. Add `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET`

## 🐳 Docker Deployment

```bash
# Build image
docker build -t rflix-api .

# Run container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  --name rflix-api \
  rflix-api
```

## 📚 API Documentation

API documentation is available via Swagger UI at `/docs` when the server is running.

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_token>
```

### Key Endpoints

- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `POST /api/registration` - User registration
- `GET /api/users/me` - Get current user info
- `GET /api/admin/users` - List all users (admin)
- `POST /api/coupons/redeem` - Redeem coupon code

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm test -- --coverage
```

## 📊 Scheduler Tasks

Background tasks run automatically:

- **Disable Expired Users**: Every 1 hour (configurable)
- **Database Backup**: Daily (configurable)
- **Token Blacklist Cleanup**: Daily at midnight
- **Stats Collection**: Every 1 hour (configurable)

## 🔒 Security

- Bcrypt password hashing (12 rounds)
- JWT with access & refresh tokens
- HttpOnly secure cookies
- Rate limiting (configurable per endpoint)
- CORS whitelist
- Input sanitization
- Token blacklist on logout
- Brute-force detection
- Circuit breaker for external services

## 🌍 Internationalization

The application supports multiple languages:

- English (default)
- Indonesian

Language files are located in `locales/`

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍💻 Author

Your Name - [@yourhandle](https://twitter.com/yourhandle)

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - The amazing media server
- [Express.js](https://expressjs.com/) - Web framework
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite3 for Node.js

## 📞 Support

For issues and questions:

- GitHub Issues: https://github.com/yourusername/rflix-api/issues
- Email: support@yourdomain.com

---

**⚠️ Important Notes:**

- Change default admin password immediately after first login
- Keep your `.env` file secure and never commit it to version control
- Regularly backup your database
- Monitor logs for security issues
- Keep dependencies updated
