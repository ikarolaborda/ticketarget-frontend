import axios from 'axios'

// Single axios instance pointed at the Traefik gateway; every service is reached
// through the same origin, so routing/rate-limiting stays centralized.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})
