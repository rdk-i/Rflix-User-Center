const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../config/database');
const { authenticateToken, requireAdmin, authorize } = require('../middlewares/auth');
const auditLogger = require('../middlewares/auditLogger');
const { adminLimiter } = require('../middlewares/rateLimiter');

/**
 * Package Management Routes
 */

// GET /api/subscriptions/packages - List all packages
router.get('/packages', async (req, res) => {
  try {
    const packages = db.prepare(`
      SELECT p.*, 
             COUNT(up.id) as activeSubscriptions,
             CASE 
               WHEN p.status = 'active' THEN 'Active'
               WHEN p.status = 'inactive' THEN 'Inactive'
               ELSE 'Unknown'
             END as statusLabel
      FROM packages p
      LEFT JOIN user_packages up ON p.id = up.packageId AND up.status = 'active'
      WHERE p.deleted = 0
      GROUP BY p.id
      ORDER BY p.sortOrder, p.name
    `).all();

    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    logger.error('Failed to fetch packages:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PACKAGES_FAILED',
        message: 'Failed to fetch packages'
      }
    });
  }
});

// POST /api/subscriptions/packages - Create new package
router.post('/packages', authenticateToken, requireAdmin, auditLogger('CREATE_PACKAGE'), async (req, res) => {
  try {
    const { name, description, price, duration, features, limits, status = 'active' } = req.body;

    if (!name || !price || !duration) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Name, price, and duration are required'
        }
      });
    }

    const stmt = db.prepare(`
      INSERT INTO packages (name, description, price, duration, features, limits, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(name, description, price, duration, JSON.stringify(features || {}), JSON.stringify(limits || {}), status);

    logger.info(`Package created by admin ${req.user.email}: ${name}`);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        message: 'Package created successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to create package:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_PACKAGE_FAILED',
        message: 'Failed to create package'
      }
    });
  }
});

// GET /api/subscriptions/packages/:id - Get package details
router.get('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const package = db.prepare(`
      SELECT p.*, 
             COUNT(up.id) as activeSubscriptions
      FROM packages p
      LEFT JOIN user_packages up ON p.id = up.packageId AND up.status = 'active'
      WHERE p.id = ? AND p.deleted = 0
      GROUP BY p.id
    `).get(id);

    if (!package) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found'
        }
      });
    }

    // Parse JSON fields
    package.features = JSON.parse(package.features || '{}');
    package.limits = JSON.parse(package.limits || '{}');

    res.json({
      success: true,
      data: package
    });
  } catch (error) {
    logger.error('Failed to fetch package:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PACKAGE_FAILED',
        message: 'Failed to fetch package details'
      }
    });
  }
});

// PUT /api/subscriptions/packages/:id - Update package
router.put('/packages/:id', authenticateToken, requireAdmin, auditLogger('UPDATE_PACKAGE'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, features, limits, status } = req.body;

    // Check if package exists
    const existingPackage = db.prepare('SELECT * FROM packages WHERE id = ? AND deleted = 0').get(id);
    if (!existingPackage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found'
        }
      });
    }

    const stmt = db.prepare(`
      UPDATE packages 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          duration = COALESCE(?, duration),
          features = COALESCE(?, features),
          limits = COALESCE(?, limits),
          status = COALESCE(?, status),
          updatedAt = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(
      name,
      description,
      price,
      duration,
      features ? JSON.stringify(features) : null,
      limits ? JSON.stringify(limits) : null,
      status,
      id
    );

    logger.info(`Package updated by admin ${req.user.email}: ${name || existingPackage.name}`);

    res.json({
      success: true,
      data: {
        message: 'Package updated successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to update package:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PACKAGE_FAILED',
        message: 'Failed to update package'
      }
    });
  }
});

// DELETE /api/subscriptions/packages/:id - Delete package
router.delete('/packages/:id', authenticateToken, requireAdmin, auditLogger('DELETE_PACKAGE'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if package has active subscriptions
    const activeSubs = db.prepare('SELECT COUNT(*) as count FROM user_packages WHERE packageId = ? AND status = "active"').get(id);
    if (activeSubs.count > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PACKAGE_HAS_ACTIVE_SUBSCRIPTIONS',
          message: 'Cannot delete package with active subscriptions'
        }
      });
    }

    const stmt = db.prepare('UPDATE packages SET deleted = 1, updatedAt = datetime("now") WHERE id = ?');
    const result = stmt.run(id);

    logger.info(`Package deleted by admin ${req.user.email}: Package ID ${id}`);

    res.json({
      success: true,
      data: {
        message: 'Package deleted successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to delete package:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PACKAGE_FAILED',
        message: 'Failed to delete package'
      }
    });
  }
});

// PATCH /api/subscriptions/packages/:id/toggle - Toggle package status
router.patch('/packages/:id/toggle', authenticateToken, requireAdmin, auditLogger('TOGGLE_PACKAGE_STATUS'), async (req, res) => {
  try {
    const { id } = req.params;

    const package = db.prepare('SELECT * FROM packages WHERE id = ? AND deleted = 0').get(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found'
        }
      });
    }

    const newStatus = package.status === 'active' ? 'inactive' : 'active';
    
    const stmt = db.prepare('UPDATE packages SET status = ?, updatedAt = datetime("now") WHERE id = ?');
    stmt.run(newStatus, id);

    logger.info(`Package status toggled by admin ${req.user.email}: ${package.name} (${newStatus})`);

    res.json({
      success: true,
      data: {
        message: `Package ${newStatus}`,
        status: newStatus
      }
    });
  } catch (error) {
    logger.error('Failed to toggle package status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOGGLE_STATUS_FAILED',
        message: 'Failed to toggle package status'
      }
    });
  }
});

