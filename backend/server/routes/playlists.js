import { Router } from 'express'
import db from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// ── GET /api/playlists ──────────────────────────────────────────────────────
// Get user's playlists with item count
router.get('/', verifyToken, (req, res) => {
  try {
    const playlists = db.prepare(`
      SELECT p.id, p.title, p.description, p.tags, p.is_shared, p.created_at,
             COUNT(pi.id) as item_count
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(req.user.id)

    res.json({ playlists: playlists.map(p => ({
      ...p,
      tags: JSON.parse(p.tags || '[]'),
    })) })
  } catch (err) {
    console.error('Get playlists error:', err.message)
    res.status(500).json({ error: 'Failed to fetch playlists' })
  }
})

// ── POST /api/playlists ─────────────────────────────────────────────────────
// Create playlist
router.post('/', verifyToken, (req, res) => {
  try {
    const { title, description = '', tags = [] } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const result = db.prepare(`
      INSERT INTO playlists (user_id, title, description, tags)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, title.trim(), description.trim(), JSON.stringify(tags))

    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(result.lastInsertRowid)
    res.json({ ok: true, playlist: { ...playlist, tags: JSON.parse(playlist.tags || '[]'), item_count: 0 } })
  } catch (err) {
    console.error('Create playlist error:', err.message)
    res.status(500).json({ error: 'Failed to create playlist' })
  }
})

// ── GET /api/playlists/shared ───────────────────────────────────────────────
// Get shared playlists from Reel Mates (must come before /:id to avoid conflict)
router.get('/shared', verifyToken, (req, res) => {
  try {
    const playlists = db.prepare(`
      SELECT p.id, p.title, p.description, p.tags, p.is_shared, p.created_at,
             p.user_id,
             u.username, u.avatar, u.plan,
             COUNT(pi.id) as item_count
      FROM playlists p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.is_shared = 1
        AND p.user_id != ?
        AND COALESCE(u.is_discoverable, 1) != 0
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(req.user.id)

    res.json({ playlists: playlists.map(p => ({
      ...p,
      tags: JSON.parse(p.tags || '[]'),
    })) })
  } catch (err) {
    console.error('Shared playlists error:', err.message)
    res.status(500).json({ error: 'Failed to fetch shared playlists' })
  }
})

// ── GET /api/playlists/:id ──────────────────────────────────────────────────
// Get playlist with all items
router.get('/:id', verifyToken, (req, res) => {
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id)

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    const items = db.prepare(`
      SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC, added_at ASC
    `).all(playlist.id)

    res.json({ playlist: { ...playlist, tags: JSON.parse(playlist.tags || '[]'), items } })
  } catch (err) {
    console.error('Get playlist error:', err.message)
    res.status(500).json({ error: 'Failed to fetch playlist' })
  }
})

// ── PUT /api/playlists/:id ──────────────────────────────────────────────────
// Update playlist
router.put('/:id', verifyToken, (req, res) => {
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id)

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    const { title, description, tags, is_shared } = req.body

    db.prepare(`
      UPDATE playlists SET
        title       = ?,
        description = ?,
        tags        = ?,
        is_shared   = ?
      WHERE id = ?
    `).run(
      title       !== undefined ? title.trim()        : playlist.title,
      description !== undefined ? description.trim()  : playlist.description,
      tags        !== undefined ? JSON.stringify(tags) : playlist.tags,
      is_shared   !== undefined ? (is_shared ? 1 : 0) : playlist.is_shared,
      playlist.id
    )

    const updated = db.prepare('SELECT * FROM playlists WHERE id = ?').get(playlist.id)
    res.json({ ok: true, playlist: { ...updated, tags: JSON.parse(updated.tags || '[]') } })
  } catch (err) {
    console.error('Update playlist error:', err.message)
    res.status(500).json({ error: 'Failed to update playlist' })
  }
})

// ── DELETE /api/playlists/:id ───────────────────────────────────────────────
router.delete('/:id', verifyToken, (req, res) => {
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id)

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    db.prepare('DELETE FROM playlists WHERE id = ?').run(playlist.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('Delete playlist error:', err.message)
    res.status(500).json({ error: 'Failed to delete playlist' })
  }
})

// ── POST /api/playlists/:id/items ───────────────────────────────────────────
// Add item to playlist
router.post('/:id/items', verifyToken, (req, res) => {
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id)

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    const { tmdb_id, media_type, title, poster_path, year } = req.body

    if (!tmdb_id || !media_type) {
      return res.status(400).json({ error: 'tmdb_id and media_type are required' })
    }

    const existing = db.prepare(`
      SELECT id FROM playlist_items
      WHERE playlist_id = ? AND tmdb_id = ? AND media_type = ?
    `).get(playlist.id, String(tmdb_id), media_type)

    if (existing) {
      return res.status(409).json({
        error: 'This title is already in the selected playlist',
        hint: 'Choose a different playlist or remove the existing copy first.',
      })
    }

    // Get current max position
    const maxPos = db.prepare('SELECT MAX(position) as m FROM playlist_items WHERE playlist_id = ?')
      .get(playlist.id)
    const position = (maxPos?.m ?? -1) + 1

    const result = db.prepare(`
      INSERT INTO playlist_items (playlist_id, tmdb_id, media_type, title, poster_path, year, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(playlist.id, String(tmdb_id), media_type, title || null, poster_path || null, year || null, position)

    res.json({ ok: true, itemId: result.lastInsertRowid })
  } catch (err) {
    console.error('Add playlist item error:', err.message)
    res.status(500).json({ error: 'Failed to add item' })
  }
})

// ── DELETE /api/playlists/:id/items/:tmdbId/:mediaType ─────────────────────
// Remove item from playlist
router.delete('/:id/items/:tmdbId/:mediaType', verifyToken, (req, res) => {
  try {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id)

    if (!playlist) return res.status(404).json({ error: 'Playlist not found' })

    db.prepare(`
      DELETE FROM playlist_items
      WHERE playlist_id = ? AND tmdb_id = ? AND media_type = ?
    `).run(playlist.id, req.params.tmdbId, req.params.mediaType)

    res.json({ ok: true })
  } catch (err) {
    console.error('Remove playlist item error:', err.message)
    res.status(500).json({ error: 'Failed to remove item' })
  }
})

export default router
