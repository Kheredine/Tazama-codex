import { Router } from 'express'
import nodemailer from 'nodemailer'
import db from '../db.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

// Build transporter lazily — only if env vars are set
let _transporter = null
const getTransporter = () => {
  if (_transporter) return _transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return _transporter
}

// ── POST /api/feedback ──────────────────────────────────────────────────────
// Optional auth (works for both logged-in and anonymous users)
router.post('/', async (req, res) => {
  try {
    const { name = 'Anonymous', category, message } = req.body

    if (!category || !message || message.trim().length < 5) {
      return res.status(400).json({ error: 'Category and message are required (min 5 chars)' })
    }

    // Save to DB
    let userId = null
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { verifyToken: vt } = await import('../middleware/auth.js')
        // Quick inline decode — non-blocking
        const jwt = (await import('jsonwebtoken')).default
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
        userId = decoded.id
      } catch { /* not logged in — fine */ }
    }

    db.prepare(
      'INSERT INTO feedback (name, user_id, category, message) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), userId, category, message.trim())

    // Try to send email if SMTP is configured
    const transporter = getTransporter()
    if (transporter) {
      const TO   = process.env.FEEDBACK_EMAIL_TO || 'karylinus@gmail.com'
      const FROM = process.env.SMTP_USER

      const categoryLabels = {
        like:    '❤️  Something they like',
        dislike: '👎  Something they dislike',
        improve: '🔧  Improvement suggestion',
        add:     '✨  Feature request',
      }

      await transporter.sendMail({
        from: `"Tazama Feedback" <${FROM}>`,
        to:   TO,
        subject: `[Tazama Feedback] ${categoryLabels[category] || category} — from ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0615; color: #e2e8f0; padding: 32px; border-radius: 16px;">
            <h2 style="color: #a78bfa; margin-top: 0;">📬 New Tazama Feedback</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #94a3b8; width: 120px;">From:</td><td style="padding: 8px 0; font-weight: bold;">${name}</td></tr>
              <tr><td style="padding: 8px 0; color: #94a3b8;">Category:</td><td style="padding: 8px 0;">${categoryLabels[category] || category}</td></tr>
              <tr><td style="padding: 8px 0; color: #94a3b8;">User ID:</td><td style="padding: 8px 0;">${userId || 'Guest'}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0; line-height: 1.7;">${message.trim().replace(/\n/g, '<br>')}</p>
            </div>
            <p style="color: #4b5563; font-size: 12px; margin-top: 24px;">Sent via Tazama feedback form</p>
          </div>
        `,
      })
    }

    res.json({ ok: true, emailSent: !!transporter })
  } catch (err) {
    console.error('Feedback error:', err.message)
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

export default router
