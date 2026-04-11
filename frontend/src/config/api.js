const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '')

export const apiUrl = (path = '') => {
  if (!path) return API_BASE_URL
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
