CREATE TABLE IF NOT EXISTS stats_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    active_streams INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    online_users INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stats_timestamp ON stats_history(timestamp);
