import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import pool from '../db.js'
import { verifyToken, JWT_SECRET } from '../middleware/auth.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, username: user.username, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' })
    }

    const trimmed = username.trim()

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE lower(username) = lower($1)',
      [trimmed]
    )
    if (existing[0]) {
      return res.status(409).json({ error: 'This username is already taken' })
    }

    const passcode = String(Math.floor(1000 + Math.random() * 9000))
    const password_hash = await bcrypt.hash(passcode, 12)
    const email = `${trimmed.toLowerCase().replace(/\s+/g, '_')}@tazama.local`

    const { rows: inserted } = await pool.query(
      'INSERT INTO users (email, username, password_hash, plan) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, trimmed, password_hash, 'standard']
    )
    const userId = inserted[0].id

    await pool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId])

    res.status(201).json({ passcode })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This username is already taken' })
    }
    console.error('Register error:', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, passcode } = req.body

    if (!username || !passcode) {
      return res.status(400).json({ error: 'Username and passcode are required' })
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(username) = lower($1)',
      [username.trim()]
    )
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'No account found with that username' })
    }

    const valid = await bcrypt.compare(String(passcode), user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect passcode for this username' })
    }

    const payload = { id: user.id, email: user.email, username: user.username, plan: user.plan }
    const token = signToken(payload)

    res.json({ token, user: payload })
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched, created_at FROM users WHERE id = $1',
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    console.error('Me error:', err.message)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// ── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ ok: true })
})

// ── GET /api/auth/premium-questions ────────────────────────────────────────
router.get('/premium-questions', (req, res) => {
  try {
    const questions = JSON.parse(
      readFileSync(join(__dirname, '..', 'premium-questions.json'), 'utf-8')
    )
    res.json(questions.map(({ id, question }) => ({ id, question })))
  } catch (err) {
    console.error('Questions error:', err.message)
    res.status(500).json({ error: 'Could not load questions' })
  }
})

// ── POST /api/auth/reset-passcode ──────────────────────────────────────────
router.post('/reset-passcode', async (req, res) => {
  try {
    const { username } = req.body
    if (!username?.trim()) {
      return res.status(400).json({ error: 'Username is required' })
    }

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE lower(username) = lower($1)',
      [username.trim()]
    )
    if (!rows[0]) {
      return res.status(404).json({ error: 'Username not found' })
    }

    const passcode      = String(Math.floor(1000 + Math.random() * 9000))
    const password_hash = await bcrypt.hash(passcode, 12)

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, rows[0].id]
    )

    res.json({ passcode })
  } catch (err) {
    console.error('Reset passcode error:', err.message)
    res.status(500).json({ error: 'Reset failed' })
  }
})

// ── POST /api/auth/unlock-premium ──────────────────────────────────────────
router.post('/unlock-premium', verifyToken, async (req, res) => {
  try {
    const { answers } = req.body

    if (!Array.isArray(answers) || answers.length !== 3) {
      return res.status(400).json({ error: 'Provide exactly 3 answers' })
    }

    const questions = JSON.parse(
      readFileSync(join(__dirname, '..', 'premium-questions.json'), 'utf-8')
    )

    const allCorrect = questions.every((q, i) =>
      (answers[i] || '').toLowerCase().trim() === q.answer.toLowerCase().trim()
    )

    if (!allCorrect) {
      return res.status(403).json({ error: 'Incorrect answers — try again' })
    }

    await pool.query('UPDATE users SET plan = $1 WHERE id = $2', ['premium', req.user.id])

    const { rows } = await pool.query(
      'SELECT id, email, username, plan FROM users WHERE id = $1',
      [req.user.id]
    )
    const token = signToken(rows[0])

    res.json({ token, user: rows[0] })
  } catch (err) {
    console.error('Unlock premium error:', err.message)
    res.status(500).json({ error: 'Upgrade failed' })
  }
})

export default router
