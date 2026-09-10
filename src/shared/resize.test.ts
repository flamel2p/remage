import { describe, expect, it } from 'vitest'
import { planResize } from './resize'

describe('planResize', () => {
  it('uses orientation-aware source dimensions and keeps aspect ratio by default', () => {
    expect(planResize({ width: 4000, height: 2000 }, { enabled: true, width: 1000, height: null, lockAspectRatio: true, allowEnlargement: false })).toMatchObject({ width: 1000, height: 500, isTransformation: true })
  })

  it('does not enlarge when no-enlargement is selected', () => {
    expect(planResize({ width: 400, height: 200 }, { enabled: true, width: 1200, height: null, lockAspectRatio: true, allowEnlargement: false })).toMatchObject({ width: 400, height: 200, isTransformation: false })
  })

  it('uses exact dimensions when aspect lock is disabled', () => {
    expect(planResize({ width: 400, height: 400 }, { enabled: true, width: 300, height: 300, lockAspectRatio: false, allowEnlargement: false })).toMatchObject({ width: 300, height: 300 })
  })
})
