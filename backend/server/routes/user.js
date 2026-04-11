import { Router } from 'express'
import bcrypt from 'bcryptjs'
import OpenAI from 'openai'
import db from '../db.js'
import { verifyToken, requirePremium } from '../middleware/auth.js'

const router = Router()

// Lazy OpenAI init
let _openai = null
const openai = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// ── GET /api/user/library ───────────────────────────────────────────────────
router.get('/library', verifyToken, (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM user_library WHERE user_id = ? ORDER BY added_at DESC'
    ).all(req.user.id)

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
router.post('/library/sync', verifyToken, (req, res) => {
  try {
    const { liked = [], watchlist = [], watched = [], history = [] } = req.body
    const userId = req.user.id

    const syncTransaction = db.transaction(() => {
      db.prepare('DELETE FROM user_library WHERE user_id = ?').run(userId)

      const insert = db.prepare(`
        INSERT OR IGNORE INTO user_library (user_id, tmdb_id, media_type, title, poster_path, year, list_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      let count = 0
      const lists = { liked, watchlist, watched, history }
      for (const [listType, items] of Object.entries(lists)) {
        for (const item of items) {
          insert.run(
            userId,
            String(item.id),
            item.type || 'movie',
            item.title || '',
            item.poster || null,
            item.year || null,
            listType
          )
          count++
        }
      }
      return count
    })

    const count = syncTransaction()
    res.json({ ok: true, count })
  } catch (err) {
    console.error('Sync library error:', err.message)
    res.status(500).json({ error: 'Failed to sync library' })
  }
})

// ── GET /api/user/preferences ───────────────────────────────────────────────
router.get('/preferences', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id)
    if (!row) {
      return res.json({ preferences: { likedMoods: {}, dislikedItems: [], sessionMoods: [] } })
    }

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
router.post('/preferences/sync', verifyToken, (req, res) => {
  try {
    const { likedMoods = {}, dislikedItems = [], sessionMoods = [] } = req.body
    const userId = req.user.id

    db.prepare(`
      INSERT INTO user_preferences (user_id, liked_moods, disliked_items, session_moods, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET
        liked_moods    = excluded.liked_moods,
        disliked_items = excluded.disliked_items,
        session_moods  = excluded.session_moods,
        updated_at     = excluded.updated_at
    `).run(
      userId,
      JSON.stringify(likedMoods),
      JSON.stringify(dislikedItems),
      JSON.stringify(sessionMoods)
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Sync preferences error:', err.message)
    res.status(500).json({ error: 'Failed to sync preferences' })
  }
})

// ── PUT /api/user/profile ──────────────────────────────────────────────────
// Update username, email, avatar, bio, privacy settings
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const {
      username,
      email,
      avatar,
      bio,
      is_discoverable,
      privacy_liked,
      privacy_watchlist,
      privacy_watched,
    } = req.body
    const userId = req.user.id

    // Validate new email if changing
    if (email && email !== req.user.email) {
      if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email address' })
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), userId)
      if (existing) return res.status(409).json({ error: 'Email already in use' })
    }

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!current) return res.status(404).json({ error: 'User not found' })

    db.prepare(`
      UPDATE users SET
        username          = ?,
        email             = ?,
        avatar            = ?,
        bio               = ?,
        is_discoverable   = ?,
        privacy_liked     = ?,
        privacy_watchlist = ?,
        privacy_watched   = ?
      WHERE id = ?
    `).run(
      (username || current.username).trim(),
      (email || current.email).toLowerCase(),
      avatar    ?? current.avatar    ?? '🎬',
      bio       ?? current.bio       ?? '',
      is_discoverable !== undefined ? (is_discoverable ? 1 : 0) : current.is_discoverable,
      privacy_liked     || current.privacy_liked     || 'public',
      privacy_watchlist || current.privacy_watchlist || 'public',
      privacy_watched   || current.privacy_watched   || 'public',
      userId
    )

    const updated = db.prepare('SELECT id, email, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched FROM users WHERE id = ?').get(userId)
    res.json({ ok: true, user: updated })
  } catch (err) {
    console.error('Update profile error:', err.message)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ── PUT /api/user/password ─────────────────────────────────────────────────
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user.id

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

    const hash = await bcrypt.hash(newPassword, 12)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)

    res.json({ ok: true })
  } catch (err) {
    console.error('Update password error:', err.message)
    res.status(500).json({ error: 'Failed to update password' })
  }
})

// ── GET /api/user/site-settings ────────────────────────────────────────────
router.get('/site-settings', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM user_site_settings WHERE user_id = ?').get(req.user.id)
    if (!row) {
      return res.json({
        settings: {
          favActors:      [],
          excludedTags:   [],
          nicheBalance:   50,
          trailerAutoplay: 'click',
        }
      })
    }
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
router.put('/site-settings', verifyToken, (req, res) => {
  try {
    const {
      favActors      = [],
      excludedTags   = [],
      nicheBalance   = 50,
      trailerAutoplay = 'click',
    } = req.body

    db.prepare(`
      INSERT INTO user_site_settings (user_id, fav_actors, excluded_tags, niche_balance, trailer_autoplay, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET
        fav_actors       = excluded.fav_actors,
        excluded_tags    = excluded.excluded_tags,
        niche_balance    = excluded.niche_balance,
        trailer_autoplay = excluded.trailer_autoplay,
        updated_at       = excluded.updated_at
    `).run(
      req.user.id,
      JSON.stringify(favActors),
      JSON.stringify(excludedTags),
      nicheBalance,
      trailerAutoplay
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Save site settings error:', err.message)
    res.status(500).json({ error: 'Failed to save site settings' })
  }
})

// ── GET /api/user/public/:userId ───────────────────────────────────────────
// Public profile (used by user search/profile pages)
router.get('/public/:userId', verifyToken, (req, res) => {
  try {
    const targetId = Number(req.params.userId)
    const viewer   = req.user.id

    const user = db.prepare(
      'SELECT id, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched, created_at, watcher_title, watcher_level FROM users WHERE id = ?'
    ).get(targetId)

    if (!user || !user.is_discoverable) {
      return res.status(404).json({ error: 'User not found or not discoverable' })
    }

    // Mate count (accepted connections — bidirectional, count one side)
    const mateCount = db.prepare('SELECT COUNT(*) as c FROM social_connections WHERE follower_id = ?').get(targetId).c

    // Library (respect privacy)
    const getList = (listType, privacyField) => {
      if (viewer === targetId || user[privacyField] === 'public') {
        return db.prepare(
          'SELECT tmdb_id as id, media_type as type, title, poster_path as poster, year FROM user_library WHERE user_id = ? AND list_type = ? ORDER BY added_at DESC LIMIT 20'
        ).all(targetId, listType)
      }
      return null // private
    }

    const posts = db.prepare(`
      SELECT p.id, p.title, p.description, p.tags, p.created_at, p.is_shared,
             COUNT(pi.id) as item_count
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.user_id = ? AND p.is_shared = 1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(targetId).map((playlist) => ({
      ...playlist,
      tags: JSON.parse(playlist.tags || '[]'),
    }))

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
      liked:     getList('liked',     'privacy_liked'),
      watchlist: getList('watchlist', 'privacy_watchlist'),
      watched:   getList('watched',   'privacy_watched'),
      posts,
    })
  } catch (err) {
    console.error('Get public profile error:', err.message)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// ── POST /api/user/update-watcher-level ────────────────────────────────────
// Called by frontend when user reaches interaction milestones
router.post('/update-watcher-level', verifyToken, (req, res) => {
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

    // Get current level
    const current = db.prepare('SELECT watcher_level FROM users WHERE id = ?').get(userId)
    const currentLevel = current?.watcher_level ?? 0

    // Update only if level increased
    if (level > currentLevel) {
      db.prepare('UPDATE users SET watcher_level = ?, watcher_title = ? WHERE id = ?')
        .run(level, title, userId)

      // Send notification
      db.prepare(`
        INSERT INTO notifications (user_id, type, content)
        VALUES (?, 'watcher_level', ?)
      `).run(userId, `🎬 You've earned a new Watcher Title: ${title}!`)
    }

    res.json({ ok: true, title, level })
  } catch (err) {
    console.error('Update watcher level error:', err.message)
    res.status(500).json({ error: 'Failed to update watcher level' })
  }
})

// ── GET /api/user/watcher-title ────────────────────────────────────────────
router.get('/watcher-title', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT watcher_title, watcher_level FROM users WHERE id = ?').get(req.user.id)
    res.json({
      title: row?.watcher_title || 'Novice Watcher',
      level: row?.watcher_level ?? 0,
    })
  } catch (err) {
    console.error('Get watcher title error:', err.message)
    res.status(500).json({ error: 'Failed to fetch watcher title' })
  }
})

// ── POST /api/user/generate-title ──────────────────────────────────────────
// Premium only — generates a funny, insightful watcher personality title
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
