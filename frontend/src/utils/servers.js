// ── Provider types ─────────────────────────────────────────────────────────────
export const PROVIDER_TYPES = {
  EMBED:  'embed',   // iframe embed that resolves from TMDB ID
  HLS:    'hls',     // HLS .m3u8 stream
  DIRECT: 'direct',  // Direct MP4 / video URL
}

// ── Audio / language modes ─────────────────────────────────────────────────────
export const AUDIO_MODES = {
  MULTI:   'multi',   // Multi-language (EN default, in-player selector)
  VF:      'vf',      // Voice Française (French dub)
  VOSTFR:  'vostfr',  // Original version + French subtitles
}

// ── Provider categories ────────────────────────────────────────────────────────
export const PROVIDER_CATEGORIES = [
  { id: 'anime',  label: 'French & Anime', icon: 'fa-language',       description: 'VOSTFR / VF — French subtitles & dubs' },
  { id: 'vidsrc', label: 'VidSrc',         icon: 'fa-shield-halved',  description: 'Reliable multi-source embeds' },
  { id: 'embed',  label: 'Embed Services', icon: 'fa-code',           description: 'General-purpose embed players' },
  { id: 'lynx',   label: 'Lynx CDN',       icon: 'fa-bolt',           description: 'CDN-hosted stream providers' },
  { id: 'direct', label: 'Direct Stream',  icon: 'fa-circle-play',    description: 'Direct video CDN hosts' },
  { id: 'multi',  label: 'Multi-Source',   icon: 'fa-layer-group',    description: 'Aggregators across CDN providers' },
]

// ── Provider factory (adapter) ─────────────────────────────────────────────────
const mkProvider = (config) => ({
  type:           PROVIDER_TYPES.EMBED,
  audioMode:      AUDIO_MODES.MULTI,
  subParam:       null,
  requiresFileId: false,
  ...config,
})

