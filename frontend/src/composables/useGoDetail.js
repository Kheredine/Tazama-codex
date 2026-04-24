import { useRouter } from 'vue-router'

export function useGoDetail() {
  const router = useRouter()

  const goDetail = (item, event = null) => {
    const rawType = item.media_type || item.type || 'movie'
    const type    = rawType === 'movie' ? 'movie' : 'tv'
    const id      = item.id ?? item.tmdb_id
    const route   = router.resolve({ name: 'detail', params: { type, id } })
    if (event?.ctrlKey || event?.metaKey) {
      window.open(route.href, '_blank')
    } else {
      router.push(route)
    }
  }

  return { goDetail }
}
