import { Router } from 'express'
import OpenAI from 'openai'
import pool from '../db.js'
import { verifyToken, requirePremium } from '../middleware/auth.js'

const router = Router()

let _openai = null
const openai = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

const ORACLE_SYSTEM = `You are the Oracle — a witty, deeply knowledgeable entertainment expert, film critic, and curator with an air of mystique. You speak with confidence, warmth, and personality.

Your expertise spans cinema, television, anime, documentaries, and streaming culture across all eras and countries.

## RESPONSE FORMAT (always follow this structure):

**For recommendations**, use this exact format:
1. One sentence intro (atmospheric, in character as the Oracle)
2. Each recommendation as a card:

---
🎬 **[Title]** ([Year]) · [Movie/Series/Anime/Doc]
*[One-line emotional hook — why it matters]*
**Why it matches:** [1-2 sentences connecting to the user's request]
**Mood/Tags:** [3-5 tags like "contemplative · slow-burn · visually stunning"]
---

3. End with one brief closing line (optional Oracle wisdom or follow-up question)

**For discussion/questions** (not recommendations):
- Use bullet points or short paragraphs
- Never write walls of text
- Max 3-4 sentences per point
- Bold key terms

## Always:
- Speak as the Oracle — opinionated, specific, slightly dramatic
- Name directors, actors, cinematographers when relevant
- If vague request → ask ONE clarifying question before recommending
- Keep total response under 350 words
- Use markdown formatting (bold, bullets, horizontal rules)
- Never write a single long paragraph`

// ── POST /api/chat/oracle ────────────────────────────────────────────────────
router.post('/oracle', verifyToken, requirePremium, async (req, res) => {
  try {
    const { message } = req.body
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const userId = req.user.id

    await pool.query(
      'INSERT INTO oracle_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
      [userId, 'user', message.trim()]
    )

    const { rows: history } = await pool.query(
      'SELECT role, content FROM oracle_chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40',
      [userId]
    )

    const messages = [
      { role: 'system', content: ORACLE_SYSTEM },
      ...history.reverse().map(m => ({ role: m.role, content: m.content })),
    ]

    const response = await openai().chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.85,
      max_tokens: 700,
    })

    const reply = response.choices[0].message.content

    await pool.query(
      'INSERT INTO oracle_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
      [userId, 'assistant', reply]
    )

    res.json({ reply })
  } catch (err) {
    console.error('Oracle chat error:', err.message)
    res.status(500).json({ error: 'Oracle is temporarily unavailable' })
  }
})

// ── GET /api/chat/oracle/history ─────────────────────────────────────────────
router.get('/oracle/history', verifyToken, requirePremium, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT role, content, created_at FROM oracle_chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 60',
      [req.user.id]
    )
    res.json({ messages: rows })
  } catch (err) {
    console.error('Chat history error:', err.message)
    res.status(500).json({ error: 'Failed to fetch chat history' })
  }
})

// ── DELETE /api/chat/oracle/history ──────────────────────────────────────────
router.delete('/oracle/history', verifyToken, requirePremium, async (req, res) => {
  try {
    await pool.query('DELETE FROM oracle_chat_messages WHERE user_id = $1', [req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Clear history error:', err.message)
    res.status(500).json({ error: 'Failed to clear history' })
  }
})

export default router
