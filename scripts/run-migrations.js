const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Set connection charset for UTF-8 (Russian, Armenian, etc.)
    await db.execute("SET NAMES 'utf8mb4'");
    await db.execute("SET CHARACTER SET utf8mb4");
    
    // Read all migration files from the migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Split by semicolon to handle multiple statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await db.execute(statement);
          } catch (stmtErr) {
            // Some statements might fail if they already exist (like CREATE TABLE IF NOT EXISTS)
            const ignoreErrors = ['already exists', 'Duplicate entry', 'Duplicate column', 'Duplicate key', 'Duplicate column name'];
            if (!ignoreErrors.some(e => stmtErr.message.includes(e))) {
              console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
              console.error(stmtErr);
            }
          }
        }
      }
      
      console.log(`Completed migration: ${file}`);
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;