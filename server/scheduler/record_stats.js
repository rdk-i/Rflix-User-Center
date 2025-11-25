const jellyfinService = require('../services/jellyfinService');
const db = require('../config/database');
const logger = require('../utils/logger');

async function recordStats() {
  try {
    logger.info('Recording stats history...');

    // Get Active Streams (Now Playing)
    let activeStreams = 0;
    try {
      const sessionsResponse = await jellyfinService.client.get('/Sessions');
      if (sessionsResponse.data) {
        activeStreams = sessionsResponse.data.filter(s => s.NowPlayingItem).length;
      }
    } catch (error) {
      logger.warn('Failed to fetch active sessions for stats:', error.message);
    }

    // Get Total Users
    let totalUsers = 0;
    try {
      const usersResponse = await jellyfinService.getAllUsers();
      if (usersResponse.success) {
        totalUsers = usersResponse.data.length;
      }
    } catch (error) {
       // Fallback to local DB
       totalUsers = db.prepare("SELECT COUNT(*) as count FROM api_users WHERE role != 'admin'").get().count;
    }

    // Insert into DB
    db.prepare(`
      INSERT INTO stats_history (active_streams, total_users)
      VALUES (?, ?)
    `).run(activeStreams, totalUsers);

    logger.info(`Stats recorded: ${activeStreams} active streams, ${totalUsers} users`);

  } catch (error) {
    logger.error('Error recording stats:', error);
  }
}

// Run immediately on start
recordStats();

// Run every 10 minutes
setInterval(recordStats, 10 * 60 * 1000);

module.exports = recordStats;
