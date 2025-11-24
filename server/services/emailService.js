const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.healthStatus = 'unknown';
    this.lastHealthCheck = null;
    this.sentEmails = 0;
    this.failedEmails = 0;
    this.emailQueue = [];
    this.isProcessingQueue = false;
    
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      logger.warn('Email service not configured');
      this.healthStatus = 'not_configured';
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        // Add connection pooling and timeout settings
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
        // Timeout settings
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });

      this.isConfigured = true;
      logger.info('Email service initialized with connection pooling');
      
      // Verify connection
      this.verifyConnection();
    } catch (error) {
      this.healthStatus = 'error';
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Verify SMTP connection and credentials
   */
  async verifyConnection() {
    if (!this.transporter) {
      this.healthStatus = 'error';
      return { valid: false, error: 'Transporter not initialized' };
    }

    try {
      const startTime = Date.now();
      const result = await this.transporter.verify();
      const duration = Date.now() - startTime;
      
      if (result) {
        this.healthStatus = 'healthy';
        this.lastHealthCheck = new Date();
        logger.info(`Email service verification passed in ${duration}ms`);
        return { valid: true, responseTime: duration };
      } else {
        this.healthStatus = 'error';
        logger.warn('Email service verification failed');
        return { valid: false, error: 'Verification returned false' };
      }
    } catch (error) {
      this.healthStatus = 'error';
      logger.error('Email service verification failed:', {
        error: error.message,
        code: error.code,
        response: error.response
      });
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get current email service health status
   */
  getHealthStatus() {
    return {
      status: this.healthStatus,
      lastCheck: this.lastHealthCheck,
      isConfigured: this.isConfigured,
      sentEmails: this.sentEmails,
      failedEmails: this.failedEmails,
      successRate: (this.sentEmails + this.failedEmails) > 0
        ? (this.sentEmails / (this.sentEmails + this.failedEmails) * 100).toFixed(2) + '%'
        : '0%',
      queueSize: this.emailQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  /**
   * Enhanced email sending with retry logic and queue management
   */
  async sendEmail(to, subject, html, options = {}) {
    if (!this.transporter) {
      logger.warn('Email service not available');
      return { success: false, error: 'Email service not configured' };
    }

    const emailId = Date.now() + Math.random();
    const emailData = {
      id: emailId,
      to,
      subject,
      html,
      options,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      priority: options.priority || 'normal',
      timestamp: new Date()
    };

    // Add to queue for processing
    this.emailQueue.push(emailData);
    this.processEmailQueue();
    
    return { success: true, queued: true, emailId };
  }

  /**
   * Process email queue with retry logic
   */
  async processEmailQueue() {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.emailQueue.length > 0) {
      const emailData = this.emailQueue.shift();
      
      try {
        const result = await this.sendEmailWithRetry(emailData);
        
        if (result.success) {
          this.sentEmails++;
          logger.info(`Email sent successfully: ${emailData.to} (attempt ${emailData.attempts})`);
        } else {
          this.failedEmails++;
          logger.error(`Email failed after ${emailData.attempts} attempts: ${emailData.to}`, {
            error: result.error,
            emailId: emailData.id
          });
        }
      } catch (error) {
        this.failedEmails++;
        logger.error(`Email processing error: ${emailData.to}`, {
          error: error.message,
          emailId: emailData.id
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send email with retry logic and exponential backoff
   */
  async sendEmailWithRetry(emailData) {
    const { to, subject, html, maxAttempts } = emailData;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      emailData.attempts = attempt;
      
      try {
        const startTime = Date.now();
        const info = await this.transporter.sendMail({
          from: `"Rflix API" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html,
          // Add retry options
          retryDelay: 1000,
          retryAttempts: 1
        });

        const duration = Date.now() - startTime;
        logger.info(`Email sent to ${to}: ${info.messageId} in ${duration}ms (attempt ${attempt})`);
        
        return {
          success: true,
          messageId: info.messageId,
          responseTime: duration,
          attempts: attempt
        };
      } catch (error) {
        logger.warn(`Email attempt ${attempt} failed for ${to}:`, {
          error: error.message,
          code: error.code,
          response: error.response,
          attempts: attempt
        });

        // Don't retry on certain errors
        if (error.code === 'EAUTH' || error.code === 'ESOCKET') {
          logger.error(`Email authentication/connection error, not retrying: ${error.code}`);
          return { success: false, error: error.message, code: error.code };
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          logger.info(`Retrying email to ${to} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, error: 'Max retry attempts exceeded' };
  }

  async sendWelcomeEmail(email, username) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6C5CE7;">Welcome to Rflix!</h2>
        <p>Hello ${username},</p>
        <p>Your registration has been approved! You can now access the Rflix media streaming service.</p>
        <p>Login at: <a href="${process.env.APP_URL || 'http://localhost:3000'}/user_login.html">Rflix Login</a></p>
        <p>Thank you for joining us!</p>
        <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail(email, 'Welcome to Rflix!', html);
  }

  async sendExpirationWarning(email, username, daysRemaining) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF7675;">Subscription Expiring Soon</h2>
        <p>Hello ${username},</p>
        <p>Your Rflix subscription will expire in <strong>${daysRemaining} days</strong>.</p>
        <p>To continue enjoying our service, please renew your subscription.</p>
        <p>Renew now: <a href="${process.env.APP_URL || 'http://localhost:3000'}/user_dashboard.html">Renew Subscription</a></p>
        <p>Thank you!</p>
        <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail(email, 'Subscription Expiring Soon', html);
  }

  async sendSubscriptionExpired(email, username) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D63031;">Subscription Expired</h2>
        <p>Hello ${username},</p>
        <p>Your Rflix subscription has expired. Your account has been disabled.</p>
        <p>To regain access, please renew your subscription.</p>
        <p>Renew now: <a href="${process.env.APP_URL || 'http://localhost:3000'}/user_dashboard.html">Renew Subscription</a></p>
        <p>Thank you!</p>
        <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.sendEmail(email, 'Subscription Expired', html);
  }
}

module.exports = new EmailService();
