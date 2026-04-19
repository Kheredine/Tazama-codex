export const PRIMARY_SERVERS = [
  {
    name: 'VidSrc Pro',
    id: 'vidsrc-pro',
    movie: (id) => `https://vidsrc.pro/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc To',
    id: 'vidsrc-to',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc ICU',
    id: 'vidsrc-icu',
    movie: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc Me',
    id: 'vidsrc-me',
    movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tv: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    name: 'VidSrc CC',
    id: 'vidsrc-cc',
    movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc XYZ',
    id: 'vidsrc-xyz',
    movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
  },
]

export const BACKUP_SERVERS = [
  {
    name: '2Embed',
    id: '2embed',
    movie: (id) => `https://2embed.cc/embed/${id}`,
    tv: (id, s, e) => `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    name: 'SuperEmbed',
    id: 'superembed',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    name: 'Embed.su',
    id: 'embed-su',
    movie: (id) => `https://embed.su/embed/movie/${id}`,
    tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'AutoEmbed',
    id: 'autoembed',
    movie: (id) => `https://autoembed.co/movie/tmdb/${id}`,
    tv: (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
  },
  {
    name: 'NontonGo',
    id: 'nontongo',
    movie: (id) => `https://nontongo.win/embed/movie/${id}`,
    tv: (id, s, e) => `https://nontongo.win/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'MovieAPI',
    id: 'moviesapi',
    movie: (id) => `https://moviesapi.club/movie/${id}`,
    tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
  },
  {
    name: 'VidLink',
    id: 'vidlink',
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    name: 'SmashyStream',
    id: 'smashy',
    movie: (id) => `https://player.smashy.stream/movie/${id}`,
    tv: (id, s, e) => `https://player.smashy.stream/tv/${id}/${s}/${e}`,
  },
]

export const ALL_SERVERS = [...PRIMARY_SERVERS, ...BACKUP_SERVERS]

export const getEmbedUrl = (server, type, id, season = 1, episode = 1, lang = 'en') => {
  const base = type === 'movie' ? server.movie(id) : server.tv(id, season, episode)
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}sub_lang=${lang}&ds_lang=${lang}`
}
