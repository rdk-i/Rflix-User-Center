# Subscription Dashboard Documentation

## Overview

The Subscription Dashboard is a comprehensive admin interface for managing all aspects of the Rflix subscription system. It provides real-time analytics, package management, user subscription tracking, payment processing, and system configuration in a neumorphic design that matches the existing admin dashboard aesthetic.

## Features

### 🎯 Core Functionality
- **Package Management**: Create, edit, delete, and toggle subscription packages
- **User Subscriptions**: Track and manage user subscriptions with detailed status monitoring
- **Payment Processing**: Handle payments, refunds, and transaction history
- **Analytics Dashboard**: Real-time metrics with interactive charts and visualizations
- **Real-time Updates**: WebSocket integration for live data synchronization
- **Bulk Operations**: Perform mass actions on multiple subscriptions
- **Settings Configuration**: Manage payment gateways and subscription settings
- **Data Export**: Export analytics data in multiple formats

### 🎨 Design & UX
- **Neumorphic Design**: Consistent with existing Rflix admin dashboard
- **Responsive Layout**: Mobile-friendly interface that works on all devices
- **Dark/Light Mode Toggle**: Theme switching support
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Loading States**: Smooth loading indicators and progress bars
- **Error Handling**: Comprehensive error messages and retry mechanisms

## Architecture

### Frontend Components
```
public/admin_dashboard/subscriptions.html
├── Header & Navigation
├── Key Metrics Cards
├── Tab Navigation System
├── Analytics Dashboard (Charts.js)
├── Package Management Table
├── User Subscription Management
├── Payment Management Interface
├── Settings Configuration
└── Modal Dialogs (Create/Edit Forms)
```

### Backend API Structure
```
server/routes/subscriptions.js
├── Package Management Routes
│   ├── GET /api/subscriptions/packages
│   ├── POST /api/subscriptions/packages
│   ├── GET /api/subscriptions/packages/:id
│   ├── PUT /api/subscriptions/packages/:id
│   ├── DELETE /api/subscriptions/packages/:id
│   ├── PATCH /api/subscriptions/packages/:id/toggle
│   ├── PUT /api/subscriptions/packages/:id/pricing
│   └── PUT /api/subscriptions/packages/:id/limits
│
├── Subscription Management Routes
│   ├── GET /api/subscriptions/user/:userId
│   ├── POST /api/subscriptions/upgrade
│   ├── POST /api/subscriptions/downgrade
│   ├── POST /api/subscriptions/cancel
│   └── POST /api/subscriptions/renew
│
├── Payment Routes
│   ├── POST /api/subscriptions/payment
│   ├── POST /api/subscriptions/payment/stripe/webhook
│   ├── POST /api/subscriptions/payment/paypal/webhook
│   ├── GET /api/subscriptions/payments/history
│   └── POST /api/subscriptions/refund
│
├── Analytics Routes
│   ├── GET /api/subscriptions/analytics
│   ├── GET /api/subscriptions/analytics/performance
│   ├── GET /api/subscriptions/analytics/trends
│   └── GET /api/subscriptions/analytics/export
│
├── Admin Routes
│   ├── GET /api/subscriptions/admin/dashboard
│   ├── GET /api/subscriptions/admin/users
│   ├── GET /api/subscriptions/admin/revenue
│   ├── GET /api/subscriptions/admin/usage
│   ├── GET /api/subscriptions/admin/settings
│   ├── POST /api/subscriptions/admin/settings
│   ├── POST /api/subscriptions/admin/bulk/cancel
│   └── POST /api/subscriptions/admin/bulk/upgrade
└── WebSocket Integration
    └── Real-time notifications for all subscription events
```

### WebSocket Integration
```
server/websocket/index.js
├── Client Connection Management
├── Authentication & Authorization
├── Message Routing
├── Subscription Management
├── Real-time Notifications
└── Health Monitoring
```

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- SQLite database (already configured in the project)
- Admin authentication token

### Database Setup
Run the settings table migration:
```bash
sqlite3 database.db < migrations/add_settings_table.sql
```

### Dependencies
The dashboard uses these key dependencies:
- Chart.js for analytics visualizations
- WebSocket for real-time updates
- TailwindCSS for responsive design
- Neumorphic CSS classes from existing styles

### Configuration
1. Ensure the JWT secret is configured in your `.env` file
2. Set up payment gateway credentials (Stripe/PayPal)
3. Configure WebSocket URL in the frontend

## API Reference

### Package Management

#### Create Package
```http
POST /api/subscriptions/packages
Content-Type: application/json

{
  "name": "Premium Plan",
  "description": "Ultimate streaming experience",
  "price": 29.99,
  "duration": 30,
  "status": "active",
  "features": {
    "HD Streaming": true,
    "Multi-device": true
  },
  "limits": {
    "apiCalls": 5000,
    "storage": 1024,
    "bandwidth": 10,
    "devices": 5
  }
}
```

#### Update Package
```http
PUT /api/subscriptions/packages/:id
Content-Type: application/json

{
  "name": "Updated Premium Plan",
  "price": 34.99,
  "status": "active"
}
```

#### Toggle Package Status
```http
PATCH /api/subscriptions/packages/:id/toggle
```

### Analytics

