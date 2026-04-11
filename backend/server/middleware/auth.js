import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'tazama-secret-change-in-production'

/**
 * Verifies the Bearer JWT from the Authorization header.
 * Attaches decoded payload as req.user = { id, email, username, plan }
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Must be used AFTER verifyToken.
 * Rejects the request if the user is not on the premium plan.
 */
export const requirePremium = (req, res, next) => {
  if (req.user?.plan !== 'premium') {
    return res.status(403).json({ error: 'Premium plan required' })
  }
  next()
}

export { JWT_SECRET }
