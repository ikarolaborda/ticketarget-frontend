import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'

export interface AccountUser {
  id: string
  name: string
  email: string
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

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, user, error, loading, isAuthenticated, register, login, restore, logout }
})

function extractMessage(e: unknown): string {
  const response = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
    .response
  const firstValidation = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : null
  return firstValidation ?? response?.data?.message ?? 'Something went wrong. Please try again.'
}
