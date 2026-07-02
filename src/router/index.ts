import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'browse', component: () => import('@/views/BrowseView.vue') },
    { path: '/events/:id', name: 'event', component: () => import('@/views/EventView.vue'), props: true },
    { path: '/checkout', name: 'checkout', component: () => import('@/views/CheckoutView.vue') },
    { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue') },
    { path: '/my-tickets', name: 'my_tickets', component: () => import('@/views/MyTicketsView.vue') },
  ],
})
