const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/rflix.db');
const db = new Database(dbPath);

console.log('\n=== PACKAGES TABLE STRUCTURE ===');
const tableInfo = db.prepare("PRAGMA table_info(packages)").all();
console.table(tableInfo);

console.log('\n=== PACKAGES DATA ===');
const packages = db.prepare("SELECT * FROM packages").all();
console.table(packages);

console.log('\n=== USER_EXPIRATION TABLE STRUCTURE ===');
const userExpInfo = db.prepare("PRAGMA table_info(user_expiration)").all();
console.table(userExpInfo);

db.close();
console.log('\n✓ Database verification completed!');
