import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'login', component: () => import('@modules/auth/presentation/bodies/LoginPage.vue') },
  { path: '/login', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