// PUT /api/subscriptions/packages/:id/pricing - Update pricing
router.put('/packages/:id/pricing', authenticateToken, requireAdmin, auditLogger('UPDATE_PACKAGE_PRICING'), async (req, res) => {
  try {
    const { id } = req.params;
    const { price, currency = 'USD', discount, trialPeriod } = req.body;

    if (!price || price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRICE',
          message: 'Valid price is required'
        }
      });
    }

    const stmt = db.prepare(`
      UPDATE packages 
      SET price = ?,
          currency = COALESCE(?, currency),
          discount = COALESCE(?, discount),
          trialPeriod = COALESCE(?, trialPeriod),
          updatedAt = datetime('now')
      WHERE id = ?
    `);

    stmt.run(price, currency, discount, trialPeriod, id);

    logger.info(`Package pricing updated by admin ${req.user.email}: Package ID ${id}`);

    res.json({
      success: true,
      data: {
        message: 'Package pricing updated successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to update package pricing:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRICING_FAILED',
        message: 'Failed to update package pricing'
      }
    });
  }
});

// PUT /api/subscriptions/packages/:id/limits - Update usage limits
router.put('/packages/:id/limits', authenticateToken, requireAdmin, auditLogger('UPDATE_PACKAGE_LIMITS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { limits } = req.body;

    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LIMITS',
          message: 'Valid limits object is required'
        }
      });
    }

    const stmt = db.prepare(`
      UPDATE packages 
      SET limits = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(limits), id);

    logger.info(`Package limits updated by admin ${req.user.email}: Package ID ${id}`);

    res.json({
      success: true,
      data: {
        message: 'Package limits updated successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to update package limits:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_LIMITS_FAILED',
        message: 'Failed to update package limits'
      }
    });
  }
});

/**
 * Subscription Management Routes
 */

// GET /api/subscriptions/user/:userId - Get user subscriptions
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only view their own subscriptions unless they're admin
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own subscriptions'
        }
      });
    }

    const subscriptions = db.prepare(`
      SELECT up.*, p.name as packageName, p.price, p.duration, p.features, p.limits
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.userId = ?
      ORDER BY up.createdAt DESC
    `).all(userId);

    // Parse JSON fields
    subscriptions.forEach(sub => {
      sub.features = JSON.parse(sub.features || '{}');
      sub.limits = JSON.parse(sub.limits || '{}');
    });

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    logger.error('Failed to fetch user subscriptions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SUBSCRIPTIONS_FAILED',
        message: 'Failed to fetch user subscriptions'
      }
    });
  }
});

// POST /api/subscriptions/upgrade - Upgrade subscription
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { packageId, paymentMethod = 'stripe' } = req.body;
    const userId = req.user.id;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PACKAGE_ID',
          message: 'Package ID is required'
        }
      });
    }

    // Get current subscription
    const currentSub = db.prepare(`
      SELECT up.*, p.name as currentPackageName
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.userId = ? AND up.status = 'active'
      ORDER BY up.createdAt DESC
      LIMIT 1
    `).get(userId);

    // Get new package details
    const newPackage = db.prepare('SELECT * FROM packages WHERE id = ? AND status = "active" AND deleted = 0').get(packageId);
    if (!newPackage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found or not available'
        }
      });
    }

    // Check if it's actually an upgrade
    if (currentSub && newPackage.price <= currentSub.price) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_AN_UPGRADE',
          message: 'Selected package is not an upgrade from current subscription'
        }
      });
    }

    // Deactivate current subscription
    if (currentSub) {
      db.prepare('UPDATE user_packages SET status = "inactive", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);
    }

    // Create new subscription
    const newSubStmt = db.prepare(`
      INSERT INTO user_packages (userId, packageId, status, startDate, endDate, price, createdAt, updatedAt)
      VALUES (?, ?, 'active', datetime('now'), datetime('now', '+' || ? || ' days'), ?, datetime('now'), datetime('now'))
    `);

    const result = newSubStmt.run(userId, packageId, newPackage.duration, newPackage.price);

    // Log the upgrade
    db.prepare(`
      INSERT INTO subscription_history (userId, action, fromPackageId, toPackageId, timestamp, details)
      VALUES (?, 'upgrade', ?, ?, datetime('now'), ?)
    `).run(userId, currentSub?.packageId || null, packageId, JSON.stringify({ paymentMethod }));

    logger.info(`Subscription upgraded by user ${req.user.email}: ${currentSub?.currentPackageName || 'Free'} -> ${newPackage.name}`);

    res.json({
      success: true,
      data: {
        message: 'Subscription upgraded successfully',
        subscriptionId: result.lastInsertRowid,
        newPackage: newPackage.name
      }
    });
  } catch (error) {
    logger.error('Failed to upgrade subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPGRADE_FAILED',
        message: 'Failed to upgrade subscription'
      }
    });
  }
});

// POST /api/subscriptions/downgrade - Downgrade subscription
router.post('/downgrade', authenticateToken, async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PACKAGE_ID',
          message: 'Package ID is required'
        }
      });
    }

    // Get current subscription
    const currentSub = db.prepare(`
      SELECT up.*, p.name as currentPackageName, p.price as currentPrice
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.userId = ? AND up.status = 'active'
      ORDER BY up.createdAt DESC
      LIMIT 1
    `).get(userId);

    if (!currentSub) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'No active subscription found'
        }
      });
    }

    // Get new package details
    const newPackage = db.prepare('SELECT * FROM packages WHERE id = ? AND status = "active" AND deleted = 0').get(packageId);
    if (!newPackage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found or not available'
        }
      });
    }

    // Check if it's actually a downgrade
    if (newPackage.price >= currentSub.currentPrice) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_A_DOWNGRADE',
          message: 'Selected package is not a downgrade from current subscription'
        }
      });
    }

    // Schedule downgrade for end of current billing period
    db.prepare('UPDATE user_packages SET status = "downgrade_pending", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);

    // Create pending subscription for next period
    const pendingStmt = db.prepare(`
      INSERT INTO user_packages (userId, packageId, status, startDate, endDate, price, createdAt, updatedAt)
      VALUES (?, ?, 'pending', datetime('now', '+' || ? || ' days'), datetime('now', '+' || ? || ' days', '+' || ? || ' days'), ?, datetime('now'), datetime('now'))
    `);

    pendingStmt.run(userId, packageId, currentSub.duration, currentSub.duration, newPackage.duration, newPackage.price);

    // Log the downgrade
    db.prepare(`
      INSERT INTO subscription_history (userId, action, fromPackageId, toPackageId, timestamp, details)
      VALUES (?, 'downgrade_scheduled', ?, ?, datetime('now'), ?)
    `).run(userId, currentSub.packageId, packageId, JSON.stringify({ scheduled: true }));

    logger.info(`Subscription downgrade scheduled by user ${req.user.email}: ${currentSub.currentPackageName} -> ${newPackage.name}`);

    res.json({
      success: true,
      data: {
        message: 'Subscription downgrade scheduled for end of current billing period',
        newPackage: newPackage.name
      }
    });
  } catch (error) {
    logger.error('Failed to schedule downgrade:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DOWNGRADE_FAILED',
        message: 'Failed to schedule subscription downgrade'
      }
    });
  }
});

// POST /api/subscriptions/cancel - Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason, immediate = false } = req.body;
    const userId = req.user.id;

    // Get current subscription
    const currentSub = db.prepare(`
      SELECT up.*, p.name as packageName
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.userId = ? AND up.status = 'active'
      ORDER BY up.createdAt DESC
      LIMIT 1
    `).get(userId);

    if (!currentSub) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'No active subscription found'
        }
      });
    }

    if (immediate) {
      // Immediate cancellation
      db.prepare('UPDATE user_packages SET status = "cancelled", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);
    } else {
      // Cancel at end of billing period
      db.prepare('UPDATE user_packages SET status = "cancel_pending", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);
    }

    // Log the cancellation
    db.prepare(`
      INSERT INTO subscription_history (userId, action, fromPackageId, timestamp, details)
      VALUES (?, 'cancelled', ?, datetime('now'), ?)
    `).run(userId, currentSub.packageId, JSON.stringify({ reason, immediate }));

    logger.info(`Subscription cancelled by user ${req.user.email}: ${currentSub.packageName} (${immediate ? 'immediate' : 'end of period'})`);

    res.json({
      success: true,
      data: {
        message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at end of billing period',
        cancelledPackage: currentSub.packageName
      }
    });
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCEL_FAILED',
        message: 'Failed to cancel subscription'
      }
    });
  }
});

// POST /api/subscriptions/renew - Renew subscription
router.post('/renew', authenticateToken, async (req, res) => {
  try {
    const { packageId, paymentMethod = 'stripe' } = req.body;
    const userId = req.user.id;

    // Get current subscription
    const currentSub = db.prepare(`
      SELECT up.*, p.name as packageName, p.duration, p.price
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.userId = ? AND (up.status = 'active' OR up.status = 'cancel_pending')
      ORDER BY up.createdAt DESC
      LIMIT 1
    `).get(userId);

    if (!currentSub) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_SUBSCRIPTION_TO_RENEW',
          message: 'No subscription found to renew'
        }
      });
    }

    // If packageId provided, check if it's different from current
    let renewPackageId = currentSub.packageId;
    if (packageId && packageId !== currentSub.packageId) {
      const newPackage = db.prepare('SELECT * FROM packages WHERE id = ? AND status = "active" AND deleted = 0').get(packageId);
      if (!newPackage) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PACKAGE_NOT_FOUND',
            message: 'Package not found or not available'
          }
        });
      }
      renewPackageId = packageId;
    }

    // Update current subscription to renewed status
    db.prepare('UPDATE user_packages SET status = "renewed", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);

    // Create new subscription period
    const newSubStmt = db.prepare(`
      INSERT INTO user_packages (userId, packageId, status, startDate, endDate, price, createdAt, updatedAt)
      VALUES (?, ?, 'active', datetime('now'), datetime('now', '+' || ? || ' days'), ?, datetime('now'), datetime('now'))
    `);

    const result = newSubStmt.run(userId, renewPackageId, currentSub.duration, currentSub.price);

    // Log the renewal
    db.prepare(`
      INSERT INTO subscription_history (userId, action, fromPackageId, toPackageId, timestamp, details)
      VALUES (?, 'renewed', ?, ?, datetime('now'), ?)
    `).run(userId, currentSub.packageId, renewPackageId, JSON.stringify({ paymentMethod }));

    logger.info(`Subscription renewed by user ${req.user.email}: ${currentSub.packageName}`);

    res.json({
      success: true,
      data: {
        message: 'Subscription renewed successfully',
        subscriptionId: result.lastInsertRowid,
        renewedPackage: currentSub.packageName
      }
    });
  } catch (error) {
    logger.error('Failed to renew subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RENEW_FAILED',
        message: 'Failed to renew subscription'
      }
    });
  }
});

/**
 * Payment Routes
 */

// POST /api/subscriptions/payment - Process payment
router.post('/payment', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'USD', paymentMethod = 'stripe', packageId, description } = req.body;
    const userId = req.user.id;

    if (!amount || !packageId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PAYMENT_DETAILS',
          message: 'Amount and package ID are required'
        }
      });
    }

    // Validate package
    const package = db.prepare('SELECT * FROM packages WHERE id = ? AND status = "active" AND deleted = 0').get(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found or not available'
        }
      });
    }

    // Create payment record
    const paymentStmt = db.prepare(`
      INSERT INTO payments (userId, amount, currency, paymentMethod, packageId, status, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
    `);

    const result = paymentStmt.run(userId, amount, currency, paymentMethod, packageId, description || `Payment for ${package.name}`);

    // Here you would integrate with actual payment processor (Stripe, PayPal, etc.)
    // For now, we'll simulate a successful payment
    setTimeout(() => {
      db.prepare('UPDATE payments SET status = "completed", updatedAt = datetime("now") WHERE id = ?').run(result.lastInsertRowid);
    }, 2000);

    logger.info(`Payment initiated by user ${req.user.email}: ${amount} ${currency} for ${package.name}`);

    res.json({
      success: true,
      data: {
        message: 'Payment initiated successfully',
        paymentId: result.lastInsertRowid,
        amount,
        currency,
        paymentMethod
      }
    });
  } catch (error) {
    logger.error('Failed to process payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_FAILED',
        message: 'Failed to process payment'
      }
    });
  }
});

// POST /api/subscriptions/payment/stripe/webhook - Stripe webhook
router.post('/payment/stripe/webhook', async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature (implement based on Stripe docs)
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    logger.info('Stripe webhook received:', { type: event.type, id: event.id });

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Update payment status
        db.prepare('UPDATE payments SET status = "completed", transactionId = ?, updatedAt = datetime("now") WHERE id = ?')
          .run(paymentIntent.id, paymentIntent.metadata.paymentId);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        // Update payment status
        db.prepare('UPDATE payments SET status = "failed", transactionId = ?, updatedAt = datetime("now") WHERE id = ?')
          .run(failedPayment.id, failedPayment.metadata.paymentId);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// POST /api/subscriptions/payment/paypal/webhook - PayPal webhook
router.post('/payment/paypal/webhook', async (req, res) => {
  try {
    const event = req.body;

    logger.info('PayPal webhook received:', { event_type: event.event_type, id: event.id });

    switch (event.event_type) {
      case 'PAYMENT.COMPLETED':
        // Update payment status
        const paymentId = event.resource.invoice_number; // Assuming payment ID is in invoice_number
        db.prepare('UPDATE payments SET status = "completed", transactionId = ?, updatedAt = datetime("now") WHERE id = ?')
          .run(event.resource.id, paymentId);
        break;

      case 'PAYMENT.FAILED':
        // Update payment status
        db.prepare('UPDATE payments SET status = "failed", transactionId = ?, updatedAt = datetime("now") WHERE id = ?')
          .run(event.resource.id, event.resource.invoice_number);
        break;

      default:
        logger.info(`Unhandled PayPal event type: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('PayPal webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// GET /api/subscriptions/payments/history - Get payment history
router.get('/payments/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT p.*, pkg.name as packageName
      FROM payments p
      LEFT JOIN packages pkg ON p.packageId = pkg.id
      WHERE p.userId = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const payments = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM payments WHERE userId = ?' + (status ? ' AND status = ?' : '')).get(...params.slice(0, status ? 2 : 1));

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total.count,
          pages: Math.ceil(total.count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch payment history:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PAYMENT_HISTORY_FAILED',
        message: 'Failed to fetch payment history'
      }
    });
  }
});

