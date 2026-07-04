import type { ZoneGeometry } from '@/types'

export const CANVAS_W = 100
export const CANVAS_H = 70

/**
 * Keeps a zone inside the normalized canvas while dragging; size is
 * preserved, position clamps.
 */
export function clampGeometry(geometry: ZoneGeometry): ZoneGeometry {
  const w = Math.min(Math.max(geometry.w, 2), CANVAS_W)
  const h = Math.min(Math.max(geometry.h, 2), CANVAS_H)
  return {
    type: 'rect',
    w,
    h,
    x: Math.min(Math.max(geometry.x, 0), CANVAS_W - w),
    y: Math.min(Math.max(geometry.y, 0), CANVAS_H - h),
  }
}
