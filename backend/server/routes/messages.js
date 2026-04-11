import { Router } from 'express'
import db from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// Helper: check if two users are connected (accepted connection)
const areConnected = (userA, userB) => {
  return !!db.prepare(
    'SELECT 1 FROM social_connections WHERE follower_id = ? AND following_id = ?'
  ).get(userA, userB)
}

// ── GET /api/messages/conversations ────────────────────────────────────────
// List all conversations (one per mate who has exchanged at least one message)
router.get('/conversations', verifyToken, (req, res) => {
  try {
    const userId = req.user.id

    // Get all mates first
    const mates = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.plan
      FROM social_connections sc
      JOIN users u ON u.id = sc.following_id
      WHERE sc.follower_id = ?
    `).all(userId)

    const conversations = []

    for (const mate of mates) {
      // Get latest message between them
      const lastMsg = db.prepare(`
        SELECT * FROM messages
        WHERE (from_user_id = ? AND to_user_id = ?)
           OR (from_user_id = ? AND to_user_id = ?)
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId, mate.id, mate.id, userId)

      // Count unread messages from this mate
      const unreadRow = db.prepare(`
        SELECT COUNT(*) as c FROM messages
        WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0
      `).get(mate.id, userId)

      conversations.push({
        userId:      mate.id,
        username:    mate.username,
        avatar:      mate.avatar || '🎬',
        plan:        mate.plan,
        lastMessage: lastMsg?.content || null,
        lastAt:      lastMsg?.created_at || null,
        unread:      unreadRow.c,
      })
    }

    // Sort by last message date (most recent first), then alphabetically
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
// Get message thread with a specific user (must be connected)
router.get('/:userId', verifyToken, (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    if (!areConnected(meId, otherId)) {
      return res.status(403).json({ error: 'You must be Reel Mates to message this user' })
    }

    const messages = db.prepare(`
      SELECT id, from_user_id, to_user_id, content, is_read, created_at
      FROM messages
      WHERE (from_user_id = ? AND to_user_id = ?)
         OR (from_user_id = ? AND to_user_id = ?)
      ORDER BY created_at ASC
    `).all(meId, otherId, otherId, meId)

    const otherUser = db.prepare('SELECT username, avatar FROM users WHERE id = ?').get(otherId)

    res.json({
      messages,
      otherUser: {
        username: otherUser?.username || '',
        avatar:   otherUser?.avatar   || '🎬',
      }
    })
  } catch (err) {
    console.error('Get thread error:', err.message)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// ── POST /api/messages/:userId ──────────────────────────────────────────────
// Send a message to a specific user (must be connected)
router.post('/:userId', verifyToken, (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty' })
    }

    if (!areConnected(meId, otherId)) {
      return res.status(403).json({ error: 'You must be Reel Mates to message this user' })
    }

    const result = db.prepare(`
      INSERT INTO messages (from_user_id, to_user_id, content)
      VALUES (?, ?, ?)
    `).run(meId, otherId, content.trim())

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid)

    res.json({ ok: true, message })
  } catch (err) {
    console.error('Send message error:', err.message)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── PUT /api/messages/:userId/read ─────────────────────────────────────────
// Mark all messages from userId to me as read
router.put('/:userId/read', verifyToken, (req, res) => {
  try {
    const meId    = req.user.id
    const otherId = Number(req.params.userId)

    db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0
    `).run(otherId, meId)

    res.json({ ok: true })
  } catch (err) {
    console.error('Mark read error:', err.message)
    res.status(500).json({ error: 'Failed to mark messages as read' })
  }
})

export default router
