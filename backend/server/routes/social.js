import { Router } from 'express'
import pool from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

const ACCEPT_MSGS = [
  "🎬 Your Reel Mate request was accepted! The projector is now rolling for two.",
  "🍿 They welcomed you into their screening room! You're officially Reel Mates.",
  "🎭 Plot twist: they said YES! Your cinematic journey together begins now.",
]
const REFUSE_MSGS = [
  "🎬 Your Reel Mate request was declined. The screening room only had one seat, apparently.",
  "🍿 They left your request on 'to-watch' — indefinitely. Ouch.",
  "🎭 Plot twist: rejected. Even the Oracle didn't see that coming.",
]
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// ── GET /api/social/search?q=... ────────────────────────────────────────────
router.get('/search', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (q.length < 2) return res.json({ users: [] })

    const { rows } = await pool.query(
      `SELECT id, username, plan, avatar, bio, is_discoverable, watcher_title, watcher_level
       FROM users
       WHERE LOWER(username) LIKE LOWER($1) AND COALESCE(is_discoverable, 1) != 0 AND id != $2
       LIMIT 10`,
      [`%${q}%`, req.user.id]
    )

    res.json({ users: rows.map(u => ({
      id:            u.id,
      username:      u.username,
      plan:          u.plan,
      avatar:        u.avatar || '🎬',
      bio:           u.bio    || '',
      watcher_title: u.watcher_title || null,
      watcher_level: u.watcher_level || 0,
    })) })
  } catch (err) {
    console.error('Search users error:', err.message)
    res.status(500).json({ error: 'Search failed' })
  }
})

// ── POST /api/social/request/:userId ───────────────────────────────────────
router.post('/request/:userId', verifyToken, async (req, res) => {
  try {
    const fromId = req.user.id
    const toId   = Number(req.params.userId)

    if (fromId === toId) return res.status(400).json({ error: "You can't request yourself" })

    const { rows: targetRows } = await pool.query(
      'SELECT id, username, is_discoverable FROM users WHERE id = $1',
      [toId]
    )
    if (!targetRows[0] || !targetRows[0].is_discoverable) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { rows: connRows } = await pool.query(
      `SELECT id FROM social_connections WHERE
        (follower_id = $1 AND following_id = $2) OR
        (follower_id = $2 AND following_id = $1)`,
      [fromId, toId]
    )
    if (connRows[0]) return res.status(409).json({ error: 'Already connected' })

    const { rows: existingReq } = await pool.query(
      'SELECT id FROM connection_requests WHERE from_user_id = $1 AND to_user_id = $2',
      [fromId, toId]
    )
    if (existingReq[0]) return res.status(409).json({ error: 'Request already sent' })

    const { rows: reqRows } = await pool.query(
      'INSERT INTO connection_requests (from_user_id, to_user_id) VALUES ($1, $2) RETURNING id',
      [fromId, toId]
    )
    const requestId = reqRows[0].id

    const { rows: senderRows } = await pool.query(
      'SELECT username, avatar FROM users WHERE id = $1',
      [fromId]
    )
    const sender = senderRows[0]
    await pool.query(
      `INSERT INTO notifications (user_id, from_user_id, type, content, entity_id)
       VALUES ($1, $2, 'connection_request', $3, $4)`,
      [toId, fromId, `🎬 ${sender.username} wants to be your Reel Mate!`, String(requestId)]
    )

    res.json({ ok: true, requestId })
  } catch (err) {
    console.error('Send request error:', err.message)
    res.status(500).json({ error: 'Failed to send request' })
  }
})

// ── PUT /api/social/request/:requestId/accept ──────────────────────────────
router.put('/request/:requestId/accept', verifyToken, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId)
    const meId      = req.user.id

    const { rows } = await pool.query(
      "SELECT * FROM connection_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'",
      [requestId, meId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' })

    const { from_user_id, to_user_id } = rows[0]

    await pool.query(
      `INSERT INTO social_connections (follower_id, following_id, status)
       VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`,
      [from_user_id, to_user_id]
    )
    await pool.query(
      `INSERT INTO social_connections (follower_id, following_id, status)
       VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`,
      [to_user_id, from_user_id]
    )

    await pool.query(
      `INSERT INTO notifications (user_id, from_user_id, type, content)
       VALUES ($1, $2, 'request_accepted', $3)`,
      [from_user_id, meId, pick(ACCEPT_MSGS)]
    )

    await pool.query('DELETE FROM connection_requests WHERE id = $1', [requestId])

    res.json({ ok: true })
  } catch (err) {
    console.error('Accept request error:', err.message)
    res.status(500).json({ error: 'Failed to accept request' })
  }
})