// POST /api/subscriptions/refund - Process refund
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { paymentId, reason, amount } = req.body;

    if (!paymentId || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFUND_DETAILS',
          message: 'Payment ID and reason are required'
        }
      });
    }

    // Get payment details
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND userId = ?').get(paymentId, req.user.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found'
        }
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_COMPLETED',
          message: 'Only completed payments can be refunded'
        }
      });
    }

    // Create refund record
    const refundStmt = db.prepare(`
      INSERT INTO refunds (paymentId, userId, amount, reason, status, createdAt, updatedAt)
      VALUES (?, ?, COALESCE(?, ?), ?, 'pending', datetime('now'), datetime('now'))
    `);

    const result = refundStmt.run(paymentId, req.user.id, amount, payment.amount, reason);

    // Update payment status
    db.prepare('UPDATE payments SET status = "refund_pending", updatedAt = datetime("now") WHERE id = ?').run(paymentId);

    logger.info(`Refund requested by user ${req.user.email}: Payment ID ${paymentId}, Amount ${amount || payment.amount}`);

    res.json({
      success: true,
      data: {
        message: 'Refund request submitted successfully',
        refundId: result.lastInsertRowid
      }
    });
  } catch (error) {
    logger.error('Failed to process refund:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFUND_FAILED',
        message: 'Failed to process refund request'
      }
    });
  }
});

