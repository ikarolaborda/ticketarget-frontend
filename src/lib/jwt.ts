// Client-side claim peek for UX gating only — the server re-verifies every
// admin call. Never treat this as an authorization decision.
export function tokenIsAdmin(token: string | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const claims = JSON.parse(atob(padded)) as { is_admin?: unknown }
    return claims.is_admin === true
  } catch {
    return false
  }
}
