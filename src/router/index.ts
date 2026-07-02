import { createRouter, createWebHistory } from 'vue-router'
import { tokenIsAdmin } from '@/lib/jwt'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'browse', component: () => import('@/views/BrowseView.vue') },
    { path: '/events/:id', name: 'event', component: () => import('@/views/EventView.vue'), props: true },
    { path: '/checkout', name: 'checkout', component: () => import('@/views/CheckoutView.vue') },
    { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue') },
    { path: '/my-tickets', name: 'my_tickets', component: () => import('@/views/MyTicketsView.vue') },
    { path: '/account', name: 'account', component: () => import('@/views/AccountView.vue') },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      // UX-only gate on the persisted token's claim; every admin API call is
      // re-verified server-side, so a spoofed claim only sees empty forms + 403s.
      beforeEnter: () => (tokenIsAdmin(localStorage.getItem('ticketarget.token')) ? true : { name: 'browse' }),
    },
  ],
})
