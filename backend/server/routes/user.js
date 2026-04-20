import { Router } from 'express'
import bcrypt from 'bcryptjs'
import OpenAI from 'openai'
import pool from '../db.js'
import { verifyToken, requirePremium } from '../middleware/auth.js'

const router = Router()

let _openai = null
const openai = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// ── GET /api/user/library ───────────────────────────────────────────────────
router.get('/library', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_library WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    )

    const library = { liked: [], watchlist: [], watched: [], history: [] }
    for (const row of rows) {
      const item = {
        id:     row.tmdb_id,
        type:   row.media_type,
        title:  row.title,
        poster: row.poster_path,
        year:   row.year,
      }
      if (library[row.list_type]) library[row.list_type].push(item)
    }

    res.json({ library })
  } catch (err) {
    console.error('Get library error:', err.message)
    res.status(500).json({ error: 'Failed to fetch library' })
  }
})

// ── POST /api/user/library/sync ─────────────────────────────────────────────
router.post('/library/sync', verifyToken, async (req, res) => {
  const { liked = [], watchlist = [], watched = [], history = [] } = req.body
  const userId = req.user.id
  const client = await pool.connect()
  let count = 0

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM user_library WHERE user_id = $1', [userId])

    const lists = { liked, watchlist, watched, history }
    for (const [listType, items] of Object.entries(lists)) {
      for (const item of items) {
        await client.query(
          `INSERT INTO user_library (user_id, tmdb_id, media_type, title, poster_path, year, list_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
          [userId, String(item.id), item.type || 'movie', item.title || '', item.poster || null, item.year || null, listType]
        )
        count++
      }
    }

    await client.query('COMMIT')
    res.json({ ok: true, count })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Sync library error:', err.message)
    res.status(500).json({ error: 'Failed to sync library' })
  } finally {
    client.release()
  }
})

// ── GET /api/user/preferences ───────────────────────────────────────────────
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    )
    if (!rows[0]) {
      return res.json({ preferences: { likedMoods: {}, dislikedItems: [], sessionMoods: [] } })
    }

    const row = rows[0]
    res.json({
      preferences: {
        likedMoods:    JSON.parse(row.liked_moods   || '{}'),
        dislikedItems: JSON.parse(row.disliked_items || '[]'),
        sessionMoods:  JSON.parse(row.session_moods  || '[]'),
      }
    })
  } catch (err) {
    console.error('Get preferences error:', err.message)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// ── POST /api/user/preferences/sync ────────────────────────────────────────
router.post('/preferences/sync', verifyToken, async (req, res) => {
  try {
    const { likedMoods = {}, dislikedItems = [], sessionMoods = [] } = req.body
    const userId = req.user.id

    await pool.query(
      `INSERT INTO user_preferences (user_id, liked_moods, disliked_items, session_moods, updated_at)
       VALUES ($1, $2, $3, $4, EXTRACT(EPOCH FROM NOW())::BIGINT)
       ON CONFLICT (user_id) DO UPDATE SET
         liked_moods    = EXCLUDED.liked_moods,
         disliked_items = EXCLUDED.disliked_items,
         session_moods  = EXCLUDED.session_moods,
         updated_at     = EXCLUDED.updated_at`,
      [userId, JSON.stringify(likedMoods), JSON.stringify(dislikedItems), JSON.stringify(sessionMoods)]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Sync preferences error:', err.message)
    res.status(500).json({ error: 'Failed to sync preferences' })
  }
})

// ── PUT /api/user/profile ──────────────────────────────────────────────────
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const {
      username,
      avatar,
      bio,
      is_discoverable,
      privacy_liked,
      privacy_watchlist,
      privacy_watched,
    } = req.body
    const userId = req.user.id

    const { rows: cur } = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    if (!cur[0]) return res.status(404).json({ error: 'User not found' })
    const current = cur[0]

    await pool.query(
      `UPDATE users SET
        username          = $1,
        avatar            = $2,
        bio               = $3,
        is_discoverable   = $4,
        privacy_liked     = $5,
        privacy_watchlist = $6,
        privacy_watched   = $7
       WHERE id = $8`,
      [
        (username || current.username).trim(),
        avatar    ?? current.avatar    ?? '🎬',
        bio       ?? current.bio       ?? '',
        is_discoverable !== undefined ? (is_discoverable ? 1 : 0) : current.is_discoverable,
        privacy_liked     || current.privacy_liked     || 'public',
        privacy_watchlist || current.privacy_watchlist || 'public',
        privacy_watched   || current.privacy_watched   || 'public',
        userId,
      ]
    )

    const { rows: updated } = await pool.query(
      'SELECT id, email, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched FROM users WHERE id = $1',
      [userId]
    )
    res.json({ ok: true, user: updated[0] })
  } catch (err) {
    console.error('Update profile error:', err.message)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ── PUT /api/user/passcode ─────────────────────────────────────────────────
router.put('/passcode', verifyToken, async (req, res) => {
  try {
    const { currentPasscode, newPasscode } = req.body
    const userId = req.user.id

    if (!currentPasscode || !newPasscode) {
      return res.status(400).json({ error: 'Both current and new passcode are required' })
    }
    if (!/^\d{4}$/.test(String(newPasscode))) {
      return res.status(400).json({ error: 'Passcode must be exactly 4 digits' })
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(String(currentPasscode), rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Current passcode is incorrect' })

    const hash = await bcrypt.hash(String(newPasscode), 12)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId])

    res.json({ ok: true })
  } catch (err) {
    console.error('Update passcode error:', err.message)
    res.status(500).json({ error: 'Failed to update passcode' })
  }
})

// ── GET /api/user/site-settings ────────────────────────────────────────────
router.get('/site-settings', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_site_settings WHERE user_id = $1',
      [req.user.id]
    )
    if (!rows[0]) {
      return res.json({
        settings: { favActors: [], excludedTags: [], nicheBalance: 50, trailerAutoplay: 'click' }
      })
    }
    const row = rows[0]
    res.json({
      settings: {
        favActors:       JSON.parse(row.fav_actors    || '[]'),
        excludedTags:    JSON.parse(row.excluded_tags  || '[]'),
        nicheBalance:    row.niche_balance,
        trailerAutoplay: row.trailer_autoplay,
      }
    })
  } catch (err) {
    console.error('Get site settings error:', err.message)
    res.status(500).json({ error: 'Failed to fetch site settings' })
  }
})

// ── PUT /api/user/site-settings ────────────────────────────────────────────
router.put('/site-settings', verifyToken, async (req, res) => {
  try {
    const {
      favActors      = [],
      excludedTags   = [],
      nicheBalance   = 50,
      trailerAutoplay = 'click',
    } = req.body

    await pool.query(
      `INSERT INTO user_site_settings (user_id, fav_actors, excluded_tags, niche_balance, trailer_autoplay, updated_at)
       VALUES ($1, $2, $3, $4, $5, EXTRACT(EPOCH FROM NOW())::BIGINT)
       ON CONFLICT (user_id) DO UPDATE SET
         fav_actors       = EXCLUDED.fav_actors,
         excluded_tags    = EXCLUDED.excluded_tags,
         niche_balance    = EXCLUDED.niche_balance,
         trailer_autoplay = EXCLUDED.trailer_autoplay,
         updated_at       = EXCLUDED.updated_at`,
      [req.user.id, JSON.stringify(favActors), JSON.stringify(excludedTags), nicheBalance, trailerAutoplay]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Save site settings error:', err.message)
    res.status(500).json({ error: 'Failed to save site settings' })
  }
})

// ── GET /api/user/public/:userId ───────────────────────────────────────────
router.get('/public/:userId', verifyToken, async (req, res) => {
  try {
    const targetId = Number(req.params.userId)
    const viewer   = req.user.id

    const { rows: userRows } = await pool.query(
      'SELECT id, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched, created_at, watcher_title, watcher_level FROM users WHERE id = $1',
      [targetId]
    )
    const user = userRows[0]

    if (!user || !user.is_discoverable) {
      return res.status(404).json({ error: 'User not found or not discoverable' })
    }

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::INTEGER as c FROM social_connections WHERE follower_id = $1',
      [targetId]
    )
    const mateCount = countRows[0].c

    const getList = async (listType, privacyField) => {
      if (viewer === targetId || user[privacyField] === 'public') {
        const { rows } = await pool.query(
          'SELECT tmdb_id as id, media_type as type, title, poster_path as poster, year FROM user_library WHERE user_id = $1 AND list_type = $2 ORDER BY added_at DESC LIMIT 20',
          [targetId, listType]
        )
        return rows
      }
      return null
    }

    const { rows: playlistRows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.tags, p.created_at, p.is_shared,
              COUNT(pi.id)::INTEGER as item_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.user_id = $1 AND p.is_shared = 1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [targetId]
    )

    const { rows: mateRows } = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.plan, u.watcher_title
       FROM social_connections sc
       JOIN users u ON u.id = sc.following_id
       WHERE sc.follower_id = $1
         AND COALESCE(u.is_discoverable, 1) != 0
       ORDER BY LOWER(u.username) ASC
       LIMIT 30`,
      [targetId]
    )

    res.json({
      user: {
        id:            user.id,
        username:      user.username,
        plan:          user.plan,
        avatar:        user.avatar || '🎬',
        bio:           user.bio || '',
        memberSince:   user.created_at,
        watcher_title: user.watcher_title || null,
        watcher_level: user.watcher_level || 0,
      },
      mateCount,
      liked:     await getList('liked',     'privacy_liked'),
      watchlist: await getList('watchlist', 'privacy_watchlist'),
      watched:   await getList('watched',   'privacy_watched'),
      posts:     playlistRows.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })),
      mates:     mateRows.map(m => ({
        id:            m.id,
        username:      m.username,
        avatar:        m.avatar || '🎬',
        plan:          m.plan,
        watcher_title: m.watcher_title || null,
      })),
    })
  } catch (err) {
    console.error('Get public profile error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// ── POST /api/user/update-watcher-level ────────────────────────────────────
router.post('/update-watcher-level', verifyToken, async (req, res) => {
  try {
    const { interactionCount = 0 } = req.body
    const userId = req.user.id

    const levels = [
      { min: 500, title: "Oracle's Favorite",      level: 6 },
      { min: 200, title: 'Grand Auteur',            level: 5 },
      { min: 100, title: "Director's Cut Devotee",  level: 4 },
      { min: 50,  title: 'Reel Philosopher',        level: 3 },
      { min: 25,  title: 'Scene Chaser',            level: 2 },
      { min: 10,  title: 'Curious Cinephile',       level: 1 },
      { min: 0,   title: 'Novice Watcher',          level: 0 },
    ]

    const matched = levels.find(l => interactionCount >= l.min)
    const { title, level } = matched || levels[levels.length - 1]

    const { rows } = await pool.query('SELECT watcher_level FROM users WHERE id = $1', [userId])
    const currentLevel = rows[0]?.watcher_level ?? 0

    if (level > currentLevel) {
      await pool.query(
        'UPDATE users SET watcher_level = $1, watcher_title = $2 WHERE id = $3',
        [level, title, userId]
      )
      await pool.query(
        `INSERT INTO notifications (user_id, type, content) VALUES ($1, 'watcher_level', $2)`,
        [userId, `🎬 You've earned a new Watcher Title: ${title}!`]
      )
    }

    res.json({ ok: true, title, level })
  } catch (err) {
    console.error('Update watcher level error:', err.message)
    res.status(500).json({ error: 'Failed to update watcher level' })
  }
})

// ── GET /api/user/watch-history ────────────────────────────────────────────
router.get('/watch-history', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tmdb_id as id, media_type as type, title, poster_path as poster,
              season, episode, watched_at as "watchedAt"
       FROM watch_history WHERE user_id = $1 ORDER BY watched_at DESC LIMIT 20`,
      [req.user.id]
    )
    res.json({ history: rows.map(r => ({ ...r, watchedAt: Number(r.watchedAt) * 1000 })) })
  } catch (err) {
    console.error('Get watch history error:', err.message)
    res.status(500).json({ error: 'Failed to fetch watch history' })
  }
})

// ── POST /api/user/watch-history ───────────────────────────────────────────
router.post('/watch-history', verifyToken, async (req, res) => {
  try {
    const { item } = req.body
    if (!item?.id || !item?.type) return res.status(400).json({ error: 'Missing item' })
    const userId = req.user.id

    await pool.query(
      `INSERT INTO watch_history (user_id, tmdb_id, media_type, title, poster_path, season, episode, watched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, EXTRACT(EPOCH FROM NOW())::BIGINT)
       ON CONFLICT (user_id, tmdb_id, media_type) DO UPDATE SET
         title = EXCLUDED.title,
         poster_path = EXCLUDED.poster_path,
         season = EXCLUDED.season,
         episode = EXCLUDED.episode,
         watched_at = EXCLUDED.watched_at`,
      [userId, String(item.id), item.type, item.title || '', item.poster || null, item.season || null, item.episode || null]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Save watch history error:', err.message)
    res.status(500).json({ error: 'Failed to save watch history' })
  }
})

// ── DELETE /api/user/watch-history ─────────────────────────────────────────
router.delete('/watch-history', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM watch_history WHERE user_id = $1', [req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Clear watch history error:', err.message)
    res.status(500).json({ error: 'Failed to clear watch history' })
  }
})

// ── GET /api/user/watcher-title ────────────────────────────────────────────
router.get('/watcher-title', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT watcher_title, watcher_level FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json({
      title: rows[0]?.watcher_title || 'Novice Watcher',
      level: rows[0]?.watcher_level ?? 0,
    })
  } catch (err) {
    console.error('Get watcher title error:', err.message)
    res.status(500).json({ error: 'Failed to fetch watcher title' })
  }
})

// ── POST /api/user/generate-title ──────────────────────────────────────────
router.post('/generate-title', verifyToken, requirePremium, async (req, res) => {
  try {
    const {
      topMoods      = [],
      likedTitles   = [],
      watchedCount  = 0,
      watchlistCount = 0,
      dislikedCount = 0,
      sessionMoods  = [],
      language      = 'en',
    } = req.body

    const hourCounts = {}
    sessionMoods.forEach(s => { hourCounts[s.hour] = (hourCounts[s.hour] || 0) + 1 })
    const dominantHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const timeLabel = dominantHour === undefined ? 'no particular time' :
      Number(dominantHour) < 6  ? 'late at night' :
      Number(dominantHour) < 12 ? 'in the morning' :
      Number(dominantHour) < 18 ? 'in the afternoon' : 'in the evening'

    const isFr = language === 'fr'

    const prompt = `You are a witty pop-culture analyst. Based on a user's entertainment preferences, create a fun, insightful "watcher personality" profile.

User data:
- Top mood categories: ${topMoods.join(', ') || 'unknown'}
- Liked titles: ${likedTitles.slice(0, 8).join(', ') || 'none yet'}
- Titles watched: ${watchedCount}
- Titles on watchlist: ${watchlistCount}
- Titles disliked: ${dislikedCount}
- Favorite viewing time: ${timeLabel}

Create a personality profile. Be funny, specific, and insightful. Reference real traits that can be inferred from the data.
${isFr ? 'Write everything in French.' : 'Write in English.'}

Return ONLY valid JSON (no markdown):
{
  "title": "A specific, funny, flattering title (e.g. 'The Midnight Thriller Philosopher')",
  "subtitle": "A one-liner that nails their vibe (e.g. 'Falls asleep to horror films, cries during ads')",
  "emoji": "One perfect emoji for this personality",
  "traits": ["trait 1", "trait 2", "trait 3", "trait 4"],
  "funFacts": ["funny observation 1", "funny observation 2", "funny observation 3"],
  "cinemaType": "The kind of filmgoer they'd be in real life (1 sentence)"
}`

    const response = await openai().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a witty pop-culture analyst. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.88,
    })

    const result = JSON.parse(response.choices[0].message.content)
    res.json(result)
  } catch (err) {
    console.error('Generate title error:', err.message)
    res.status(500).json({ error: 'Could not generate title' })
  }
})

export default router
