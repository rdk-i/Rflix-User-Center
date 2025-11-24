const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      logger.warn('Email service not configured');
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
      });

      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendEmail(to, subject, html) {
    if (!this.transporter) {
      logger.warn('Email service not available');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Rflix API" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
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