/**
 * Analytics Routes
 */

// GET /api/subscriptions/analytics - Get package analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Package performance metrics
    const packageStats = db.prepare(`
      SELECT 
        p.name,
        p.price,
        COUNT(up.id) as totalSubscriptions,
        COUNT(CASE WHEN up.status = 'active' THEN 1 END) as activeSubscriptions,
        SUM(CASE WHEN up.status = 'active' THEN p.price ELSE 0 END) as monthlyRevenue,
        AVG(CASE WHEN up.status = 'cancelled' THEN julianday('now') - julianday(up.createdAt) END) as avgDurationDays
      FROM packages p
      LEFT JOIN user_packages up ON p.id = up.packageId
      WHERE p.deleted = 0
      GROUP BY p.id
      ORDER BY totalSubscriptions DESC
    `).all();

    // Revenue trends
    const revenueTrends = db.prepare(`
      SELECT 
        DATE(createdAt) as date,
        SUM(price) as dailyRevenue,
        COUNT(*) as newSubscriptions
      FROM user_packages
      WHERE status = 'active'
      ${startDate ? 'AND DATE(createdAt) >= DATE(?)' : ''}
      ${endDate ? 'AND DATE(createdAt) <= DATE(?)' : ''}
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `).all(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    // Churn rate
    const churnData = db.prepare(`
      SELECT 
        DATE(updatedAt) as date,
        COUNT(*) as cancellations,
        CASE 
          WHEN DATE(updatedAt) >= DATE('now', '-7 days') THEN 'week'
          WHEN DATE(updatedAt) >= DATE('now', '-30 days') THEN 'month'
          ELSE 'older'
        END as period
      FROM user_packages
      WHERE status = 'cancelled'
      GROUP BY DATE(updatedAt)
      ORDER BY date DESC
    `).all();

    res.json({
      success: true,
      data: {
        packageStats,
        revenueTrends,
        churnData,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ANALYTICS_FAILED',
        message: 'Failed to fetch subscription analytics'
      }
    });
  }
});

