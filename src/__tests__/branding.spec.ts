import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyBranding, branding, DEFAULT_BRANDING, loadBranding, mergeBranding } from '@/branding'

afterEach(() => {
  vi.unstubAllGlobals()
  applyBranding(structuredClone(DEFAULT_BRANDING))
})

describe('mergeBranding', () => {
  it('applies a fully valid config', () => {
    const merged = mergeBranding({
      name: 'Aurora Tickets',
      initial: 'A',
      colors: { dark: { accent: '#10b981', accentSecondary: '#f59e0b' } },
      style: { radius: 'rounded', glass: false },
    })

    expect(merged.name).toBe('Aurora Tickets')
    expect(merged.colors.dark.accent).toBe('#10b981')
    expect(merged.style).toEqual({ radius: 'rounded', glass: false })
    // untouched theme keeps stock values
    expect(merged.colors.light.accent).toBe(DEFAULT_BRANDING.colors.light.accent)
  })

  it('keeps defaults per field when values are invalid, without discarding the rest', () => {
    const merged = mergeBranding({
      name: '',
      initial: 'TOOLONG',
      colors: { dark: { accent: 'red', accentSecondary: '#12345g' }, light: { accent: '#222222' } },
      style: { radius: 'circular', glass: 'yes' },
    })

    expect(merged.name).toBe(DEFAULT_BRANDING.name)
    expect(merged.initial).toBe(DEFAULT_BRANDING.initial)
    expect(merged.colors.dark.accent).toBe(DEFAULT_BRANDING.colors.dark.accent)
    expect(merged.colors.light.accent).toBe('#222222')
    expect(merged.style).toEqual(DEFAULT_BRANDING.style)
  })

  it('returns pure defaults for non-object payloads', () => {
    expect(mergeBranding('nonsense')).toEqual(DEFAULT_BRANDING)
    expect(mergeBranding(null)).toEqual(DEFAULT_BRANDING)
  })
})

describe('applyBranding', () => {
  it('sets css variables, data attributes, title and shared state', () => {
    const config = mergeBranding({
      name: 'Aurora Tickets',
      initial: 'A',
      colors: { dark: { accent: '#10b981' } },
      style: { radius: 'rounded', glass: false },
    })

    applyBranding(config)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--brand-accent-dark')).toBe('#10b981')
    expect(root.dataset.radius).toBe('rounded')
    expect(root.dataset.glass).toBe('off')
    expect(document.title).toBe('Aurora Tickets')
    expect(branding.name).toBe('Aurora Tickets')
  })

  it('warns when a brand color has poor contrast on a theme surface', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    applyBranding(mergeBranding({ colors: { light: { accent: '#fefefe' } } }))

    expect(warn.mock.calls.some(([msg]) => String(msg).includes('contrast'))).toBe(true)
    warn.mockRestore()
  })
})

describe('loadBranding', () => {
  it('falls back to the stock brand when the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    await loadBranding()

    expect(branding.name).toBe(DEFAULT_BRANDING.name)
    expect(document.documentElement.dataset.glass).toBe('on')
  })

  it('falls back when the file is malformed json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) }),
    )

    await loadBranding()

    expect(branding.name).toBe(DEFAULT_BRANDING.name)
  })

  it('applies a mounted brand file end to end with no-store semantics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'Aurora Tickets', colors: { dark: { accent: '#10b981' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await loadBranding()

    expect(fetchMock).toHaveBeenCalledWith('/branding.json', expect.objectContaining({ cache: 'no-store' }))
    expect(branding.name).toBe('Aurora Tickets')
    expect(document.documentElement.style.getPropertyValue('--brand-accent-dark')).toBe('#10b981')
  })
})