// ── PUT /api/social/request/:requestId/refuse ─────────────────────────────
router.put('/request/:requestId/refuse', verifyToken, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId)
    const meId      = req.user.id

    const { rows } = await pool.query(
      "SELECT * FROM connection_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'",
      [requestId, meId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' })

    await pool.query(
      `INSERT INTO notifications (user_id, from_user_id, type, content)
       VALUES ($1, $2, 'request_refused', $3)`,
      [rows[0].from_user_id, meId, pick(REFUSE_MSGS)]
    )

    await pool.query('DELETE FROM connection_requests WHERE id = $1', [requestId])

    res.json({ ok: true })
  } catch (err) {
    console.error('Refuse request error:', err.message)
    res.status(500).json({ error: 'Failed to refuse request' })
  }
})

// ── DELETE /api/social/connect/:userId ─────────────────────────────────────
router.delete('/connect/:userId', verifyToken, async (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    await pool.query(
      'DELETE FROM social_connections WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
      [meId, otherId]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Disconnect error:', err.message)
    res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// ── GET /api/social/status/:userId ─────────────────────────────────────────
router.get('/status/:userId', verifyToken, async (req, res) => {
  try {
    const meId     = req.user.id
    const targetId = Number(req.params.userId)

    const { rows: connRows } = await pool.query(
      'SELECT 1 FROM social_connections WHERE follower_id = $1 AND following_id = $2',
      [meId, targetId]
    )
    const connected = connRows.length > 0

    let connectionStatus = 'none'
    let requestId        = null

    if (connected) {
      connectionStatus = 'connected'
    } else {
      const { rows: sentRows } = await pool.query(
        "SELECT id FROM connection_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'",
        [meId, targetId]
      )
      if (sentRows[0]) {
        connectionStatus = 'pending_sent'
        requestId        = sentRows[0].id
      } else {
        const { rows: rcvRows } = await pool.query(
          "SELECT id FROM connection_requests WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'",
          [targetId, meId]
        )
        if (rcvRows[0]) {
          connectionStatus = 'pending_received'
          requestId        = rcvRows[0].id
        }
      }
    }

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::INTEGER as c FROM social_connections WHERE follower_id = $1',
      [targetId]
    )

    res.json({ connectionStatus, requestId, mateCount: countRows[0].c })
  } catch (err) {
    console.error('Status error:', err.message)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

// ── GET /api/social/mates ───────────────────────────────────────────────────
router.get('/mates', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.plan, u.bio, u.watcher_title, u.watcher_level
       FROM social_connections sc
       JOIN users u ON u.id = sc.following_id
       WHERE sc.follower_id = $1
       ORDER BY sc.created_at DESC`,
      [req.user.id]
    )

    res.json({
      count: rows.length,
      mates: rows.map(u => ({
        id:            u.id,
        username:      u.username,
        avatar:        u.avatar || '🎬',
        plan:          u.plan,
        bio:           u.bio || '',
        watcher_title: u.watcher_title || null,
        watcher_level: u.watcher_level || 0,
      }))
    })
  } catch (err) {
    console.error('Mates error:', err.message)
    res.status(500).json({ error: 'Failed to fetch mates' })
  }
})

// ── GET /api/social/pending-requests ───────────────────────────────────────
router.get('/pending-requests', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cr.id, cr.from_user_id, cr.created_at,
              u.username, u.avatar, u.plan
       FROM connection_requests cr
       JOIN users u ON u.id = cr.from_user_id
       WHERE cr.to_user_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    )

    res.json({ requests: rows.map(r => ({
      id:           r.id,
      from_user_id: r.from_user_id,
      username:     r.username,
      avatar:       r.avatar || '🎬',
      plan:         r.plan,
      created_at:   r.created_at,
    })) })
  } catch (err) {
    console.error('Pending requests error:', err.message)
    res.status(500).json({ error: 'Failed to fetch pending requests' })
  }
})

// ── GET /api/social/notifications ──────────────────────────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.username as from_username, u.avatar as from_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.from_user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    )
    res.json({ notifications: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// ── PUT /api/social/notifications/read ─────────────────────────────────────
router.put('/notifications/read', verifyToken, async (req, res) => {
  try {
    const { ids } = req.body
    if (ids && ids.length) {
      await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ANY($1::integer[]) AND user_id = $2',
        [ids, req.user.id]
      )
    } else {
      await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE user_id = $1',
        [req.user.id]
      )
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
})

// ── GET /api/social/unread-count ───────────────────────────────────────────
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::INTEGER as c FROM notifications WHERE user_id = $1 AND is_read = 0',
      [req.user.id]
    )
    res.json({ count: rows[0].c })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' })
  }
})

// ── GET /api/social/connections ─────────────────────────────────────────────
router.get('/connections', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.plan, u.avatar, u.bio
       FROM social_connections sc
       JOIN users u ON u.id = sc.following_id
       WHERE sc.follower_id = $1
       ORDER BY sc.created_at DESC`,
      [req.user.id]
    )
    res.json({ followers: rows, following: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch connections' })
  }
})

export default router
