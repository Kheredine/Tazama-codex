import { Router } from 'express'
import pool from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// ── GET /api/playlists ──────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.tags, p.is_shared, p.created_at,
              COUNT(pi.id)::INTEGER as item_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    )
    res.json({ playlists: rows.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })) })
  } catch (err) {
    console.error('Get playlists error:', err.message)
    res.status(500).json({ error: 'Failed to fetch playlists' })
  }
})

// ── POST /api/playlists ─────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description = '', tags = [] } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' })
    }

    const { rows } = await pool.query(
      'INSERT INTO playlists (user_id, title, description, tags) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, title.trim(), description.trim(), JSON.stringify(tags)]
    )
    const playlist = rows[0]
    res.json({ ok: true, playlist: { ...playlist, tags: JSON.parse(playlist.tags || '[]'), item_count: 0 } })
  } catch (err) {
    console.error('Create playlist error:', err.message)
    res.status(500).json({ error: 'Failed to create playlist' })
  }
})

// ── GET /api/playlists/shared ───────────────────────────────────────────────
router.get('/shared', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.tags, p.is_shared, p.created_at,
              p.user_id,
              u.username, u.avatar, u.plan,
              COUNT(pi.id)::INTEGER as item_count
       FROM playlists p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.is_shared = 1
         AND p.user_id != $1
         AND COALESCE(u.is_discoverable, 1) != 0
       GROUP BY p.id, u.username, u.avatar, u.plan
       ORDER BY p.created_at DESC`,
      [req.user.id]
    )
    res.json({ playlists: rows.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]') })) })
  } catch (err) {
    console.error('Shared playlists error:', err.message)
    res.status(500).json({ error: 'Failed to fetch shared playlists' })
  }
})

// ── GET /api/playlists/:id ──────────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { rows: plRows } = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    )
    if (!plRows[0]) return res.status(404).json({ error: 'Playlist not found' })

    const { rows: items } = await pool.query(
      'SELECT * FROM playlist_items WHERE playlist_id = $1 ORDER BY position ASC, added_at ASC',
      [plRows[0].id]
    )

    const playlist = plRows[0]
    res.json({ playlist: { ...playlist, tags: JSON.parse(playlist.tags || '[]'), items } })
  } catch (err) {
    console.error('Get playlist error:', err.message)
    res.status(500).json({ error: 'Failed to fetch playlist' })
  }
})

// ── PUT /api/playlists/:id ──────────────────────────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { rows: plRows } = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    )
    if (!plRows[0]) return res.status(404).json({ error: 'Playlist not found' })
    const playlist = plRows[0]

    const { title, description, tags, is_shared } = req.body

    await pool.query(
      `UPDATE playlists SET
        title       = $1,
        description = $2,
        tags        = $3,
        is_shared   = $4
       WHERE id = $5`,
      [
        title       !== undefined ? title.trim()         : playlist.title,
        description !== undefined ? description.trim()   : playlist.description,
        tags        !== undefined ? JSON.stringify(tags)  : playlist.tags,
        is_shared   !== undefined ? (is_shared ? 1 : 0)  : playlist.is_shared,
        playlist.id,
      ]
    )

    const { rows: updated } = await pool.query('SELECT * FROM playlists WHERE id = $1', [playlist.id])
    res.json({ ok: true, playlist: { ...updated[0], tags: JSON.parse(updated[0].tags || '[]') } })
  } catch (err) {
    console.error('Update playlist error:', err.message)
    res.status(500).json({ error: 'Failed to update playlist' })
  }
})

// ── DELETE /api/playlists/:id ───────────────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

    await pool.query('DELETE FROM playlists WHERE id = $1', [rows[0].id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Delete playlist error:', err.message)
    res.status(500).json({ error: 'Failed to delete playlist' })
  }
})

// ── POST /api/playlists/:id/items ───────────────────────────────────────────
router.post('/:id/items', verifyToken, async (req, res) => {
  try {
    const { rows: plRows } = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    )
    if (!plRows[0]) return res.status(404).json({ error: 'Playlist not found' })

    const { tmdb_id, media_type, title, poster_path, year } = req.body
    if (!tmdb_id || !media_type) {
      return res.status(400).json({ error: 'tmdb_id and media_type are required' })
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM playlist_items WHERE playlist_id = $1 AND tmdb_id = $2 AND media_type = $3',
      [plRows[0].id, String(tmdb_id), media_type]
    )
    if (existing[0]) {
      return res.status(409).json({
        error: 'This title is already in the selected playlist',
        hint: 'Choose a different playlist or remove the existing copy first.',
      })
    }

    const { rows: posRows } = await pool.query(
      'SELECT MAX(position) as m FROM playlist_items WHERE playlist_id = $1',
      [plRows[0].id]
    )
    const position = (posRows[0]?.m ?? -1) + 1

    const { rows: inserted } = await pool.query(
      `INSERT INTO playlist_items (playlist_id, tmdb_id, media_type, title, poster_path, year, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [plRows[0].id, String(tmdb_id), media_type, title || null, poster_path || null, year || null, position]
    )

    res.json({ ok: true, itemId: inserted[0].id })
  } catch (err) {
    console.error('Add playlist item error:', err.message)
    res.status(500).json({ error: 'Failed to add item' })
  }
})

// ── DELETE /api/playlists/:id/items/:tmdbId/:mediaType ─────────────────────
router.delete('/:id/items/:tmdbId/:mediaType', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [Number(req.params.id), req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

    await pool.query(
      'DELETE FROM playlist_items WHERE playlist_id = $1 AND tmdb_id = $2 AND media_type = $3',
      [rows[0].id, req.params.tmdbId, req.params.mediaType]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Remove playlist item error:', err.message)
    res.status(500).json({ error: 'Failed to remove item' })
  }
})

export default router