// GET /api/subscriptions/analytics/performance - Get performance metrics
router.get('/analytics/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Conversion rates
    const conversionRates = db.prepare(`
      SELECT 
        DATE(u.createdAt) as date,
        COUNT(DISTINCT u.id) as totalUsers,
        COUNT(DISTINCT up.userId) as paidUsers,
        ROUND(COUNT(DISTINCT up.userId) * 100.0 / COUNT(DISTINCT u.id), 2) as conversionRate
      FROM api_users u
      LEFT JOIN user_packages up ON u.id = up.userId AND up.status = 'active'
      WHERE DATE(u.createdAt) >= DATE('now', '-30 days')
      GROUP BY DATE(u.createdAt)
      ORDER BY date DESC
    `).all();

    // Monthly recurring revenue (MRR)
    const mrr = db.prepare(`
      SELECT 
        SUM(p.price) as mrr,
        COUNT(DISTINCT up.userId) as activeSubscribers
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.status = 'active'
    `).get();

    // Average revenue per user (ARPU)
    const arpu = db.prepare(`
      SELECT 
        ROUND(AVG(p.price), 2) as arpu,
        COUNT(DISTINCT up.userId) as paidUsers
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.status = 'active'
    `).get();

    // Customer lifetime value (CLV) estimation
    const clvData = db.prepare(`
      SELECT 
        p.name as packageName,
        AVG(CASE WHEN up.status = 'cancelled' THEN julianday(up.updatedAt) - julianday(up.createdAt) END) as avgLifetimeDays,
        AVG(p.price) as avgPackagePrice,
        ROUND(AVG(CASE WHEN up.status = 'cancelled' THEN julianday(up.updatedAt) - julianday(up.createdAt) END) * AVG(p.price) / 30, 2) as estimatedClv
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.status IN ('active', 'cancelled')
      GROUP BY p.id
    `).all();

    res.json({
      success: true,
      data: {
        conversionRates,
        mrr,
        arpu,
        clvData,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch performance metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PERFORMANCE_FAILED',
        message: 'Failed to fetch performance metrics'
      }
    });
  }
});

// GET /api/subscriptions/analytics/trends - Get trend analysis
router.get('/analytics/trends', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let dateFilter = '';
    switch (period) {
      case '7d':
        dateFilter = "AND DATE(createdAt) >= DATE('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND DATE(createdAt) >= DATE('now', '-30 days')";
        break;
      case '90d':
        dateFilter = "AND DATE(createdAt) >= DATE('now', '-90 days')";
        break;
      case '1y':
        dateFilter = "AND DATE(createdAt) >= DATE('now', '-1 year')";
        break;
    }

    // Subscription trends
    const subscriptionTrends = db.prepare(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as newSubscriptions,
        SUM(price) as revenue
      FROM user_packages
      WHERE status = 'active'
      ${dateFilter}
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `).all();

    // Cancellation trends
    const cancellationTrends = db.prepare(`
      SELECT 
        DATE(updatedAt) as date,
        COUNT(*) as cancellations
      FROM user_packages
      WHERE status = 'cancelled'
      ${dateFilter.replace('createdAt', 'updatedAt')}
      GROUP BY DATE(updatedAt)
      ORDER BY date ASC
    `).all();

    // Package popularity trends
    const packageTrends = db.prepare(`
      SELECT 
        p.name as packageName,
        DATE(up.createdAt) as date,
        COUNT(*) as subscriptions
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.status = 'active'
      ${dateFilter}
      GROUP BY p.name, DATE(up.createdAt)
      ORDER BY date ASC
    `).all();

    res.json({
      success: true,
      data: {
        subscriptionTrends,
        cancellationTrends,
        packageTrends,
        period,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch trend analysis:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TRENDS_FAILED',
        message: 'Failed to fetch trend analysis'
      }
    });
  }
});

// GET /api/subscriptions/analytics/export - Export analytics data
router.get('/analytics/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    // Get comprehensive analytics data
    const analyticsData = {
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      packageAnalytics: db.prepare(`
        SELECT 
          p.*,
          COUNT(up.id) as totalSubscriptions,
          COUNT(CASE WHEN up.status = 'active' THEN 1 END) as activeSubscriptions,
          SUM(CASE WHEN up.status = 'active' THEN p.price ELSE 0 END) as monthlyRevenue
        FROM packages p
        LEFT JOIN user_packages up ON p.id = up.packageId
        WHERE p.deleted = 0
        GROUP BY p.id
      `).all(),
      subscriptionMetrics: db.prepare(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(price) as avgPrice
        FROM user_packages
        GROUP BY status
      `).all(),
      revenueSummary: db.prepare(`
        SELECT 
          SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as activeMRR,
          SUM(price) as totalRevenue,
          COUNT(DISTINCT userId) as totalSubscribers
        FROM user_packages
      `).get(),
      recentActivity: db.prepare(`
        SELECT 
          up.*,
          p.name as packageName,
          u.email as userEmail
        FROM user_packages up
        JOIN packages p ON up.packageId = p.id
        JOIN api_users u ON up.userId = u.id
        ORDER BY up.createdAt DESC
        LIMIT 100
      `).all()
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Package,Name,Price,Active Subscriptions,Total Revenue\n';
      const csvRows = analyticsData.packageAnalytics.map(pkg => 
        `${pkg.id},${pkg.name},${pkg.price},${pkg.activeSubscriptions},${pkg.monthlyRevenue}`
      ).join('\n');

      const csvContent = csvHeaders + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="subscription-analytics.csv"');
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: analyticsData
      });
    }
  } catch (error) {
    logger.error('Failed to export analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: 'Failed to export analytics data'
      }
    });
  }
});

/**
 * Admin Routes
 */

