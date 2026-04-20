import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

export const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                SERIAL PRIMARY KEY,
      email             TEXT    UNIQUE NOT NULL,
      username          TEXT    NOT NULL,
      password_hash     TEXT    NOT NULL,
      plan              TEXT    NOT NULL DEFAULT 'standard',
      avatar            TEXT    DEFAULT '🎬',
      bio               TEXT    DEFAULT '',
      is_discoverable   INTEGER NOT NULL DEFAULT 1,
      privacy_liked     TEXT    NOT NULL DEFAULT 'public',
      privacy_watchlist TEXT    NOT NULL DEFAULT 'public',
      privacy_watched   TEXT    NOT NULL DEFAULT 'public',
      watcher_level     INTEGER NOT NULL DEFAULT 0,
      watcher_title     TEXT    DEFAULT NULL,
      created_at        BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username))
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_library (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tmdb_id     TEXT    NOT NULL,
      media_type  TEXT    NOT NULL,
      title       TEXT,
      poster_path TEXT,
      year        TEXT,
      list_type   TEXT    NOT NULL,
      added_at    BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(user_id, tmdb_id, media_type, list_type)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      liked_moods    TEXT NOT NULL DEFAULT '{}',
      disliked_items TEXT NOT NULL DEFAULT '[]',
      session_moods  TEXT NOT NULL DEFAULT '[]',
      updated_at     BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS oracle_chat_messages (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_connections (
      id           SERIAL PRIMARY KEY,
      follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT    NOT NULL DEFAULT 'accepted',
      created_at   BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(follower_id, following_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS connection_requests (
      id           SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       TEXT    NOT NULL DEFAULT 'pending',
      created_at   BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(from_user_id, to_user_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type          TEXT    NOT NULL,
      content       TEXT    NOT NULL,
      entity_id     TEXT,
      entity_type   TEXT,
      entity_title  TEXT,
      is_read       INTEGER NOT NULL DEFAULT 0,
      created_at    BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_site_settings (
      user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      fav_actors       TEXT    NOT NULL DEFAULT '[]',
      excluded_tags    TEXT    NOT NULL DEFAULT '[]',
      niche_balance    INTEGER NOT NULL DEFAULT 50,
      trailer_autoplay TEXT    NOT NULL DEFAULT 'click',
      updated_at       BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id         SERIAL PRIMARY KEY,
      name       TEXT,
      user_id    INTEGER,
      category   TEXT   NOT NULL,
      message    TEXT   NOT NULL,
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      TEXT    NOT NULL,
      is_read      INTEGER NOT NULL DEFAULT 0,
      created_at   BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlists (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      tags        TEXT    NOT NULL DEFAULT '[]',
      is_shared   INTEGER NOT NULL DEFAULT 0,
      created_at  BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      id          SERIAL PRIMARY KEY,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      tmdb_id     TEXT    NOT NULL,
      media_type  TEXT    NOT NULL,
      title       TEXT,
      poster_path TEXT,
      year        TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      added_at    BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(playlist_id, tmdb_id, media_type)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_history (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tmdb_id     TEXT    NOT NULL,
      media_type  TEXT    NOT NULL,
      title       TEXT,
      poster_path TEXT,
      season      INTEGER,
      episode     INTEGER,
      watched_at  BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      UNIQUE(user_id, tmdb_id, media_type)
    )
  `)

  console.log('✅ PostgreSQL database initialized')
}

export default pool
