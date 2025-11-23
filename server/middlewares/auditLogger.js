const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware to log admin actions to audit_log
 */
function auditLogger(action) {
  return (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
      // Only log if request was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const details = {
            path: req.path,
            method: req.method,
            body: req.body,
            query: req.query,
            params: req.params,
          };

          const stmt = db.prepare(`
            INSERT INTO audit_log (adminId, action, targetUserId, details, timestamp, ip, userAgent, before, after)
            VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
          `);

          stmt.run(
            req.user?.id || null,
            action,
            req.body?.userId || req.params?.id || null,
            JSON.stringify(details),
            req.ip,
            req.get('user-agent') || 'unknown',
            req.audit?.before ? JSON.stringify(req.audit.before) : null,
            req.audit?.after ? JSON.stringify(req.audit.after) : null
          );

          logger.info(`Audit log: ${action} by user ${req.user?.id} from IP ${req.ip}`);
        } catch (error) {
          logger.error('Failed to write audit log:', error);
        }
      }

      originalSend.call(this, data);
    };

    next();
  };
}

module.exports = auditLogger;
