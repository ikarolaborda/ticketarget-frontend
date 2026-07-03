import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { usePoll } from '../usePoll'

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true })
}

function harness(fn: () => Promise<void>, intervalMs: number) {
  let api!: ReturnType<typeof usePoll>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = usePoll(fn, intervalMs)
        return () => null
      },
    }),
  )
  return { wrapper, api }
}

describe('usePoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    setHidden(false)
  })

  it('fetches immediately on mount even when the tab is hidden', async () => {
    setHidden(true)
    const fn = vi.fn().mockResolvedValue(undefined)

    const { wrapper } = harness(fn, 10_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(fn).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('pauses interval polling while hidden after the first successful load', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)

    const { wrapper } = harness(fn, 10_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    setHidden(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fn).toHaveBeenCalledTimes(1)

    setHidden(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fn).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('refreshes immediately when the tab becomes visible again', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)

    const { wrapper } = harness(fn, 10_000)
    await vi.advanceTimersByTimeAsync(0)
    setHidden(true)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fn).toHaveBeenCalledTimes(1)

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fn).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('never stacks overlapping requests when a poll is slow', async () => {
    let release!: () => void
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    const { wrapper } = harness(fn, 1_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(fn).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fn).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('counts consecutive failures and resets on success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined)

    const { wrapper, api } = harness(fn, 1_000)
    await vi.advanceTimersByTimeAsync(0)
    expect(api.failures.value).toBe(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.failures.value).toBe(2)
    expect(api.lastUpdated.value).toBeNull()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(api.failures.value).toBe(0)
    expect(api.lastUpdated.value).not.toBeNull()
    wrapper.unmount()
  })

  it('stops polling after unmount', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)

    const { wrapper } = harness(fn, 1_000)
    await vi.advanceTimersByTimeAsync(0)
    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
