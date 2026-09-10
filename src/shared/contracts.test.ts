import { describe, expect, it } from 'vitest'
import { OperationSettingsSchema, ResizeSettingsSchema, defaultSettings } from './contracts'

describe('operation settings', () => {
  it('requires an output format for conversion', () => {
    const result = OperationSettingsSchema.safeParse({ ...defaultSettings, mode: 'converter', outputFormat: null })
    expect(result.success).toBe(false)
  })

  it('requires a resize bound and exact dimensions when aspect lock is disabled', () => {
    expect(ResizeSettingsSchema.safeParse({ enabled: true, width: null, height: null, lockAspectRatio: true }).success).toBe(true)
    expect(OperationSettingsSchema.safeParse({ ...defaultSettings, resize: { enabled: true, width: null, height: null, lockAspectRatio: true, allowEnlargement: false } }).success).toBe(false)
    expect(OperationSettingsSchema.safeParse({ ...defaultSettings, resize: { enabled: true, width: 400, height: null, lockAspectRatio: false, allowEnlargement: false } }).success).toBe(false)
  })
})
