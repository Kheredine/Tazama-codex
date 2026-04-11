import { ref } from 'vue'

// Module-level refs — persist across component unmount/remount (survive navigation)
const selections      = ref(null)
const recommendations = ref([])
const loading         = ref(false)
const error           = ref(null)
const noResult        = ref(false)
const isSubmitted     = ref(false)
const page            = ref(0)   // 0 = first 5, increments by 3 per "show more"

export function useOracleState() {
  const setSelections = (data) => {
    selections.value  = data
    isSubmitted.value = true
    page.value        = 0
    recommendations.value = []
  }

  const reset = () => {
    selections.value      = null
    recommendations.value = []
    loading.value         = false
    error.value           = null
    noResult.value        = false
    isSubmitted.value     = false
    page.value            = 0
  }

  const appendRecommendations = (items) => {
    recommendations.value = [...recommendations.value, ...items]
  }

  const removeRecommendation = (item) => {
    recommendations.value = recommendations.value.filter(
      r => !(String(r.id) === String(item.id) && r.type === item.type)
    )
  }

  return {
    selections,
    recommendations,
    loading,
    error,
    noResult,
    isSubmitted,
    page,
    setSelections,
    reset,
    appendRecommendations,
    removeRecommendation,
  }
}