#### Get Dashboard Metrics
```http
GET /api/subscriptions/admin/dashboard
```

#### Get Performance Metrics
```http
GET /api/subscriptions/analytics/performance
```

#### Get Trend Analysis
```http
GET /api/subscriptions/analytics/trends?period=30d
```

#### Export Analytics Data
```http
GET /api/subscriptions/analytics/export?format=csv
```

### Payment Management

#### Process Payment
```http
POST /api/subscriptions/payment
Content-Type: application/json

{
  "amount": 29.99,
  "currency": "USD",
  "paymentMethod": "stripe",
  "packageId": 1,
  "description": "Payment for Premium Plan"
}
```

#### Process Refund
```http
POST /api/subscriptions/refund
Content-Type: application/json

{
  "paymentId": 123,
  "reason": "Customer request",
  "amount": 29.99
}
```

## WebSocket Events

### Subscription Events
- `subscription:created` - New subscription created
- `subscription:updated` - Subscription details updated
- `subscription:cancelled` - Subscription cancelled

### Package Events
- `package:created` - New package created
- `package:updated` - Package details updated
- `package:deleted` - Package deleted

### Payment Events
- `payment:completed` - Payment processed successfully
- `payment:failed` - Payment processing failed
- `payment:refunded` - Refund processed

### Analytics Events
- `analytics:metrics` - Analytics data updated
- `system:notification` - System notification
- `system:alert` - System alert/warning

## Usage Examples

### Creating a Package
```javascript
const packageData = {
  name: "Premium Plan",
  price: 29.99,
  duration: 30,
  features: {
    "HD Streaming": true,
    "Multi-device Support": true
  }
};

const response = await fetch('/api/subscriptions/packages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(packageData)
});
```

### Processing a Payment
```javascript
const paymentData = {
  amount: 29.99,
  currency: 'USD',
  paymentMethod: 'stripe',
  packageId: 1
};

const response = await fetch('/api/subscriptions/payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(paymentData)
});
```

### WebSocket Integration
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/subscriptions?token=YOUR_TOKEN');

ws.onopen = () => {
  // Subscribe to updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    payload: {
      types: ['subscription:created', 'payment:completed']
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data.type, data.payload);
};
```

## Testing

### Running Tests
```bash
node test_subscription_dashboard.js
```

### Running Demo
```bash
node demo_subscription_dashboard.js
```

### Test Coverage
- Authentication and authorization
- Package CRUD operations
- User subscription management
- Payment processing
- Analytics calculations
- WebSocket real-time updates
- Settings configuration
- Bulk operations
- UI/UX validation

## Performance Considerations

### Frontend Optimizations
- Lazy loading of chart components
- Debounced search functionality
- Virtual scrolling for large data sets
- Caching of frequently accessed data
- Optimized re-renders with efficient state management

### Backend Optimizations
- Database query optimization with proper indexes
- Pagination for large result sets
- Caching of analytics calculations
- Rate limiting to prevent abuse
- Connection pooling for database operations

### WebSocket Optimizations
- Efficient message serialization
- Connection pooling and management
- Health checks and automatic reconnection
- Message compression for large payloads
- Selective broadcasting to reduce network traffic

## Security Features

### Authentication
- JWT-based authentication
- Token validation on every request
- Automatic token refresh mechanism

### Authorization
- Role-based access control (Admin only)
- Resource-level permissions
- Audit logging for all admin actions

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting per endpoint
- Secure WebSocket connections

## Troubleshooting

### Common Issues

#### WebSocket Connection Failed
- Check if the WebSocket server is running
- Verify the WebSocket URL is correct
- Ensure the authentication token is valid
- Check firewall settings for WebSocket connections

#### Analytics Charts Not Loading
- Verify Chart.js is loaded correctly
- Check browser console for JavaScript errors
- Ensure API endpoints are returning valid data
- Check for CORS issues

#### Package Creation Fails
- Verify all required fields are provided
- Check for duplicate package names
- Ensure price and duration are valid numbers
- Verify the user has admin permissions

#### Payment Processing Errors
- Check payment gateway credentials
- Verify the package exists and is active
- Ensure the payment amount is valid
- Check for network connectivity issues

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
DEBUG=subscriptions:* npm start
```

## Maintenance

### Regular Tasks
- Monitor WebSocket connection health
- Review analytics data accuracy
- Check for failed payments and refunds
- Update package pricing and features
- Review user subscription statuses

### Database Maintenance
- Regular backup of subscription data
- Monitor database performance
- Clean up old payment records
- Archive inactive subscriptions
- Update indexes as needed

### Security Updates
- Keep dependencies updated
- Review access logs regularly
- Monitor for suspicious activity
- Update authentication tokens
- Review and update security policies

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Check the test files for examples
4. Review the server logs for errors
5. Contact the development team

## Changelog

### Version 1.0.0 (2025-11-24)
- Initial release with complete subscription management
- Real-time analytics with interactive charts
- WebSocket integration for live updates
- Comprehensive admin dashboard
- Full API documentation
- Test suite and demo scripts

## License

This project is part of the Rflix-User-Center system and follows the same licensing terms.

## Contributing

Contributions are welcome! Please follow the existing code style and submit pull requests with proper testing and documentation.