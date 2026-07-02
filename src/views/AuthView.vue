<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')

async function submit(): Promise<void> {
  const ok =
    mode.value === 'login'
      ? await auth.login(email.value, password.value)
      : await auth.register(name.value, email.value, password.value)
  if (ok) await router.push({ name: 'browse' })
}
</script>

<template>
  <section class="checkout-wrap">
    <h1>{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h1>

    <div class="panel" style="position: static">
      <div class="tab-row" role="tablist">
        <button
          class="tab"
          :class="{ active: mode === 'login' }"
          role="tab"
          :aria-selected="mode === 'login'"
          @click="mode = 'login'"
        >
          Sign in
        </button>
        <button
          class="tab"
          :class="{ active: mode === 'register' }"
          role="tab"
          :aria-selected="mode === 'register'"
          @click="mode = 'register'"
        >
          Register
        </button>
      </div>

      <form class="form" @submit.prevent="submit">
        <label v-if="mode === 'register'">
          Name
          <input v-model="name" type="text" required autocomplete="name" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" required autocomplete="email" />
        </label>
        <label>
          Password
          <input
            v-model="password"
            type="password"
            required
            minlength="8"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          />
        </label>

        <button class="btn-block" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner" aria-hidden="true"></span>
          {{ mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <p v-if="auth.error" class="error">{{ auth.error }}</p>
      <p class="muted" style="margin-top: 1rem; font-size: 0.85rem">
        No account needed to buy — guests just leave an email at checkout.
      </p>
    </div>
  </section>
</template>
