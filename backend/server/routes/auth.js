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
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const password_hash = await bcrypt.hash(password, 12)

    const result = db.prepare(
      'INSERT INTO users (email, username, password_hash, plan) VALUES (?, ?, ?, ?)'
    ).run(email.toLowerCase(), username.trim(), password_hash, 'standard')

    const userId = result.lastInsertRowid

    // Create blank preferences row
    db.prepare(
      'INSERT INTO user_preferences (user_id) VALUES (?)'
    ).run(userId)

    const user = { id: userId, email: email.toLowerCase(), username: username.trim(), plan: 'standard' }
    const token = signToken(user)

    res.status(201).json({ token, user })
  } catch (err) {
    console.error('Register error:', err.message)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
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
// No verifyToken — client just needs to call this; token is already being dropped client-side
router.post('/logout', (req, res) => {
  res.json({ ok: true })
})

// ── GET /api/auth/premium-questions ────────────────────────────────────────
// Public route — returns only the questions, not the answers
router.get('/premium-questions', (req, res) => {
  try {
    const questions = JSON.parse(
      readFileSync(join(__dirname, '..', 'premium-questions.json'), 'utf-8')
    )
    // Strip answers before sending
    res.json(questions.map(({ id, question }) => ({ id, question })))
  } catch (err) {
    console.error('Questions error:', err.message)
    res.status(500).json({ error: 'Could not load questions' })
  }
})

// ── POST /api/auth/unlock-premium ──────────────────────────────────────────
router.post('/unlock-premium', verifyToken, (req, res) => {
  try {
    const { answers } = req.body // array of 3 strings

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

    // Upgrade the plan
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('premium', req.user.id)

    // Return a fresh token with updated plan
    const updatedUser = db.prepare('SELECT id, email, username, plan FROM users WHERE id = ?').get(req.user.id)
    const token = signToken(updatedUser)

    res.json({ token, user: updatedUser })
  } catch (err) {
    console.error('Unlock premium error:', err.message)
    res.status(500).json({ error: 'Upgrade failed' })
  }
})

export default router
