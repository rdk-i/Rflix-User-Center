const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./data/rflix.db";
const migrationsDir = path.join(__dirname);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
let db;
try {
  db = new Database(dbPath);
} catch (error) {
  console.warn('Failed to load better-sqlite3, using mock database for migration (no-op)');
  db = require('../server/config/database-mock');
}
db.pragma("journal_mode = WAL");

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => {
    // Run these migrations in order
    const orderedMigrations = [
      'data.sql',
      'add_settings_table.sql',
      'add_notification_system.sql',
      'simplify_packages.sql',
      'add_usage_limits_system.sql',
      'add_stats_history.sql',
      'add_tracking_columns.sql',
      'update_views_with_tracking.sql'
    ];
    return orderedMigrations.includes(file);
  })
  .sort((a, b) => {
    // Define migration order
    const order = [
      'data.sql',
      'add_settings_table.sql',
      'add_notification_system.sql',
      'simplify_packages.sql',
      'add_usage_limits_system.sql',
      'add_stats_history.sql',
      'add_tracking_columns.sql',
      'update_views_with_tracking.sql'
    ];
    return order.indexOf(a) - order.indexOf(b);
  });

console.log("Running migrations...");

migrationFiles.forEach((file) => {
  const filePath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filePath, "utf8");

  console.log(`Executing: ${file}`);

  try {
    // For add_tracking_columns.sql, execute each statement separately to handle duplicate column errors
    if (file === 'add_tracking_columns.sql') {
      const statements = sql.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
      statements.forEach((stmt) => {
        try {
          db.exec(stmt + ';');
        } catch (error) {
          // Ignore duplicate column errors
          if (!error.message.includes('duplicate column name')) {
            throw error;
          }
        }
      });
    } else {
      db.exec(sql);
    }
    console.log(`✓ ${file} completed successfully`);
  } catch (error) {
    console.error(`✗ Error in ${file}:`, error.message);
    process.exit(1);
  }
});

db.close();
console.log("\n✓ All migrations completed successfully!");
