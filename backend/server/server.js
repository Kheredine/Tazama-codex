// ⚠️ dotenv/config MUST be the very first import in ESM.
// All static imports are hoisted and evaluated before module body code,
// so dotenv.config() in the body would be too late for route modules.
import 'dotenv/config'

import express from "express"
import cors from "cors"
import OpenAI from "openai"

// Initialize DB (creates tables on first run)
import './db.js'

// Route modules
import authRoutes      from './routes/auth.js'
import userRoutes      from './routes/user.js'
import chatRoutes      from './routes/chat.js'
import socialRoutes    from './routes/social.js'
import feedbackRoutes  from './routes/feedback.js'
import messagesRoutes  from './routes/messages.js'
import playlistsRoutes from './routes/playlists.js'

const app = express()
app.use(cors())
app.use(express.json())
const PORT = Number(process.env.PORT) || 3001

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Auth & User Routes ─────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/user',      userRoutes)
app.use('/api/chat',      chatRoutes)
app.use('/api/social',    socialRoutes)
app.use('/api/feedback',  feedbackRoutes)
app.use('/api/messages',  messagesRoutes)
app.use('/api/playlists', playlistsRoutes)

// Time/content label maps for the prompt
const TIME_LABELS = {
  'Any time':  'any duration',
  '< 30 mins': 'under 30 minutes (short film, episode, documentary short)',
  '~ 1 hour':  'around 1 hour',
  '~ 2 hours': 'around 2 hours (standard movie length)',
  '> 3 hours': 'over 3 hours (epic, mini-series, long documentary)',
}

const CONTENT_LABELS = {
  'Any content':   'any type (movie, series, anime, TV show, or documentary)',
  'Movies':        'movies only',
  'Series':        'TV series only',
  'Anime':         'anime only',
  'TV Shows':      'TV shows and reality TV only',
  'Documentaries': 'documentaries only',
}

const ERA_LABELS = {
  'Any era':           'from any era',
  'Classic (pre-1980)': 'from before 1980 (classic era)',
  '80s':               'from the 1980s',
  '90s':               'from the 1990s',
  '2000s':             'from the 2000s',
  '2010s':             'from the 2010s',
  'Recent (2020+)':    'from 2020 or later (very recent)',
}

/*
|--------------------------------------------------------------------------
| POST /api/recommend
| Returns 3 specific title suggestions per page
|--------------------------------------------------------------------------
*/
app.post("/api/recommend", async (req, res) => {
  try {
    const {
      selectedMood,
      selectedSubMood,
      selectedTime,
      selectedContent,
      selectedEra,
      page = 0,
      excludeTitles   = [],
      dislikedTitles  = [],
      language        = 'en',
    } = req.body

    const isFr = language === 'fr'

    // Use French mood/submood labels if available
    const moodLabel    = isFr ? (selectedMood?.mood_fr    || selectedMood?.mood)    : selectedMood?.mood
    const subMoodLabel = isFr ? (selectedSubMood?.submood_fr || selectedSubMood?.submood) : selectedSubMood?.submood
    const emotionDesc  = isFr
      ? (selectedSubMood?.description_fr || selectedSubMood?.description || selectedMood?.description_fr || selectedMood?.description)
      : (selectedSubMood?.description    || selectedMood?.description)

    const timeLabel    = TIME_LABELS[selectedTime]           || TIME_LABELS['Any time']
    const contentLabel = CONTENT_LABELS[selectedContent]     || CONTENT_LABELS['Any content']
    const eraLabel     = ERA_LABELS[selectedEra]             || ERA_LABELS['Any era']
    const count        = 3

    const excludeNote   = excludeTitles.length
      ? `\nDo NOT suggest any of these titles (already recommended): ${excludeTitles.join(', ')}.`
      : ''
    const dislikedNote  = dislikedTitles.length
      ? `\nThe user disliked these titles — avoid recommending anything similar in tone, genre or style: ${dislikedTitles.join(', ')}.`
      : ''
    const langNote      = isFr
      ? '\nWrite the "reason" field in French.'
      : '\nWrite the "reason" field in English.'

    const systemPrompt = `You are a world-class film critic, psychologist, and streaming expert.
Your job is to recommend specific entertainment titles that perfectly match a viewer's emotional state and needs.
You combine deep knowledge of cinema psychology (transportation theory, affective valence/arousal matching)
with expertise across all genres, eras, and formats.
Always return valid JSON only, no markdown.`

    const userPrompt = `Find ${count} specific entertainment titles that match this emotional profile:

MOOD: ${moodLabel || 'Any'}
SUBMOOD: ${subMoodLabel || 'Any'}
EMOTIONAL NEED: ${emotionDesc || 'General entertainment'}
DURATION: ${timeLabel}
FORMAT: ${contentLabel}
ERA: ${eraLabel}
${excludeNote}${dislikedNote}${langNote}

Requirements:
- Pick SPECIFIC, real titles that exist and can be found on TMDB
- Each recommendation must deeply match the emotional state described
- Include a mix of well-known and hidden gems where possible
- Give a personalized reason (2-3 sentences) explaining WHY this title matches this exact emotional need

Return JSON:
{
  "recommendations": [
    {
      "title": "Exact title in its original or English name (for TMDB lookup)",
      "year": "YYYY",
      "mediaType": "movie|tv",
      "reason": "Why this perfectly matches the emotional profile..."
    }
  ]
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: page > 0 ? 0.92 : 0.72,
    })

    const parsed = JSON.parse(response.choices[0].message.content)
    res.json(parsed.recommendations || [])

  } catch (err) {
    console.error("Recommend error:", err.message)
    res.status(500).json({ error: "Recommendation failed", detail: err.message })
  }
})

/*
|--------------------------------------------------------------------------
| POST /api/discover
| Personalized recommendations for the Discover page
|--------------------------------------------------------------------------
*/
app.post("/api/discover", async (req, res) => {
  try {
    const { topMoods = [], currentHour = 12, likedTitles = [] } = req.body

    const moodContext = topMoods.length
      ? `The user's most common moods are: ${topMoods.join(', ')}.`
      : 'No mood history yet — pick broadly appealing titles.'

    const timeContext = currentHour >= 22 || currentHour < 6
      ? 'It is late night — prefer atmospheric, slower, or intense content.'
      : currentHour >= 6 && currentHour < 12
      ? 'It is morning — prefer lighter, uplifting, or inspiring content.'
      : currentHour >= 12 && currentHour < 18
      ? 'It is afternoon — prefer engaging, varied content.'
      : 'It is evening — prefer immersive, high-quality content.'

    const likedContext = likedTitles.length
      ? `Titles the user has liked: ${likedTitles.slice(0, 10).join(', ')}. Recommend similar but not identical.`
      : ''

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a personalized entertainment curator. Return valid JSON only." },
        { role: "user", content: `
${moodContext}
${timeContext}
${likedContext}

Recommend 6 specific titles for the user's Discover page.
Return JSON: { "recommendations": [{ "title": "", "year": "", "mediaType": "movie|tv", "reason": "" }] }
` },
      ],
    })

    const parsed = JSON.parse(response.choices[0].message.content)
    res.json(parsed.recommendations || [])
  } catch (err) {
    console.error("Discover error:", err.message)
    res.status(500).json({ error: "Discovery failed" })
  }
})

app.listen(PORT, () => console.log(`🎬 Tazama AI server running on port ${PORT}`))
