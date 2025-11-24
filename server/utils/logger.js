const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        level: 'info',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: process.env.LOG_FILE || path.join(logsDir, 'app.log'),
          mkdir: true,
        },
      },
    ],
  },
});

// Ensure all standard log levels are available
// Pino should have these by default, but let's make sure
if (!logger.warn) {
  logger.warn = logger.warning || logger.info;
}

module.exports = logger;
