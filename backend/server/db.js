import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(join(dataDir, 'tazama.db'))

// Performance settings
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Users ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    UNIQUE NOT NULL,
    username     TEXT    NOT NULL,
    password_hash TEXT   NOT NULL,
    plan         TEXT    NOT NULL DEFAULT 'standard',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

// ── User Library ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_library (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    tmdb_id     TEXT    NOT NULL,
    media_type  TEXT    NOT NULL,
    title       TEXT,
    poster_path TEXT,
    year        TEXT,
    list_type   TEXT    NOT NULL,
    added_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, tmdb_id, media_type, list_type)
  )
`)

// ── User Preferences ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id       INTEGER PRIMARY KEY,
    liked_moods   TEXT NOT NULL DEFAULT '{}',
    disliked_items TEXT NOT NULL DEFAULT '[]',
    session_moods TEXT NOT NULL DEFAULT '[]',
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ── Oracle Chat Messages ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS oracle_chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ── User profile extras (ALTER TABLE — safe to re-run) ─────────────────────
const profileCols = [
  "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '🎬'",
  "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN is_discoverable INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE users ADD COLUMN privacy_liked TEXT NOT NULL DEFAULT 'public'",
  "ALTER TABLE users ADD COLUMN privacy_watchlist TEXT NOT NULL DEFAULT 'public'",
  "ALTER TABLE users ADD COLUMN privacy_watched TEXT NOT NULL DEFAULT 'public'",
]
for (const sql of profileCols) {
  try { db.exec(sql) } catch { /* column already exists — safe to ignore */ }
}

// ── Social Connections ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS social_connections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id  INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
  )
`)

// ── Notifications ───────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    from_user_id  INTEGER,
    type          TEXT    NOT NULL,
    content       TEXT    NOT NULL,
    entity_id     TEXT,
    entity_type   TEXT,
    entity_title  TEXT,
    is_read       INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`)

// ── Site Settings per user ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS user_site_settings (
    user_id          INTEGER PRIMARY KEY,
    fav_actors       TEXT    NOT NULL DEFAULT '[]',
    excluded_tags    TEXT    NOT NULL DEFAULT '[]',
    niche_balance    INTEGER NOT NULL DEFAULT 50,
    trailer_autoplay TEXT    NOT NULL DEFAULT 'click',
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ── Feedback ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    user_id    INTEGER,
    category   TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

// ── Task 4: Connection Requests ─────────────────────────────────────────────
// Add status column to social_connections (safe — catches if already exists)
try { db.exec(`ALTER TABLE social_connections ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted'`) } catch { /* already exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS connection_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id   INTEGER NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id)   REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(from_user_id, to_user_id)
  )
`)

// ── Task 5: Direct Messages ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id   INTEGER NOT NULL,
    content      TEXT    NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id)   REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ── Task 8: Watcher Titles ──────────────────────────────────────────────────
try { db.exec(`ALTER TABLE users ADD COLUMN watcher_level INTEGER NOT NULL DEFAULT 0`) } catch { /* already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN watcher_title TEXT DEFAULT NULL`) } catch { /* already exists */ }

// ── Task 9: Playlists ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    tags        TEXT    NOT NULL DEFAULT '[]',
    is_shared   INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS playlist_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    tmdb_id     TEXT    NOT NULL,
    media_type  TEXT    NOT NULL,
    title       TEXT,
    poster_path TEXT,
    year        TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    added_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, tmdb_id, media_type)
  )
`)

console.log('✅ Database initialized at', join(dataDir, 'tazama.db'))

export default db
