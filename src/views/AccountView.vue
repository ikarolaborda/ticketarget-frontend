<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const name = ref('')
const email = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const profileSaved = ref(false)
const passwordSaved = ref(false)

onMounted(async () => {
  if (!auth.token) {
    await router.replace({ name: 'auth' })
    return
  }
  if (!auth.user) await auth.restore()
  name.value = auth.user?.name ?? ''
  email.value = auth.user?.email ?? ''
})

async function saveProfile(): Promise<void> {
  profileSaved.value = false
  if (await auth.updateProfile(name.value, email.value)) profileSaved.value = true
}

async function savePassword(): Promise<void> {
  passwordSaved.value = false
  if (await auth.updatePassword(currentPassword.value, newPassword.value)) {
    passwordSaved.value = true
    currentPassword.value = ''
    newPassword.value = ''
  }
}
</script>

<template>
  <section class="checkout-wrap">
    <h1>Your account</h1>

    <div class="panel" style="position: static; margin-bottom: 1.5rem">
      <h3>Profile</h3>
      <form class="form" @submit.prevent="saveProfile">
        <label>
          Name
          <input v-model="name" type="text" required autocomplete="name" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" required autocomplete="email" />
        </label>
        <button class="btn-block" type="submit">Save profile</button>
        <p v-if="profileSaved" class="success" style="margin: 0">Profile updated.</p>
      </form>
    </div>

    <div class="panel" style="position: static">
      <h3>Change password</h3>
      <form class="form" @submit.prevent="savePassword">
        <label>
          Current password
          <input v-model="currentPassword" type="password" required autocomplete="current-password" />
        </label>
        <label>
          New password
          <input v-model="newPassword" type="password" required minlength="8" autocomplete="new-password" />
        </label>
        <button class="btn-block" type="submit">Change password</button>
        <p v-if="passwordSaved" class="success" style="margin: 0">Password changed.</p>
      </form>
    </div>

    <p v-if="auth.error" class="error">{{ auth.error }}</p>
  </section>
</template>
