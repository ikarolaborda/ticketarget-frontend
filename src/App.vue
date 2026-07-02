<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'

const booking = useBookingStore()
const auth = useAuthStore()
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
        <RouterLink :to="{ name: 'my_tickets' }" class="signin">My tickets</RouterLink>
        <span class="account-name">Hi, {{ auth.user.name.split(' ')[0] }}</span>
        <button class="linklike" @click="auth.logout">Sign out</button>
      </template>
      <RouterLink v-else to="/auth" class="signin">Sign in</RouterLink>
      <RouterLink to="/checkout" class="cart">
        Cart
        <span class="cart-count" :class="{ empty: booking.selected.length === 0 }">
          {{ booking.selected.length }}
        </span>
      </RouterLink>
    </nav>
  </header>
  <main class="container">
    <RouterView />
  </main>
  <footer class="footer">
    Ticketarget — a high-availability ticketing reference build. Payments run in Stripe test mode.
  </footer>
</template>
