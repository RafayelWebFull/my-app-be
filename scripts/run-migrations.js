const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function checksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function getAppliedMigrations() {
  const [rows] = await db.execute(`SELECT filename, checksum FROM ${MIGRATIONS_TABLE}`);
  const map = new Map();
  rows.forEach((row) => map.set(row.filename, row.checksum));
  return map;
}

async function markMigrationApplied(filename, fileChecksum) {
  await db.execute(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES (?, ?)`,
    [filename, fileChecksum]
  );
}

async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Set connection charset for UTF-8 (Russian, Armenian, etc.)
    await db.execute("SET NAMES 'utf8mb4'");
    await db.execute("SET CHARACTER SET utf8mb4");
    await ensureMigrationsTable();
    
    // Read all migration files from the migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    const applied = await getAppliedMigrations();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const fileChecksum = checksum(sqlContent);

      if (applied.has(file)) {
        const oldChecksum = applied.get(file);
        if (oldChecksum !== fileChecksum) {
          throw new Error(
            `Migration file changed after being applied: ${file}. ` +
            `Create a new migration file instead of editing old ones.`
          );
        }
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);

      // Split by semicolon to handle multiple statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Use text protocol for migrations so DDL and PREPARE statements are supported.
            await db.query(statement);
          } catch (stmtErr) {
            // Allow idempotent bootstrap on existing databases.
            const ignoreErrors = [
              'already exists',
              'Duplicate entry',
              'Duplicate column',
              'Duplicate key',
              'Duplicate column name',
            ];
            if (!ignoreErrors.some((e) => stmtErr.message.includes(e))) {
              console.error(`Error executing statement: ${statement.substring(0, 120)}...`);
              throw stmtErr;
            }
          }
        }
      }

      await markMigrationApplied(file, fileChecksum);
      
      console.log(`Completed migration: ${file}`);
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    try {
      await db.end();
      console.log('Database pool closed');
    } catch (closeErr) {
      console.error('Error closing database pool:', closeErr);
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
