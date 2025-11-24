# Rflix Usage Limits System Documentation

## Overview

The Rflix Usage Limits System is a comprehensive middleware solution for tracking, monitoring, and enforcing usage limits across different subscription tiers. It provides real-time usage tracking, automated enforcement, graceful degradation, and integrated notifications.

## Features

### 1. Usage Tracking Middleware
- **Storage Usage Tracking**: Monitor file storage consumption per user
- **Stream Usage Tracking**: Track streaming sessions and duration
- **Concurrent User Tracking**: Monitor active user sessions
- **API Usage Tracking**: Track API call frequency per subscription tier

### 2. Usage Limits Enforcement
- **Storage Limit Enforcement**: Block uploads when storage limit exceeded
- **Stream Limit Enforcement**: Block streaming when stream limit reached
- **Concurrent User Limit Enforcement**: Block login when too many users active
- **API Rate Limit Enforcement**: Rate limiting based on subscription tier

### 3. Real-time Usage Monitoring
- **Current Usage Statistics**: Get real-time usage data
- **Usage Percentage Calculation**: Calculate usage percentage across all metrics
- **Usage Threshold Checking**: Alert when approaching limits
- **Usage History**: Historical usage data for analytics

### 4. Graceful Degradation
- **Over-Limit Handling**: Handle users who exceed limits
- **Upgrade Suggestions**: Suggest higher-tier packages
- **Grace Period Implementation**: Temporary allowance for over-limit users
- **Service Throttling**: Reduce service quality for over-limit users

### 5. Notification System Integration
- **Usage Alerts**: High usage notifications
- **Limit Warnings**: Pre-limit warnings
- **Over-Limit Notifications**: Service restriction notifications
- **Upgrade Suggestions**: Package upgrade recommendations

### 6. Database Integration
- **Real-time Updates**: usage_tracking table updates
- **Historical Data**: usage_history for analytics
- **Violation Tracking**: usage_violations table
- **Audit Logging**: All enforcement actions logged

### 7. Security Features
- **Rate Limiting**: Subscription-based rate limits
- **Input Validation**: Usage data validation
- **Usage Manipulation Prevention**: Anti-fraud measures
- **Audit Trail**: Complete action logging

## Architecture

### Database Schema

#### Tables
- `usage_tracking`: Real-time usage monitoring
- `usage_history`: Historical usage analytics
- `usage_limits`: Custom limits per user
- `usage_violations`: Track limit violations
- `usage_notifications`: Usage alerts and warnings
- `usage_analytics`: Aggregated statistics
- `subscription_tiers`: Subscription tier definitions

#### Views
- `usage_dashboard`: Comprehensive usage overview
- `usage_violations_summary`: Violation statistics
- `usage_trends`: Usage trend analysis

### Middleware Structure

```javascript
// Usage tracking middleware
trackStorageUsage()
trackStreamUsage()
trackConcurrentUsers()
trackAPIUsage()

// Enforcement middleware
enforceStorageLimit()
enforceStreamLimit()
enforceConcurrentUserLimit()
enforceAPIRateLimit()

// Monitoring middleware
getCurrentUsage()
getUsagePercentage()
checkUsageThreshold()
getUsageHistory()
```

## API Endpoints

### User Endpoints
- `GET /api/usage-limits/health` - Service health check
- `GET /api/usage-limits/current` - Current usage statistics
- `GET /api/usage-limits/percentage` - Usage percentage breakdown
- `GET /api/usage-limits/history` - Usage history
- `GET /api/usage-limits/dashboard` - Usage dashboard data
- `POST /api/usage-limits/check-threshold` - Check usage threshold
- `POST /api/usage-limits/handle-over-limit` - Handle over-limit
- `POST /api/usage-limits/suggest-upgrade` - Get upgrade suggestions

### Admin Endpoints
- `GET /api/usage-limits/admin/users` - Get all users usage data
- `GET /api/usage-limits/admin/violations` - Get usage violations
- `PATCH /api/usage-limits/admin/violations/:id/resolve` - Resolve violation
- `PATCH /api/usage-limits/admin/users/:userId/limits` - Update custom limits
- `POST /api/usage-limits/admin/users/:userId/reset-usage` - Reset usage stats
- `GET /api/usage-limits/admin/analytics` - Get usage analytics

## Configuration

### Default Subscription Tiers

| Tier | Storage | Streams | Users | API Calls | Stream Duration | Grace Period |
|------|---------|---------|-------|-----------|-----------------|--------------|
| Basic | 10GB | 2 | 1 | 1,000 | 24 hours | 24 hours |
| Premium | 50GB | 5 | 3 | 5,000 | 7 days | 48 hours |
| Enterprise | 200GB | 10 | 10 | 20,000 | 30 days | 72 hours |