// GET /api/subscriptions/admin/dashboard - Get admin dashboard data
router.get('/admin/dashboard', authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  try {
    // Key metrics
    const metrics = {
      totalRevenue: db.prepare('SELECT SUM(price) as total FROM user_packages WHERE status = "active"').get(),
      activeSubscriptions: db.prepare('SELECT COUNT(*) as count FROM user_packages WHERE status = "active"').get(),
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM api_users').get(),
      newSubscriptionsThisMonth: db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_packages 
        WHERE status = "active" 
        AND DATE(createdAt) >= DATE('now', 'start of month')
      `).get(),
      churnRateThisMonth: db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_packages 
        WHERE status = "cancelled" 
        AND DATE(updatedAt) >= DATE('now', 'start of month')
      `).get()
    };

    // Recent subscriptions
    const recentSubscriptions = db.prepare(`
      SELECT 
        up.*,
        p.name as packageName,
        u.email as userEmail,
        u.username
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      JOIN api_users u ON up.userId = u.id
      ORDER BY up.createdAt DESC
      LIMIT 10
    `).all();

    // Top packages
    const topPackages = db.prepare(`
      SELECT 
        p.name,
        p.price,
        COUNT(up.id) as subscriptionCount,
        SUM(CASE WHEN up.status = 'active' THEN 1 ELSE 0 END) as activeCount
      FROM packages p
      LEFT JOIN user_packages up ON p.id = up.packageId
      WHERE p.deleted = 0
      GROUP BY p.id
      ORDER BY subscriptionCount DESC
      LIMIT 5
    `).all();

    // Pending actions
    const pendingActions = {
      pendingRefunds: db.prepare('SELECT COUNT(*) as count FROM refunds WHERE status = "pending"').get(),
      failedPayments: db.prepare('SELECT COUNT(*) as count FROM payments WHERE status = "failed"').get(),
      expiringSubscriptions: db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_packages 
        WHERE status = 'active' 
        AND DATE(endDate) <= DATE('now', '+7 days')
        AND DATE(endDate) >= DATE('now')
      `).get()
    };

    res.json({
      success: true,
      data: {
        metrics,
        recentSubscriptions,
        topPackages,
        pendingActions,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch admin dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_DASHBOARD_FAILED',
        message: 'Failed to fetch admin dashboard data'
      }
    });
  }
});

// GET /api/subscriptions/admin/users - Get user subscription management data
router.get('/admin/users', authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, packageId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        u.id,
        u.email,
        u.username,
        u.createdAt as userSince,
        up.packageId,
        up.status as subscriptionStatus,
        up.startDate,
        up.endDate,
        p.name as packageName,
        p.price as packagePrice,
        CASE 
          WHEN up.status = 'active' AND DATE(up.endDate) <= DATE('now', '+7 days') THEN 'expiring'
          WHEN up.status = 'cancel_pending' THEN 'cancelling'
          WHEN up.status = 'downgrade_pending' THEN 'downgrading'
          ELSE up.status
        END as alertStatus
      FROM api_users u
      LEFT JOIN user_packages up ON u.id = up.userId
      LEFT JOIN packages p ON up.packageId = p.id
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      query += ' AND (u.email LIKE ? OR u.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND up.status = ?';
      params.push(status);
    }

    if (packageId) {
      query += ' AND up.packageId = ?';
      params.push(packageId);
    }

    query += ' ORDER BY u.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(DISTINCT u.id) as total FROM api_users u LEFT JOIN user_packages up ON u.id = up.userId WHERE 1=1';
    const countParams = [];

    if (search) {
      countQuery += ' AND (u.email LIKE ? OR u.username LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      countQuery += ' AND up.status = ?';
      countParams.push(status);
    }

    if (packageId) {
      countQuery += ' AND up.packageId = ?';
      countParams.push(packageId);
    }

    const total = db.prepare(countQuery).get(...countParams);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total.total,
          pages: Math.ceil(total.total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch user subscription data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USERS_FAILED',
        message: 'Failed to fetch user subscription data'
      }
    });
  }
});

// GET /api/subscriptions/admin/revenue - Get revenue reporting data
router.get('/admin/revenue', authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    let dateGroup = 'DATE';
    switch (groupBy) {
      case 'week':
        dateGroup = "DATE(createdAt, 'weekday 0', '-6 days')";
        break;
      case 'month':
        dateGroup = "DATE(createdAt, 'start of month')";
        break;
      case 'year':
        dateGroup = "DATE(createdAt, 'start of year')";
        break;
    }

    // Revenue by period
    const revenueByPeriod = db.prepare(`
      SELECT 
        ${dateGroup}(up.createdAt) as period,
        SUM(up.price) as revenue,
        COUNT(*) as newSubscriptions,
        AVG(up.price) as avgSubscriptionValue
      FROM user_packages up
      WHERE up.status = 'active'
      ${startDate ? 'AND DATE(up.createdAt) >= DATE(?)' : ''}
      ${endDate ? 'AND DATE(up.createdAt) <= DATE(?)' : ''}
      GROUP BY ${dateGroup}(up.createdAt)
      ORDER BY period DESC
    `).all(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    // Revenue by package
    const revenueByPackage = db.prepare(`
      SELECT 
        p.name as packageName,
        SUM(up.price) as totalRevenue,
        COUNT(up.id) as subscriptionCount,
        AVG(up.price) as avgPrice
      FROM user_packages up
      JOIN packages p ON up.packageId = p.id
      WHERE up.status = 'active'
      ${startDate ? 'AND DATE(up.createdAt) >= DATE(?)' : ''}
      ${endDate ? 'AND DATE(up.createdAt) <= DATE(?)' : ''}
      GROUP BY p.id, p.name
      ORDER BY totalRevenue DESC
    `).all(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    // Payment method breakdown
    const paymentMethodBreakdown = db.prepare(`
      SELECT 
        paymentMethod,
        COUNT(*) as transactionCount,
        SUM(amount) as totalAmount,
        AVG(amount) as avgAmount
      FROM payments
      WHERE status = 'completed'
      ${startDate ? 'AND DATE(createdAt) >= DATE(?)' : ''}
      ${endDate ? 'AND DATE(createdAt) <= DATE(?)' : ''}
      GROUP BY paymentMethod
      ORDER BY totalAmount DESC
    `).all(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    // Refunds and disputes
    const refunds = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as totalAmount
      FROM refunds
      WHERE 1=1
      ${startDate ? 'AND DATE(createdAt) >= DATE(?)' : ''}
      ${endDate ? 'AND DATE(createdAt) <= DATE(?)' : ''}
      GROUP BY status
    `).all(...(startDate && endDate ? [startDate, endDate] : startDate ? [startDate] : endDate ? [endDate] : []));

    res.json({
      success: true,
      data: {
        revenueByPeriod,
        revenueByPackage,
        paymentMethodBreakdown,
        refunds,
        currency: 'USD',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch revenue data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REVENUE_FAILED',
        message: 'Failed to fetch revenue reporting data'
      }
    });
  }
});

