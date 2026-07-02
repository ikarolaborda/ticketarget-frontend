<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useBookingStore } from '@/stores/booking'

const booking = useBookingStore()
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">
      <span class="brand-mark" aria-hidden="true">T</span>
      Ticketarget
    </RouterLink>
    <RouterLink to="/checkout" class="cart">
      Cart
      <span class="cart-count" :class="{ empty: booking.selected.length === 0 }">
        {{ booking.selected.length }}
      </span>
    </RouterLink>
  </header>
  <main class="container">
    <RouterView />
  </main>
  <footer class="footer">
    Ticketarget — a high-availability ticketing reference build. Payments run in Stripe test mode.
  </footer>
</template>
