import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import db from '../db.js'
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
// Accepts { username }, generates a 4-digit passcode, returns it once (plaintext).
// The user must then verify by calling /login — they are NOT auto-signed in here.
router.post('/register', async (req, res) => {
  try {
    const { username } = req.body

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' })
    }

    const trimmed = username.trim()

    const existing = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(trimmed)
    if (existing) {
      return res.status(409).json({ error: 'This username is already taken' })
    }

    // Generate 4-digit passcode (1000–9999)
    const passcode = String(Math.floor(1000 + Math.random() * 9000))
    const password_hash = await bcrypt.hash(passcode, 12)

    // Auto-generate a unique internal email
    const email = `${trimmed.toLowerCase().replace(/\s+/g, '_')}@tazama.local`

    const result = db.prepare(
      'INSERT INTO users (email, username, password_hash, plan) VALUES (?, ?, ?, ?)'
    ).run(email, trimmed, password_hash, 'standard')

    const userId = result.lastInsertRowid

    db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId)

    res.status(201).json({ passcode })
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'This username is already taken' })
    }
    console.error('Register error:', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── POST /api/auth/login ────────────────────────────────────────────────────
// Accepts { username, passcode }
router.post('/login', async (req, res) => {
  try {
    const { username, passcode } = req.body

    if (!username || !passcode) {
      return res.status(400).json({ error: 'Username and passcode are required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(username.trim())
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
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, username, plan, avatar, bio, is_discoverable, privacy_liked, privacy_watchlist, privacy_watched, created_at FROM users WHERE id = ?'
  ).get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user })
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
// Accepts { username }, generates a fresh 4-digit passcode, returns it once.
// The old passcode is replaced immediately and cannot be recovered.
router.post('/reset-passcode', async (req, res) => {
  try {
    const { username } = req.body
    if (!username?.trim()) {
      return res.status(400).json({ error: 'Username is required' })
    }

    const user = db
      .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
      .get(username.trim())

    if (!user) {
      return res.status(404).json({ error: 'Username not found' })
    }

    const passcode       = String(Math.floor(1000 + Math.random() * 9000))
    const password_hash  = await bcrypt.hash(passcode, 12)

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id)

    res.json({ passcode })
  } catch (err) {
    console.error('Reset passcode error:', err.message)
    res.status(500).json({ error: 'Reset failed' })
  }
})

// ── POST /api/auth/unlock-premium ──────────────────────────────────────────
router.post('/unlock-premium', verifyToken, (req, res) => {
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

    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('premium', req.user.id)

    const updatedUser = db.prepare('SELECT id, email, username, plan FROM users WHERE id = ?').get(req.user.id)
    const token = signToken(updatedUser)

    res.json({ token, user: updatedUser })
  } catch (err) {
    console.error('Unlock premium error:', err.message)
    res.status(500).json({ error: 'Upgrade failed' })
  }
})

export default router
