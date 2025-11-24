const axios = require('axios');
const logger = require('../utils/logger');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(chatId, text, options = {}) {
    if (!this.botToken) {
      logger.warn('Telegram bot token not configured');
      return { success: false, error: 'Telegram not configured' };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.silent || false,
      });

      logger.info(`Telegram message sent to ${chatId}`);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Failed to send Telegram message:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeMessage(chatId, username) {
    const text = `
🎉 <b>Welcome to Rflix!</b>

Hello ${username}! 

Your registration has been approved. You can now access unlimited streaming on Rflix.

Login here: ${process.env.APP_URL || 'http://localhost:3000'}/user_login.html

Enjoy! 🍿
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendExpirationWarning(chatId, username, daysRemaining) {
    const text = `
⚠️ <b>Subscription Expiring Soon</b>

Hello ${username},

Your Rflix subscription will expire in <b>${daysRemaining} days</b>.

Please renew to continue enjoying our service.

Renew: ${process.env.APP_URL || 'http://localhost:3000'}/user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendSubscriptionExpired(chatId, username) {
    const text = `
❌ <b>Subscription Expired</b>

Hello ${username},

Your Rflix subscription has expired and your account has been disabled.

Renew now: ${process.env.APP_URL || 'http://localhost:3000'}/user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendNewRegistrationAlert(adminChatId, email, packageMonths) {
    const text = `
🔔 <b>New Registration</b>

Email: ${email}
Package: ${packageMonths} month(s)

Please review and approve/reject.
    `.trim();

    return this.sendMessage(adminChatId, text);
  }

  async sendUsageAlertMessage(chatId, alertMessage) {
    const text = `
⚠️ <b>Usage Alert</b>

We noticed high usage on your account:

<pre>${alertMessage}</pre>

Please monitor your usage to avoid service interruption.

View usage: /user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendLimitWarningMessage(chatId, limitType, limitValue) {
    const text = `
⚠️ <b>Usage Limit Warning</b>

You have reached your <b>${limitType}</b> limit of <b>${limitValue}</b>.

Please consider upgrading your subscription to avoid service interruption.

Upgrade: /user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendOverLimitMessage(chatId, limitType, limitValue) {
    const text = `
❌ <b>Service Limited</b>

Your account has been restricted because you exceeded your <b>${limitType}</b> limit of <b>${limitValue}</b>.

To regain access, please upgrade your subscription.

Upgrade now: /user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }

  async sendUpgradeSuggestionMessage(chatId, suggestionMessage) {
    const text = `
💡 <b>Upgrade Suggestion</b>

${suggestionMessage}

Upgrade your plan for:
• Higher usage limits
• Priority support  
• Advanced features
• Better performance

Upgrade now: /user_dashboard.html
    `.trim();

    return this.sendMessage(chatId, text);
  }
}

module.exports = new TelegramService();
