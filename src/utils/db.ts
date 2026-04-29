import * as SQLite from "expo-sqlite";

// 1. Create variables to hold our active database and the loading state
let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const initDB = async () => {
  // 2. If the database is already ready, just return it instantly
  if (dbInstance) return dbInstance;

  // 3. If another screen is currently setting it up, wait for that promise to finish
  if (initPromise) return initPromise;

  // 4. Otherwise, start the setup process and lock it so no one else can start it
  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("ease.db");

    // Create Contacts Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL
      ); 
    `);

    // Create Mantras Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS mantras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL
      );
    `);

    // Create Moods Table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS moods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emoji TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await db.execAsync(
        `ALTER TABLE moods ADD COLUMN label TEXT NOT NULL DEFAULT 'Okay';`,
      );
    } catch (e) {
      // If the column already exists, this will fail silently, which is fine
    }

    // 5. Save the ready instance so future calls are instant
    dbInstance = db;
    return db;
  })();

  return initPromise;
};
