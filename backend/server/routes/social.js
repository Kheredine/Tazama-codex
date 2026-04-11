import { Router } from 'express'
import db from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// ── Funny message pools ─────────────────────────────────────────────────────
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
router.get('/search', verifyToken, (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (q.length < 2) return res.json({ users: [] })

    const users = db.prepare(`
      SELECT id, username, plan, avatar, bio, is_discoverable, watcher_title, watcher_level
      FROM users
      WHERE LOWER(username) LIKE LOWER(?) AND COALESCE(is_discoverable, 1) != 0 AND id != ?
      LIMIT 10
    `).all(`%${q}%`, req.user.id)

    res.json({ users: users.map(u => ({
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
// Send a connection request
router.post('/request/:userId', verifyToken, (req, res) => {
  try {
    const fromId = req.user.id
    const toId   = Number(req.params.userId)

    if (fromId === toId) return res.status(400).json({ error: "You can't request yourself" })

    const target = db.prepare('SELECT id, username, is_discoverable FROM users WHERE id = ?').get(toId)
    if (!target || !target.is_discoverable) return res.status(404).json({ error: 'User not found' })

    // Check no existing connection
    const existingConn = db.prepare(
      `SELECT id FROM social_connections WHERE
        (follower_id = ? AND following_id = ?) OR
        (follower_id = ? AND following_id = ?)`
    ).get(fromId, toId, toId, fromId)
    if (existingConn) return res.status(409).json({ error: 'Already connected' })

    // Check no existing pending request
    const existingReq = db.prepare(
      'SELECT id FROM connection_requests WHERE from_user_id = ? AND to_user_id = ?'
    ).get(fromId, toId)
    if (existingReq) return res.status(409).json({ error: 'Request already sent' })

    // Insert request
    const result = db.prepare(
      'INSERT INTO connection_requests (from_user_id, to_user_id) VALUES (?, ?)'
    ).run(fromId, toId)

    // Notify target
    const sender = db.prepare('SELECT username, avatar FROM users WHERE id = ?').get(fromId)
    db.prepare(`
      INSERT INTO notifications (user_id, from_user_id, type, content, entity_id)
      VALUES (?, ?, 'connection_request', ?, ?)
    `).run(
      toId,
      fromId,
      `🎬 ${sender.username} wants to be your Reel Mate!`,
      String(result.lastInsertRowid)
    )

    res.json({ ok: true, requestId: result.lastInsertRowid })
  } catch (err) {
    console.error('Send request error:', err.message)
    res.status(500).json({ error: 'Failed to send request' })
  }
})

// ── PUT /api/social/request/:requestId/accept ──────────────────────────────
router.put('/request/:requestId/accept', verifyToken, (req, res) => {
  try {
    const requestId = Number(req.params.requestId)
    const meId      = req.user.id

    const req_ = db.prepare(
      'SELECT * FROM connection_requests WHERE id = ? AND to_user_id = ? AND status = ?'
    ).get(requestId, meId, 'pending')
    if (!req_) return res.status(404).json({ error: 'Request not found' })

    const { from_user_id, to_user_id } = req_

    // Move to social_connections
    db.prepare(
      `INSERT OR IGNORE INTO social_connections (follower_id, following_id, status)
       VALUES (?, ?, 'accepted')`
    ).run(from_user_id, to_user_id)

    // Also add reverse so connection is mutual
    db.prepare(
      `INSERT OR IGNORE INTO social_connections (follower_id, following_id, status)
       VALUES (?, ?, 'accepted')`
    ).run(to_user_id, from_user_id)

    // Send funny acceptance notification to the requester
    const accepter = db.prepare('SELECT username FROM users WHERE id = ?').get(meId)
    db.prepare(`
      INSERT INTO notifications (user_id, from_user_id, type, content)
      VALUES (?, ?, 'request_accepted', ?)
    `).run(from_user_id, meId, pick(ACCEPT_MSGS))

    // Delete the request
    db.prepare('DELETE FROM connection_requests WHERE id = ?').run(requestId)

    res.json({ ok: true })
  } catch (err) {
    console.error('Accept request error:', err.message)
    res.status(500).json({ error: 'Failed to accept request' })
  }
})

// ── PUT /api/social/request/:requestId/refuse ─────────────────────────────
router.put('/request/:requestId/refuse', verifyToken, (req, res) => {
  try {
    const requestId = Number(req.params.requestId)
    const meId      = req.user.id

    const req_ = db.prepare(
      'SELECT * FROM connection_requests WHERE id = ? AND to_user_id = ? AND status = ?'
    ).get(requestId, meId, 'pending')
    if (!req_) return res.status(404).json({ error: 'Request not found' })

    const { from_user_id } = req_

    // Send funny refusal notification to the requester
    db.prepare(`
      INSERT INTO notifications (user_id, from_user_id, type, content)
      VALUES (?, ?, 'request_refused', ?)
    `).run(from_user_id, meId, pick(REFUSE_MSGS))

    // Delete the request
    db.prepare('DELETE FROM connection_requests WHERE id = ?').run(requestId)

    res.json({ ok: true })
  } catch (err) {
    console.error('Refuse request error:', err.message)
    res.status(500).json({ error: 'Failed to refuse request' })
  }
})

// ── DELETE /api/social/connect/:userId ─────────────────────────────────────
// Remove an existing accepted connection
router.delete('/connect/:userId', verifyToken, (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    db.prepare(
      'DELETE FROM social_connections WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)'
    ).run(meId, otherId, otherId, meId)

    res.json({ ok: true })
  } catch (err) {
    console.error('Disconnect error:', err.message)
    res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// ── GET /api/social/status/:userId ─────────────────────────────────────────
// Returns connectionStatus: none|pending_sent|pending_received|connected
router.get('/status/:userId', verifyToken, (req, res) => {
  try {
    const meId     = req.user.id
    const targetId = Number(req.params.userId)

    // Check existing connection (mutual via both rows)
    const connected = !!db.prepare(
      'SELECT 1 FROM social_connections WHERE follower_id = ? AND following_id = ?'
    ).get(meId, targetId)

    let connectionStatus = 'none'
    let requestId        = null

    if (connected) {
      connectionStatus = 'connected'
    } else {
      // Check pending sent
      const sentReq = db.prepare(
        'SELECT id FROM connection_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?'
      ).get(meId, targetId, 'pending')

      if (sentReq) {
        connectionStatus = 'pending_sent'
        requestId        = sentReq.id
      } else {
        // Check pending received
        const receivedReq = db.prepare(
          'SELECT id FROM connection_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?'
        ).get(targetId, meId, 'pending')

        if (receivedReq) {
          connectionStatus = 'pending_received'
          requestId        = receivedReq.id
        }
      }
    }

    // Count accepted connections of the target user
    const mateCount = db.prepare(
      'SELECT COUNT(*) as c FROM social_connections WHERE follower_id = ?'
    ).get(targetId).c

    res.json({ connectionStatus, requestId, mateCount })
  } catch (err) {
    console.error('Status error:', err.message)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

// ── GET /api/social/mates ───────────────────────────────────────────────────
// Returns user's accepted connections
router.get('/mates', verifyToken, (req, res) => {
  try {
    const userId = req.user.id

    // Since connections are stored bidirectionally (two rows per pair),
    // we only need to look at follower_id = userId rows
    const mates = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.plan, u.bio, u.watcher_title, u.watcher_level
      FROM social_connections sc
      JOIN users u ON u.id = sc.following_id
      WHERE sc.follower_id = ?
      ORDER BY sc.created_at DESC
    `).all(userId)

    res.json({
      count: mates.length,
      mates: mates.map(u => ({
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
// Returns incoming pending requests for the logged-in user
router.get('/pending-requests', verifyToken, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT cr.id, cr.from_user_id, cr.created_at,
             u.username, u.avatar, u.plan
      FROM connection_requests cr
      JOIN users u ON u.id = cr.from_user_id
      WHERE cr.to_user_id = ? AND cr.status = 'pending'
      ORDER BY cr.created_at DESC
    `).all(req.user.id)

    res.json({ requests: requests.map(r => ({
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
router.get('/notifications', verifyToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT n.*, u.username as from_username, u.avatar as from_avatar
      FROM notifications n
      LEFT JOIN users u ON u.id = n.from_user_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id)

    res.json({ notifications })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// ── PUT /api/social/notifications/read ─────────────────────────────────────
router.put('/notifications/read', verifyToken, (req, res) => {
  try {
    const { ids } = req.body
    if (ids && ids.length) {
      const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      for (const id of ids) stmt.run(id, req.user.id)
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id)
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
})

// ── GET /api/social/unread-count ───────────────────────────────────────────
router.get('/unread-count', verifyToken, (req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id)
    res.json({ count: row.c })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' })
  }
})

// ── GET /api/social/connections (kept for backwards compat) ─────────────────
router.get('/connections', verifyToken, (req, res) => {
  try {
    const userId = req.user.id

    const mates = db.prepare(`
      SELECT u.id, u.username, u.plan, u.avatar, u.bio
      FROM social_connections sc
      JOIN users u ON u.id = sc.following_id
      WHERE sc.follower_id = ?
      ORDER BY sc.created_at DESC
    `).all(userId)

    res.json({ followers: mates, following: mates })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch connections' })
  }
})

export default router