### Environment Variables
```bash
# Usage limits configuration
USAGE_CACHE_EXPIRY=300000        # Cache expiry in milliseconds (5 minutes)
USAGE_ALERT_THRESHOLD=80          # Alert threshold percentage
USAGE_WARNING_THRESHOLD=90      # Warning threshold percentage
USAGE_GRACE_PERIOD=86400000     # Default grace period (24 hours)
```

## Usage Examples

### Basic Usage Tracking
```javascript
const usageLimits = require('./middlewares/usageLimits');

// Track storage usage
app.post('/upload', auth, usageLimits.trackStorageUsage, uploadHandler);

// Track stream usage
app.post('/stream', auth, usageLimits.trackStreamUsage, streamHandler);

// Track API usage
app.use('/api', auth, usageLimits.trackAPIUsage);
```

### Enforcement Middleware
```javascript
// Enforce storage limit
app.post('/upload', auth, usageLimits.enforceStorageLimit, uploadHandler);

// Enforce stream limit
app.get('/stream', auth, usageLimits.enforceStreamLimit, streamHandler);

// Enforce API rate limit
app.use('/api', auth, usageLimits.enforceAPIRateLimit, apiHandler);
```

### Usage Monitoring
```javascript
// Get current usage
const usage = await usageLimits.usageLimitsMiddleware.getCurrentUsage(userId);

// Get usage percentage
const percentage = await usageLimits.usageLimitsMiddleware.getUsagePercentage(userId);

// Check threshold
const thresholdExceeded = await usageLimits.usageLimitsMiddleware.checkUsageThreshold(userId, 80);
```

## Notification Integration

The system integrates with the existing notification service to send:

1. **Usage Alerts**: When usage exceeds threshold (80% by default)
2. **Limit Warnings**: When approaching limits (90% by default)
3. **Over-Limit Notifications**: When limits are exceeded
4. **Upgrade Suggestions**: Based on usage patterns

### Notification Types
- Email notifications
- Telegram notifications
- In-app notifications (via WebSocket)

## Security Considerations

### Rate Limiting
- Subscription-tier based rate limits
- IP-based rate limiting
- User-based rate limiting

### Input Validation
- Usage data validation
- File size validation
- Request parameter validation

### Audit Logging
- All enforcement actions logged
- Usage violations tracked
- Admin actions audited

### Anti-Fraud Measures
- Usage manipulation detection
- Suspicious activity monitoring
- Automated blocking for abuse

## Performance Optimization

### Caching
- In-memory usage cache (5-minute expiry)
- Database query optimization
- Result caching for expensive operations

### Database Optimization
- Strategic indexing
- Query optimization
- Connection pooling

### Async Processing
- Non-blocking operations
- Background processing
- Queue-based processing

## Testing

### Test Coverage
- Unit tests for all middleware functions
- Integration tests for API endpoints
- Performance tests for high-load scenarios
- Security tests for vulnerability assessment

### Test Commands
```bash
# Run usage limits tests
node test_usage_limits_system.js

# Run migration
node migrations/run_usage_limits_migration.js

# Test specific functionality
npm test -- --grep "usage-limits"
```

## Migration

### Database Migration
```bash
# Run the usage limits migration
node migrations/run_usage_limits_migration.js

# Verify migration
node migrations/run_usage_limits_migration.js --verify
```

### Rollback
```bash
# Manual rollback (if needed)
sqlite3 data/rflix.db < migrations/rollback_usage_limits.sql
```

## Monitoring and Maintenance

### Health Checks
- Service health endpoint
- Database connectivity checks
- Usage statistics monitoring

### Maintenance Tasks
- Usage data cleanup
- Violation resolution
- Analytics aggregation
- Performance optimization

### Alerts
- System health alerts
- Usage spike alerts
- Violation alerts
- Performance degradation alerts

## Troubleshooting

### Common Issues

1. **Usage not tracking**
   - Check middleware order
   - Verify authentication
   - Check database connectivity

2. **Limits not enforcing**
   - Verify limit configuration
   - Check enforcement middleware
   - Review audit logs

3. **Notifications not sending**
   - Check notification service health
   - Verify user preferences
   - Review notification logs

4. **Performance issues**
   - Check cache configuration
   - Review database indexes
   - Monitor system resources

### Debug Mode
```bash
# Enable debug logging
DEBUG=usage-limits* npm start

# Check specific middleware
DEBUG=usage-limits:middleware npm start
```

## API Reference

See the [API Documentation](API_REFERENCE.md) for detailed endpoint specifications.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the test suite
- Examine the audit logs
- Contact the development team

## License

This usage limits system is part of the Rflix-User-Center project and follows the same licensing terms.