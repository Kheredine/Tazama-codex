import { createRouter, createWebHistory } from 'vue-router'
import TheOracleView from '@/views/TheOracleView.vue'
import { isAuthenticated, isPremium } from '@/composables/useAuth'

const routes = [
  // ── Public ──────────────────────────────────────────────────────────────
  { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue'), meta: { public: true } },

  // ── Standard ─────────────────────────────────────────────────────────────
  { path: '/',                     name: 'oracle',        component: TheOracleView },
  { path: '/discover',             name: 'discover',      component: () => import('@/views/DiscoverView.vue') },
  { path: '/library',              name: 'library',       component: () => import('@/views/LibraryView.vue') },
  { path: '/social',               name: 'social',        component: () => import('@/views/SocialView.vue') },
  { path: '/settings',             name: 'settings',      component: () => import('@/views/SettingsView.vue') },
  { path: '/site-settings',        name: 'site-settings', component: () => import('@/views/SiteSettingsView.vue') },
  { path: '/help',                 name: 'help',          component: () => import('@/views/HelpView.vue') },
  { path: '/plan',                 name: 'plan',          component: () => import('@/views/PlanView.vue') },
  { path: '/notifications',        name: 'notifications', component: () => import('@/views/NotificationsView.vue') },
  { path: '/messages',             name: 'messages',      component: () => import('@/views/MessagesView.vue') },
  { path: '/profile/:id',          name: 'user-profile',  component: () => import('@/views/UserProfileView.vue') },
  { path: '/detail/:type/:id',     name: 'detail',        component: () => import('@/views/DetailView.vue') },

  // ── Premium ───────────────────────────────────────────────────────────────
  {
    path: '/premium-unlock',
    name: 'premium-unlock',
    component: () => import('@/views/PremiumUnlockView.vue'),
  },
  {
    path: '/oracle-chat',
    name: 'oracle-chat',
    component: () => import('@/views/OracleChatView.vue'),
    meta: { requiresPremium: true },
  },
  {
    path: '/analytics',
    name: 'analytics',
    component: () => import('@/views/AnalyticsView.vue'),
    meta: { requiresPremium: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// ── Navigation Guard ────────────────────────────────────────────────────────
router.beforeEach((to) => {
  // Public routes always pass
  if (to.meta.public) return true

  // Require login for all non-public routes
  if (!isAuthenticated.value) return { name: 'auth' }

  // Premium-only routes redirect to plan page if user is standard
  if (to.meta.requiresPremium && !isPremium.value) return { name: 'plan' }

  return true
})

export default router
