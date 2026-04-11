import { ref } from 'vue'

export function useTimeOfDay() {
  const day = ref('')
  const timeOfDay = ref('')

  const now = new Date()

  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]

  day.value = days[now.getDay()]

  const hour = now.getHours()

  if (hour < 12) timeOfDay.value = 'Morning'
  else if (hour < 17) timeOfDay.value = 'Afternoon'
  else if (hour < 21) timeOfDay.value = 'Evening'
  else timeOfDay.value = 'Night'

  return { day, timeOfDay }
}