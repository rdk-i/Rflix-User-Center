// Mock database for testing when better-sqlite3 has compilation issues
const logger = require('../utils/logger');

logger.warn('USING MOCK DATABASE - RESCUE MODE ACTIVE');

const mockAdmin = {
  id: 1,
  email: 'admin@rflix.local',
  // Password: admin123
  password_hash: '$2b$12$xNAZWs0z4ZqzCXBRZ5xDFujBU.mMm8FCahblLq.NOOCliCNjdzhKi',
  role: 'admin',
  jellyfinUserId: 'mock-admin-jellyfin-id',
  created_at: new Date().toISOString()
};

const mockDb = {
  prepare: (query) => {
    return {
      run: (...params) => {
        logger.debug(`Mock DB run: ${query}`, params);
        return { changes: 1, lastInsertRowid: 1 };
      },
      exec: (sql) => {
         logger.debug(`Mock DB exec: ${sql.substring(0, 50)}...`);
         return;
      },
      get: (...params) => {
        logger.debug(`Mock DB get: ${query}`, params);
        
        // Mock Admin Login
        if (query.includes('FROM api_users WHERE email = ?') && params[0] === 'admin@rflix.local') {
            logger.info('Mock DB: Returning mock admin user for login');
            return mockAdmin;
        }
        
        // Mock Admin Refresh Token / ID lookup
        if (query.includes('FROM api_users WHERE id = ?') && (params[0] === 1 || params[0] === '1')) {
             return mockAdmin;
        }

        return null;
      },
      all: (...params) => {
        logger.debug(`Mock DB all: ${query}`, params);
        return [];
      }
    };
  },
  exec: (sql) => {
     logger.debug(`Mock DB top-level exec: ${sql.substring(0, 50)}...`);
     return;
  },
  pragma: (statement) => {
    logger.debug(`Mock DB pragma: ${statement}`);
  },
  close: () => {
    logger.info('Mock database closed');
  }
};

module.exports = mockDb;