const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const migrationPath = path.join(__dirname, 'add_packages.sql');

console.log('🔄 Running migration: Add Packages Table...');

try {
  // Buka database
  const db = new Database(dbPath);
  
  // Baca file migration
  const migration = fs.readFileSync(migrationPath, 'utf8');
  
  // Split berdasarkan statement (pisah dengan ;)
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  // Jalankan setiap statement
  db.transaction(() => {
    for (const statement of statements) {
      try {
        db.prepare(statement).run();
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (err) {
        // Abaikan error "duplicate column" atau "table already exists"
        if (err.message.includes('duplicate') || err.message.includes('already exists')) {
          console.log('⚠️  Skipped (already exists):', statement.substring(0, 50) + '...');
        } else {
          throw err;
        }
      }
    }
  })();
  
  db.close();
  
  console.log('✅ Migration completed successfully!');
  console.log('📦 Packages table created with 4 default packages');
  console.log('🔗 user_expiration table updated with packageId column');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
