import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function createSqliteStore(databasePath) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, title TEXT NOT NULL,
      fingerprint TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(email, fingerprint)
    );`)
  return {
    sessionGet: (token, now) => db.prepare('SELECT email FROM sessions WHERE token = ? AND expires > ?').get(token, now),
    sessionCreate(token, email, expires) {
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now())
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(token, email, expires)
    },
    sessionDelete: (token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token),
    snapshotSave(email, title, fingerprint, payload, createdAt) {
      const result = db.prepare('INSERT OR IGNORE INTO snapshots (email,title,fingerprint,payload,created_at) VALUES (?,?,?,?,?)').run(email, title, fingerprint, payload, createdAt)
      const row = db.prepare('SELECT id FROM snapshots WHERE email = ? AND fingerprint = ?').get(email, fingerprint)
      return { id: row.id, duplicate: !result.changes }
    },
    snapshotsList: (email) => db.prepare('SELECT * FROM snapshots WHERE email = ? ORDER BY id DESC').all(email),
    snapshotGet: (id, email) => db.prepare('SELECT * FROM snapshots WHERE id = ? AND email = ?').get(id, email),
    snapshotDelete: (id, email) => db.prepare('DELETE FROM snapshots WHERE id = ? AND email = ?').run(id, email),
    close: () => db.close(),
  }
}