// ── VidSrc Family ──────────────────────────────────────────────────────────────
export const VIDSRC_SERVERS = [
  mkProvider({
    id: 'vidsrc-pro',  name: 'VidSrc Pro',  category: 'vidsrc', subParam: 'lang',
    movie: (id) => `https://vidsrc.pro/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-to',   name: 'VidSrc To',   category: 'vidsrc', subParam: 'ds_lang',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-icu',  name: 'VidSrc ICU',  category: 'vidsrc', subParam: 'lang',
    movie: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-me',   name: 'VidSrc Me',   category: 'vidsrc', subParam: 'sub_lang',
    movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv:    (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  }),
  mkProvider({
    id: 'vidsrc-cc',   name: 'VidSrc CC',   category: 'vidsrc', subParam: 'lang',
    movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-xyz',  name: 'VidSrc XYZ',  category: 'vidsrc', subParam: 'lang',
    movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
  }),
]

// ── Embed Services ─────────────────────────────────────────────────────────────
export const EMBED_SERVERS = [
  mkProvider({
    id: '2embed',      name: '2Embed',       category: 'embed',
    movie: (id) => `https://2embed.cc/embed/${id}`,
    tv:    (id, s, e) => `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'superembed',  name: 'SuperEmbed',   category: 'embed', subParam: 'lang',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'embed-su',    name: 'Embed.su',     category: 'embed',
    movie: (id) => `https://embed.su/embed/movie/${id}`,
    tv:    (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'autoembed',   name: 'AutoEmbed',    category: 'embed',
    movie: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    tv:    (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
  }),
  mkProvider({
    id: 'nontongo',    name: 'NontonGo',     category: 'embed',
    movie: (id) => `https://nontongo.win/embed/movie/${id}`,
    tv:    (id, s, e) => `https://nontongo.win/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'moviesapi',   name: 'MovieAPI',     category: 'embed', subParam: 'sub_lang',
    movie: (id) => `https://moviesapi.club/movie/${id}`,
    tv:    (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
  }),
  mkProvider({
    id: 'vidlink',     name: 'VidLink',      category: 'embed', subParam: 'lang',
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'smashy',      name: 'SmashyStream', category: 'embed',
    movie: (id) => `https://player.smashy.stream/movie/${id}`,
    tv:    (id, s, e) => `https://player.smashy.stream/tv/${id}/${s}/${e}`,
  }),
]

// ── Lynx CDN Providers ─────────────────────────────────────────────────────────
// CDN video hosts accessible via TMDB-based embed wrappers.
// requiresFileId providers may need a backend scraper for full TMDB resolution.
export const LYNX_SERVERS = [
  mkProvider({
    id: 'vidsonic',    name: 'VidSonic',    category: 'lynx',
    movie: (id) => `https://vidsonic.net/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://vidsonic.net/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'vidara',      name: 'Vidara',      category: 'lynx',
    movie: (id) => `https://vidara.to/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidara.to/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'voe-sx',      name: 'Voe.sx',      category: 'lynx', requiresFileId: true,
    movie: (id) => `https://voe.sx/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://voe.sx/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'flemmix',     name: 'Flemmix',     category: 'lynx',
    movie: (id) => `https://flemmix.upns.pro/embed/${id}`,
    tv:    (id, s, e) => `https://flemmix.upns.pro/embed/${id}?s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'luluvdo',     name: 'LuluVDO',     category: 'lynx', requiresFileId: true,
    movie: (id) => `https://luluvdo.com/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://luluvdo.com/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'xshotok',     name: 'XShotok',     category: 'lynx', requiresFileId: true,
    movie: (id) => `https://xshotok.com/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://xshotok.com/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'playmogo',    name: 'PlayMogo',    category: 'lynx',
    movie: (id) => `https://playmogo.com/embed/${id}`,
    tv:    (id, s, e) => `https://playmogo.com/embed/${id}?s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'savefiles',   name: 'SaveFiles',   category: 'lynx', requiresFileId: true,
    movie: (id) => `https://savefiles.com/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://savefiles.com/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'ugload',      name: 'UgLoad',      category: 'lynx', requiresFileId: true,
    movie: (id) => `https://ugload.is/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://ugload.is/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'minochinos',  name: 'Minochinos',  category: 'lynx',
    movie: (id) => `https://minochinos.com/embed/${id}`,
    tv:    (id, s, e) => `https://minochinos.com/embed/${id}?s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'waaw',        name: 'Waaw.to',     category: 'lynx', requiresFileId: true,
    movie: (id) => `https://waaw.to/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://waaw.to/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'hgcloud',     name: 'HGCloud',     category: 'lynx', requiresFileId: true,
    movie: (id) => `https://hgcloud.to/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://hgcloud.to/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
]

// ── Direct Streaming Providers ─────────────────────────────────────────────────
export const DIRECT_SERVERS = [
  mkProvider({
    id: 'voe',          name: 'Voe',         category: 'direct', requiresFileId: true,
    movie: (id) => `https://voe.sx/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://voe.sx/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'streamtape',   name: 'Streamtape',  category: 'direct', requiresFileId: true,
    movie: (id) => `https://streamtape.com/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://streamtape.com/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'streamwish',   name: 'Streamwish',  category: 'direct', requiresFileId: true,
    movie: (id) => `https://streamwish.to/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://streamwish.to/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'filelions',    name: 'FileLions',   category: 'direct', requiresFileId: true,
    movie: (id) => `https://filelions.to/v?tmdb=${id}`,
    tv:    (id, s, e) => `https://filelions.to/v?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'doodstream',   name: 'DoodStream',  category: 'direct', requiresFileId: true,
    movie: (id) => `https://dood.wf/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://dood.wf/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'mixdrop',      name: 'MixDrop',     category: 'direct', requiresFileId: true,
    movie: (id) => `https://mixdrop.ag/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://mixdrop.ag/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'vidmoly',      name: 'VidMoly',     category: 'direct', requiresFileId: true,
    movie: (id) => `https://vidmoly.to/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://vidmoly.to/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'lulustream',   name: 'LuluStream',  category: 'direct', requiresFileId: true,
    movie: (id) => `https://lulustream.com/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://lulustream.com/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'savefiles-d',  name: 'SaveFiles',   category: 'direct', requiresFileId: true,
    movie: (id) => `https://savefiles.com/embed?tmdb=${id}`,
    tv:    (id, s, e) => `https://savefiles.com/embed?tmdb=${id}&s=${s}&e=${e}`,
  }),
]

// ── Multi-Source Aggregators ────────────────────────────────────────────────────
export const MULTI_SERVERS = [
  mkProvider({
    id: 'lulustream-m', name: 'LuluStream', category: 'multi',
    movie: (id) => `https://lulustream.com/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://lulustream.com/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'voesx',        name: 'VoeSX',      category: 'multi',
    movie: (id) => `https://voe.sx/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://voe.sx/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'netu',         name: 'Netu',       category: 'multi',
    movie: (id) => `https://netu.ac/e/?tmdb=${id}`,
    tv:    (id, s, e) => `https://netu.ac/e/?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'veed',         name: 'Veed',       category: 'multi',
    movie: (id) => `https://veed.to/e?tmdb=${id}`,
    tv:    (id, s, e) => `https://veed.to/e?tmdb=${id}&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'cofliux',      name: 'Cofliux',    category: 'multi',
    movie: (id) => `https://cofliux.com/embed/${id}`,
    tv:    (id, s, e) => `https://cofliux.com/embed/${id}?season=${s}&episode=${e}`,
  }),
  mkProvider({
    id: 'minochinos-m', name: 'Minochinos', category: 'multi',
    movie: (id) => `https://minochinos.com/embed/${id}`,
    tv:    (id, s, e) => `https://minochinos.com/embed/${id}?s=${s}&e=${e}`,
  }),
]

// ── French & Anime Providers ───────────────────────────────────────────────────
// VOSTFR = original audio + French subtitles (forced via lang param).
// VF     = French dub track when available from the provider.
// Coverage varies by title — try multiple servers if one has no French track.
export const ANIME_FR_SERVERS = [

  // ── VOSTFR ──────────────────────────────────────────────────────────────────
  mkProvider({
    id: 'vidsrc-to-vostfr',  name: 'VidSrc.to VOSTFR',   category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'ds_lang',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-me-vostfr',  name: 'VidSrc.me VOSTFR',   category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'sub_lang',
    movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv:    (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  }),
  mkProvider({
    id: 'vidlink-vostfr',    name: 'VidLink VOSTFR',      category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'lang',
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'superembed-vostfr', name: 'SuperEmbed VOSTFR',   category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'lang',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'vidsrc-cc-vostfr',  name: 'VidSrc CC VOSTFR',   category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'lang',
    movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-xyz-vostfr', name: 'VidSrc XYZ VOSTFR',  category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR, subParam: 'lang',
    movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'autoembed-vostfr',  name: 'AutoEmbed VOSTFR',    category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR,
    movie: (id) => `https://autoembed.co/movie/tmdb/${id}?lang=fr`,
    tv:    (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}?lang=fr`,
  }),
  mkProvider({
    id: 'embedsu-vostfr',    name: 'Embed.su VOSTFR',     category: 'anime',
    audioMode: AUDIO_MODES.VOSTFR,
    movie: (id) => `https://embed.su/embed/movie/${id}?lang=fr`,
    tv:    (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}?lang=fr`,
  }),

  // ── VF (French dub) ─────────────────────────────────────────────────────────
  mkProvider({
    id: 'vidsrc-pro-vf',     name: 'VidSrc Pro VF',       category: 'anime',
    audioMode: AUDIO_MODES.VF, subParam: 'lang',
    movie: (id) => `https://vidsrc.pro/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidsrc-to-vf',      name: 'VidSrc.to VF',        category: 'anime',
    audioMode: AUDIO_MODES.VF, subParam: 'ds_lang',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv:    (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'vidlink-vf',        name: 'VidLink VF',           category: 'anime',
    audioMode: AUDIO_MODES.VF, subParam: 'lang',
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  }),
  mkProvider({
    id: 'superembed-vf',     name: 'SuperEmbed VF',        category: 'anime',
    audioMode: AUDIO_MODES.VF, subParam: 'lang',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  }),
  mkProvider({
    id: 'autoembed-vf',      name: 'AutoEmbed VF',         category: 'anime',
    audioMode: AUDIO_MODES.VF,
    movie: (id) => `https://autoembed.co/movie/tmdb/${id}?lang=fr&dubbed=true`,
    tv:    (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}?lang=fr&dubbed=true`,
  }),
]

// ── Aggregated exports ─────────────────────────────────────────────────────────
export const ALL_SERVERS = [
  ...VIDSRC_SERVERS,
  ...EMBED_SERVERS,
  ...LYNX_SERVERS,
  ...DIRECT_SERVERS,
  ...MULTI_SERVERS,
  ...ANIME_FR_SERVERS,
]

// Backward-compatible aliases
export const PRIMARY_SERVERS = VIDSRC_SERVERS
export const BACKUP_SERVERS  = EMBED_SERVERS

// ── Helpers ────────────────────────────────────────────────────────────────────
export const getEmbedUrl = (server, type, id, season = 1, episode = 1, lang = 'en') => {
  const base = type === 'movie' ? server.movie(id) : server.tv(id, season, episode)
  if (!server.subParam) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${server.subParam}=${lang}`
}

export const getServersByCategory = (categoryId) =>
  ALL_SERVERS.filter(s => s.category === categoryId)

export const getServerIndex = (serverId) =>
  ALL_SERVERS.findIndex(s => s.id === serverId)
