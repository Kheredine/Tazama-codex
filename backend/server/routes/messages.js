import { Router } from 'express'
import pool from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

const areConnected = async (userA, userB) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM social_connections WHERE follower_id = $1 AND following_id = $2',
    [userA, userB]
  )
  return rows.length > 0
}

// ── GET /api/messages/conversations ────────────────────────────────────────
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id

    const { rows: mates } = await pool.query(
      `SELECT u.id, u.username, u.avatar, u.plan
       FROM social_connections sc
       JOIN users u ON u.id = sc.following_id
       WHERE sc.follower_id = $1`,
      [userId]
    )

    const conversations = []
    for (const mate of mates) {
      const { rows: lastMsgRows } = await pool.query(
        `SELECT * FROM messages
         WHERE (from_user_id = $1 AND to_user_id = $2)
            OR (from_user_id = $2 AND to_user_id = $1)
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, mate.id]
      )
      const { rows: unreadRows } = await pool.query(
        'SELECT COUNT(*)::INTEGER as c FROM messages WHERE from_user_id = $1 AND to_user_id = $2 AND is_read = 0',
        [mate.id, userId]
      )

      conversations.push({
        userId:      mate.id,
        username:    mate.username,
        avatar:      mate.avatar || '🎬',
        plan:        mate.plan,
        lastMessage: lastMsgRows[0]?.content || null,
        lastAt:      lastMsgRows[0]?.created_at || null,
        unread:      unreadRows[0].c,
      })
    }

    conversations.sort((a, b) => {
      if (a.lastAt && b.lastAt) return b.lastAt - a.lastAt
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return a.username.localeCompare(b.username)
    })

    res.json({ conversations })
  } catch (err) {
    console.error('Conversations error:', err.message)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// ── GET /api/messages/:userId ───────────────────────────────────────────────
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    if (!await areConnected(meId, otherId)) {
      return res.status(403).json({ error: 'You must be Reel Mates to message this user' })
    }

    const { rows: messages } = await pool.query(
      `SELECT id, from_user_id, to_user_id, content, is_read, created_at
       FROM messages
       WHERE (from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1)
       ORDER BY created_at ASC`,
      [meId, otherId]
    )

    const { rows: otherRows } = await pool.query(
      'SELECT username, avatar FROM users WHERE id = $1',
      [otherId]
    )

    res.json({
      messages,
      otherUser: {
        username: otherRows[0]?.username || '',
        avatar:   otherRows[0]?.avatar   || '🎬',
      }
    })
  } catch (err) {
    console.error('Get thread error:', err.message)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// ── POST /api/messages/:userId ──────────────────────────────────────────────
router.post('/:userId', verifyToken, async (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty' })
    }

    if (!await areConnected(meId, otherId)) {
      return res.status(403).json({ error: 'You must be Reel Mates to message this user' })
    }

    const { rows } = await pool.query(
      'INSERT INTO messages (from_user_id, to_user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [meId, otherId, content.trim()]
    )

    res.json({ ok: true, message: rows[0] })
  } catch (err) {
    console.error('Send message error:', err.message)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── PUT /api/messages/:userId/read ─────────────────────────────────────────
router.put('/:userId/read', verifyToken, async (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE from_user_id = $1 AND to_user_id = $2 AND is_read = 0',
      [otherId, meId]
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Mark read error:', err.message)
    res.status(500).json({ error: 'Failed to mark messages as read' })
  }
})

export default router
