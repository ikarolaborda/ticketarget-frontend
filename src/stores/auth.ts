import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import { tokenIsAdmin } from '@/lib/jwt'

export interface AccountUser {
  id: string
  name: string
  email: string
  is_admin: boolean
}

interface AuthResponse {
  token: string
  user: AccountUser
}

const TOKEN_KEY = 'ticketarget.token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<AccountUser | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  // Before /auth/me hydration lands, fall back to the persisted token's claim
  // so the admin nav/routes don't flash. UX only — the server is the gate.
  const isAdmin = computed(() =>
    user.value !== null ? user.value.is_admin === true : tokenIsAdmin(token.value),
  )

  function storeSession(data: AuthResponse): void {
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
  }

  async function register(name: string, email: string, password: string): Promise<boolean> {
    return attempt(() => api.post<AuthResponse>('/auth/register', { name, email, password }))
  }

  async function login(email: string, password: string): Promise<boolean> {
    return attempt(() => api.post<AuthResponse>('/auth/login', { email, password }))
  }

  async function attempt(call: () => Promise<{ data: AuthResponse }>): Promise<boolean> {
    error.value = null
    loading.value = true
    try {
      storeSession((await call()).data)
      return true
    } catch (e) {
      error.value = extractMessage(e)
      return false
    } finally {
      loading.value = false
    }
  }

  // Rehydrate the session on app start; a stale/expired token just logs out.
  async function restore(): Promise<void> {
    if (!token.value) return
    try {
      const { data } = await api.get<{ user: AccountUser }>('/auth/me')
      user.value = data.user
    } catch {
      logout()
    }
  }

  async function updateProfile(name: string, email: string): Promise<boolean> {
    error.value = null
    try {
      const { data } = await api.put<{ token?: string; user: AccountUser }>('/auth/profile', {
        name,
        email,
      })
      user.value = data.user
      // A claim change comes with a fresh token; a no-op does not.
      if (data.token) {
        token.value = data.token
        localStorage.setItem(TOKEN_KEY, data.token)
      }
      return true
    } catch (e) {
      error.value = extractMessage(e)
      return false
    }
  }

  async function updatePassword(currentPassword: string, password: string): Promise<boolean> {
    error.value = null
    try {
      await api.put('/auth/password', { current_password: currentPassword, password })
      return true
    } catch (e) {
      error.value = extractMessage(e)
      return false
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, user, error, loading, isAuthenticated, isAdmin, register, login, restore, logout, updateProfile, updatePassword }
})

function extractMessage(e: unknown): string {
  const response = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
    .response
  const firstValidation = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : null
  return firstValidation ?? response?.data?.message ?? 'Something went wrong. Please try again.'
}
