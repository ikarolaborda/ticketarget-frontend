import axios from 'axios'

// Single axios instance pointed at the Traefik gateway; every service is reached
// through the same origin, so routing/rate-limiting stays centralized.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

// Read the token lazily per request (not at import time) so login/logout is
// always reflected without re-creating the client.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ticketarget.token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
