<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'
import { useThemeStore } from '@/stores/theme'

const booking = useBookingStore()
const auth = useAuthStore()
const theme = useThemeStore()
void auth.restore()
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">
      <span class="brand-mark" aria-hidden="true">T</span>
      Ticketarget
    </RouterLink>
    <nav class="top-actions">
      <template v-if="auth.user">
        <RouterLink v-if="auth.isAdmin" :to="{ name: 'admin' }" class="signin">Admin</RouterLink>
        <RouterLink :to="{ name: 'my_tickets' }" class="signin">My tickets</RouterLink>
        <RouterLink :to="{ name: 'account' }" class="account-name">Hi, {{ auth.user.name.split(' ')[0] }}</RouterLink>
        <button class="linklike" @click="auth.logout">Sign out</button>
      </template>
      <RouterLink v-else to="/auth" class="signin">Sign in</RouterLink>
      <RouterLink to="/checkout" class="cart">
        Cart
        <span class="cart-count" :class="{ empty: booking.selected.length === 0 }">
          {{ booking.selected.length }}
        </span>
      </RouterLink>
      <button
        class="theme-toggle"
        :aria-label="theme.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        :title="theme.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="theme.toggle"
      >
        <span aria-hidden="true">{{ theme.theme === 'dark' ? '☀️' : '🌙' }}</span>
      </button>
    </nav>
  </header>
  <main class="container">
    <RouterView />
  </main>
  <footer class="footer">
    Ticketarget — a high-availability ticketing reference build. Payments run in Stripe test mode.
  </footer>
</template>
