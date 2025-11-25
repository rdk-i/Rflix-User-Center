const db = require('../config/database');
const logger = require('../utils/logger');

class StatsController {
  /**
   * Get Now Playing History
   */
  async getNowPlayingHistory(req, res, next) {
    try {
      const { range } = req.query; // 1h, 24h, 7d, etc.
      
      let timeFilter = '-24 hours';
      const now = new Date();
      let startTime = new Date(now);

      // Determine query parameters based on range
      switch(range) {
        case '1h': 
          timeFilter = '-1 hour'; 
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '2h': 
          timeFilter = '-2 hours'; 
          startTime.setHours(startTime.getHours() - 2);
          break;
        case '3h': 
          timeFilter = '-3 hours'; 
          startTime.setHours(startTime.getHours() - 3);
          break;
        case '6h': 
          timeFilter = '-6 hours'; 
          startTime.setHours(startTime.getHours() - 6);
          break;
        case '12h': 
          timeFilter = '-12 hours'; 
          startTime.setHours(startTime.getHours() - 12);
          break;
        case '24h': 
          timeFilter = '-24 hours'; 
          startTime.setHours(startTime.getHours() - 24);
          break;
        case '2d': 
          timeFilter = '-2 days'; 
          startTime.setDate(startTime.getDate() - 2);
          break;
        case '3d': 
          timeFilter = '-3 days'; 
          startTime.setDate(startTime.getDate() - 3);
          break;
        case '7d': 
          timeFilter = '-7 days'; 
          startTime.setDate(startTime.getDate() - 7);
          break;
        default:
          // Default to 24h
          timeFilter = '-24 hours';
          startTime.setHours(startTime.getHours() - 24);
      }

      // Fetch data from DB
      const query = `
        SELECT timestamp, active_streams 
        FROM stats_history 
        WHERE timestamp >= datetime('now', ?) 
        ORDER BY timestamp ASC
      `;
      
      let data = db.prepare(query).all(timeFilter);

      // Prepend Start Point if needed (to ensure chart spans full range)
      // If no data, or first point is too far from start
      if (data.length === 0) {
        data.push({
          timestamp: startTime.toISOString(),
          active_streams: 0
        });
      } else {
        const firstPointTime = new Date(data[0].timestamp + 'Z');
        // If first point is more than 10% of range away from start, add start point
        if (firstPointTime > startTime) {
           data.unshift({
             timestamp: startTime.toISOString(),
             active_streams: 0 // Assume 0 before we had data
           });
        }
      }

      // Fetch current live stats to ensure the chart ends with the real-time value
      try {
        const jellyfinService = require('../services/jellyfinService');
        const sessionsResponse = await jellyfinService.client.get('/Sessions');
        if (sessionsResponse.data) {
          const currentActive = sessionsResponse.data.filter(s => s.NowPlayingItem).length;
          
          logger.info(`[Stats] Current active streams: ${currentActive}`);
          
          // Add current point
          data.push({
            timestamp: new Date().toISOString(),
            active_streams: currentActive
          });
        }
      } catch (err) {
        logger.warn('Failed to fetch live stats for history padding:', err.message);
      }

      logger.info(`[Stats] Returning ${data.length} data points for range ${range}`);
      logger.debug('[Stats] Data points:', JSON.stringify(data));

      res.json({
        success: true,
        data: data
      });

    } catch (error) {
      logger.error('Get stats history error:', error);
      next(error);
    }
  }
}

module.exports = new StatsController();
