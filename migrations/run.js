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
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Get all migration files
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file === "data.sql")
  .sort();

console.log("Running migrations...");

migrationFiles.forEach((file) => {
  const filePath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filePath, "utf8");

  console.log(`Executing: ${file}`);

  try {
    db.exec(sql);
    console.log(`✓ ${file} completed successfully`);
  } catch (error) {
    console.error(`✗ Error in ${file}:`, error.message);
    process.exit(1);
  }
});

db.close();
console.log("\n✓ All migrations completed successfully!");
