/**
 * Whitelabel branding: deployers override /branding.json (a plain static
 * file — volume-mount it over the one baked into the image) to rebrand the
 * whole app without rebuilding. Every value is validated per-field and
 * merged onto the stock defaults, so a broken file can never break the app.
 */

export interface BrandColors {
  accent: string
  accentSecondary: string
}

export interface BrandingConfig {
  name: string
  initial: string
  tagline: string
  colors: {
    dark: BrandColors
    light: BrandColors
  }
  style: {
    radius: 'square' | 'rounded'
    glass: boolean
  }
}

export const DEFAULT_BRANDING: BrandingConfig = {
  name: 'Ticketarget',
  initial: 'T',
  tagline: 'a high-availability ticketing reference build. Payments run in Stripe test mode.',
  colors: {
    dark: { accent: '#7c6cf6', accentSecondary: '#37d3b2' },
    light: { accent: '#6a58ee', accentSecondary: '#0d9b81' },
  },
  style: {
    radius: 'square',
    glass: true,
  },
}

const HEX = /^#[0-9a-fA-F]{6}$/

export const branding: BrandingConfig = structuredClone(DEFAULT_BRANDING)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function pickString(value: unknown, fallback: string, max = 120): string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max ? value.trim() : fallback
}

function pickHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value : fallback
}

/**
 * Per-field merge: anything invalid silently keeps the default so a typo in
 * one key never discards the rest of the brand.
 */
export function mergeBranding(raw: unknown): BrandingConfig {
  const merged = structuredClone(DEFAULT_BRANDING)
  if (!isRecord(raw)) return merged

  merged.name = pickString(raw.name, merged.name, 60)
  merged.initial = pickString(raw.initial, merged.initial, 2)
  merged.tagline = pickString(raw.tagline, merged.tagline, 200)

  if (isRecord(raw.colors)) {
    for (const theme of ['dark', 'light'] as const) {
      const c = raw.colors[theme]
      if (isRecord(c)) {
        merged.colors[theme].accent = pickHex(c.accent, merged.colors[theme].accent)
        merged.colors[theme].accentSecondary = pickHex(c.accentSecondary, merged.colors[theme].accentSecondary)
      }
    }
  }

  if (isRecord(raw.style)) {
    if (raw.style.radius === 'rounded' || raw.style.radius === 'square') merged.style.radius = raw.style.radius
    if (typeof raw.style.glass === 'boolean') merged.style.glass = raw.style.glass
  }

  return merged
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// Deployers pick arbitrary colors; we cannot block them, but we can warn
// loudly when the accent will be hard to read on the theme surfaces.
const SURFACES = { dark: '#151823', light: '#ffffff' } as const

function warnOnLowContrast(config: BrandingConfig): void {
  for (const theme of ['dark', 'light'] as const) {
    for (const [key, color] of Object.entries(config.colors[theme])) {
      const ratio = contrast(color, SURFACES[theme])
      if (ratio < 3) {
        console.warn(
          `[branding] ${theme} ${key} ${color} has ${ratio.toFixed(2)}:1 contrast against the ${theme} surface — below the 3:1 minimum. See docs/WHITELABEL.md.`,
        )
      }
    }
  }
}

export function applyBranding(config: BrandingConfig, root: HTMLElement = document.documentElement): void {
  Object.assign(branding, config)

  root.style.setProperty('--brand-accent-dark', config.colors.dark.accent)
  root.style.setProperty('--brand-accent-2-dark', config.colors.dark.accentSecondary)
  root.style.setProperty('--brand-accent-light', config.colors.light.accent)
  root.style.setProperty('--brand-accent-2-light', config.colors.light.accentSecondary)
  root.dataset.radius = config.style.radius
  root.dataset.glass = config.style.glass ? 'on' : 'off'

  document.title = config.name
  warnOnLowContrast(config)
}

export async function loadBranding(): Promise<void> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 1500)

  try {
    // no-store: a deployer swapping the mounted file must win over caches,
    // or the zero-rebuild promise silently breaks.
    const response = await fetch('/branding.json', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`branding.json ${response.status}`)
    applyBranding(mergeBranding(await response.json()))
  } catch {
    applyBranding(structuredClone(DEFAULT_BRANDING))
  } finally {
    window.clearTimeout(timer)
  }
}
