// Mock database for testing when better-sqlite3 has compilation issues
const logger = require('../utils/logger');

logger.info('Using mock database for testing purposes');

const mockDb = {
  prepare: (query) => {
    return {
      run: (...params) => {
        logger.debug(`Mock DB run: ${query}`, params);
        return { changes: 1, lastInsertRowid: 1 };
      },
      get: (...params) => {
        logger.debug(`Mock DB get: ${query}`, params);
        return null;
      },
      all: (...params) => {
        logger.debug(`Mock DB all: ${query}`, params);
        return [];
      }
    };
  },
  pragma: (statement) => {
    logger.debug(`Mock DB pragma: ${statement}`);
  },
  close: () => {
    logger.info('Mock database closed');
  }
};

module.exports = mockDb;