// GET /api/subscriptions/admin/usage - Get usage monitoring data
router.get('/admin/usage', authenticateToken, requireAdmin, adminLimiter, async (req, res) => {
  try {
    // API usage by subscription tier
    const apiUsageByTier = db.prepare(`
      SELECT 
        p.name as packageName,
        COUNT(DISTINCT u.id) as userCount,
        AVG(u.apiCalls) as avgApiCalls,
        MAX(u.apiCalls) as maxApiCalls,
        SUM(u.apiCalls) as totalApiCalls
      FROM api_users u
      LEFT JOIN user_packages up ON u.id = up.userId AND up.status = 'active'
      LEFT JOIN packages p ON up.packageId = p.id
      GROUP BY p.name
      ORDER BY totalApiCalls DESC
    `).all();

    // Storage usage by user
    const storageUsage = db.prepare(`
      SELECT 
        u.email,
        u.username,
        p.name as packageName,
        u.storageUsed,
        JSON_EXTRACT(p.limits, '$.storage') as packageStorageLimit,
        CASE 
          WHEN JSON_EXTRACT(p.limits, '$.storage') > 0 THEN ROUND(u.storageUsed * 100.0 / JSON_EXTRACT(p.limits, '$.storage'), 2)
          ELSE 0
        END as storageUsagePercentage
      FROM api_users u
      LEFT JOIN user_packages up ON u.id = up.userId AND up.status = 'active'
      LEFT JOIN packages p ON up.packageId = p.id
      WHERE u.storageUsed > 0
      ORDER BY storageUsagePercentage DESC
      LIMIT 50
    `).all();

    // Bandwidth usage trends
    const bandwidthTrends = db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        SUM(bandwidthUsed) as totalBandwidth,
        COUNT(DISTINCT userId) as activeUsers,
        AVG(bandwidthUsed) as avgBandwidthPerUser
      FROM user_bandwidth_usage
      WHERE DATE(timestamp) >= DATE('now', '-30 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `).all();

    // Overlimit alerts
    const overlimitUsers = db.prepare(`
      SELECT 
        u.email,
        u.username,
        p.name as packageName,
        u.apiCalls,
        JSON_EXTRACT(p.limits, '$.apiCalls') as apiLimit,
        u.storageUsed,
        JSON_EXTRACT(p.limits, '$.storage') as storageLimit,
        CASE 
          WHEN JSON_EXTRACT(p.limits, '$.apiCalls') > 0 AND u.apiCalls > JSON_EXTRACT(p.limits, '$.apiCalls') THEN 'api_overlimit'
          WHEN JSON_EXTRACT(p.limits, '$.storage') > 0 AND u.storageUsed > JSON_EXTRACT(p.limits, '$.storage') THEN 'storage_overlimit'
          ELSE 'within_limits'
        END as overlimitType
      FROM api_users u
      LEFT JOIN user_packages up ON u.id = up.userId AND up.status = 'active'
      LEFT JOIN packages p ON up.packageId = p.id
      WHERE (JSON_EXTRACT(p.limits, '$.apiCalls') > 0 AND u.apiCalls > JSON_EXTRACT(p.limits, '$.apiCalls'))
         OR (JSON_EXTRACT(p.limits, '$.storage') > 0 AND u.storageUsed > JSON_EXTRACT(p.limits, '$.storage'))
    `).all();

    res.json({
      success: true,
      data: {
        apiUsageByTier,
        storageUsage,
        bandwidthTrends,
        overlimitUsers,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to fetch usage data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USAGE_FAILED',
        message: 'Failed to fetch usage monitoring data'
      }
    });
  }
});

/**
 * Admin Settings Routes
 */

// GET /api/subscriptions/admin/settings - Get subscription settings
router.get('/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT * FROM settings WHERE category = 'subscriptions' OR category = 'payments'
    `).all();
    
    const settingsMap = {};
    settings.forEach(setting => {
      if (!settingsMap[setting.category]) {
        settingsMap[setting.category] = {};
      }
      settingsMap[setting.category][setting.key] = setting.value;
    });
    
    res.json({
      success: true,
      data: {
        paymentGateway: settingsMap.payments || {},
        subscription: settingsMap.subscriptions || {}
      }
    });
  } catch (error) {
    logger.error('Failed to fetch subscription settings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_SETTINGS_FAILED',
        message: 'Failed to fetch subscription settings'
      }
    });
  }
});

// POST /api/subscriptions/admin/settings - Update subscription settings
router.post('/admin/settings', authenticateToken, requireAdmin, auditLogger('UPDATE_SUBSCRIPTION_SETTINGS'), async (req, res) => {
  try {
    const { paymentGateway, subscription } = req.body;
    
    // Update payment gateway settings
    if (paymentGateway) {
      Object.entries(paymentGateway).forEach(([key, value]) => {
        db.prepare(`
          INSERT OR REPLACE INTO settings (category, key, value, updatedAt)
          VALUES ('payments', ?, ?, datetime('now'))
        `).run(key, value);
      });
    }
    
    // Update subscription settings
    if (subscription) {
      Object.entries(subscription).forEach(([key, value]) => {
        db.prepare(`
          INSERT OR REPLACE INTO settings (category, key, value, updatedAt)
          VALUES ('subscriptions', ?, ?, datetime('now'))
        `).run(key, value);
      });
    }
    
    logger.info(`Subscription settings updated by admin ${req.user.email}`);
    
    res.json({
      success: true,
      data: {
        message: 'Settings updated successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to update subscription settings:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_SETTINGS_FAILED',
        message: 'Failed to update subscription settings'
      }
    });
  }
});

/**
 * Bulk Operations Routes
 */

// POST /api/subscriptions/admin/bulk/cancel - Bulk cancel subscriptions
router.post('/admin/bulk/cancel', authenticateToken, requireAdmin, auditLogger('BULK_CANCEL_SUBSCRIPTIONS'), async (req, res) => {
  try {
    const { userIds, reason = 'Bulk cancellation by admin' } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_IDS',
          message: 'Valid user IDs array is required'
        }
      });
    }
    
    let cancelledCount = 0;
    const errors = [];
    
    for (const userId of userIds) {
      try {
        // Get active subscription
        const subscription = db.prepare(`
          SELECT up.*, p.name as packageName
          FROM user_packages up
          JOIN packages p ON up.packageId = p.id
          WHERE up.userId = ? AND up.status = 'active'
          ORDER BY up.createdAt DESC
          LIMIT 1
        `).get(userId);
        
        if (subscription) {
          // Cancel subscription
          db.prepare('UPDATE user_packages SET status = "cancelled", updatedAt = datetime("now") WHERE id = ?').run(subscription.id);
          
          // Log the cancellation
          db.prepare(`
            INSERT INTO subscription_history (userId, action, fromPackageId, timestamp, details)
            VALUES (?, 'cancelled', ?, datetime('now'), ?)
          `).run(userId, subscription.packageId, JSON.stringify({ reason, bulk: true }));
          
          cancelledCount++;
          
          // Notify WebSocket clients
          if (req.wsServer) {
            req.wsServer.notifySubscriptionCancelled({
              userId,
              subscriptionId: subscription.id,
              packageName: subscription.packageName,
              reason
            }, req.user.id);
          }
        }
      } catch (error) {
        logger.error(`Failed to cancel subscription for user ${userId}:`, error);
        errors.push({ userId, error: error.message });
      }
    }
    
    logger.info(`Bulk cancellation completed by admin ${req.user.email}: ${cancelledCount} subscriptions cancelled`);
    
    res.json({
      success: true,
      data: {
        cancelledCount,
        errors,
        message: `Successfully cancelled ${cancelledCount} subscriptions`
      }
    });
  } catch (error) {
    logger.error('Failed to bulk cancel subscriptions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BULK_CANCEL_FAILED',
        message: 'Failed to bulk cancel subscriptions'
      }
    });
  }
});

// POST /api/subscriptions/admin/bulk/upgrade - Bulk upgrade subscriptions
router.post('/admin/bulk/upgrade', authenticateToken, requireAdmin, auditLogger('BULK_UPGRADE_SUBSCRIPTIONS'), async (req, res) => {
  try {
    const { userIds, packageId, reason = 'Bulk upgrade by admin' } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_IDS',
          message: 'Valid user IDs array is required'
        }
      });
    }
    
    // Validate package
    const newPackage = db.prepare('SELECT * FROM packages WHERE id = ? AND status = "active" AND deleted = 0').get(packageId);
    if (!newPackage) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: 'Package not found or not available'
        }
      });
    }
    
    let upgradedCount = 0;
    const errors = [];
    
    for (const userId of userIds) {
      try {
        // Get current subscription
        const currentSub = db.prepare(`
          SELECT up.*, p.name as currentPackageName, p.price as currentPrice
          FROM user_packages up
          JOIN packages p ON up.packageId = p.id
          WHERE up.userId = ? AND up.status = 'active'
          ORDER BY up.createdAt DESC
          LIMIT 1
        `).get(userId);
        
        if (currentSub && newPackage.price > currentSub.currentPrice) {
          // Deactivate current subscription
          db.prepare('UPDATE user_packages SET status = "inactive", updatedAt = datetime("now") WHERE id = ?').run(currentSub.id);
          
          // Create new subscription
          const newSubStmt = db.prepare(`
            INSERT INTO user_packages (userId, packageId, status, startDate, endDate, price, createdAt, updatedAt)
            VALUES (?, ?, 'active', datetime('now'), datetime('now', '+' || ? || ' days'), ?, datetime('now'), datetime('now'))
          `);
          
          const result = newSubStmt.run(userId, packageId, newPackage.duration, newPackage.price);
          
          // Log the upgrade
          db.prepare(`
            INSERT INTO subscription_history (userId, action, fromPackageId, toPackageId, timestamp, details)
            VALUES (?, 'upgrade', ?, ?, datetime('now'), ?)
          `).run(userId, currentSub.packageId, packageId, JSON.stringify({ reason, bulk: true }));
          
          upgradedCount++;
          
          // Notify WebSocket clients
          if (req.wsServer) {
            req.wsServer.notifySubscriptionUpdated({
              userId,
              subscriptionId: result.lastInsertRowid,
              fromPackage: currentSub.currentPackageName,
              toPackage: newPackage.name,
              reason
            }, req.user.id);
          }
        }
      } catch (error) {
        logger.error(`Failed to upgrade subscription for user ${userId}:`, error);
        errors.push({ userId, error: error.message });
      }
    }
    
    logger.info(`Bulk upgrade completed by admin ${req.user.email}: ${upgradedCount} subscriptions upgraded to ${newPackage.name}`);
    
    res.json({
      success: true,
      data: {
        upgradedCount,
        errors,
        message: `Successfully upgraded ${upgradedCount} subscriptions to ${newPackage.name}`
      }
    });
  } catch (error) {
    logger.error('Failed to bulk upgrade subscriptions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BULK_UPGRADE_FAILED',
        message: 'Failed to bulk upgrade subscriptions'
      }
    });
  }
});


module.exports = router;