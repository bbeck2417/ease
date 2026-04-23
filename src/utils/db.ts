import * as SQLite from "expo-sqlite";

export const initDB = async () => {
  const db = await SQLite.openDatabaseAsync("ease.db");

  // Create Contacts Table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL
    );
  `);

  // CRITICAL: Create Mantras Table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS mantras (
      id INTEGER PRIMARY KEY NOT NULL,
      text TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY NOT NULL,
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
  return db;
};
