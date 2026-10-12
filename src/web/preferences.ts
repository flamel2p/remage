import { z } from 'zod'
import { defaultSettings, OperationSettingsSchema, type Preferences } from '../shared/contracts'

const { outputDirectory: _destination, ...settingsShape } = OperationSettingsSchema.shape
void _destination
const schema = z.object({ appearance: z.enum(['system', 'light', 'dark']).optional(), mode: OperationSettingsSchema.shape.mode, settings: z.object(settingsShape) })
export const preferencesKey = 'remage.web.settings.v1'
export const browserDefaults: Preferences = {
  appearance: 'system', mode: 'converter', settings: { ...defaultSettings, resize: { ...defaultSettings.resize }, mode: 'converter' }
}

export function validatePreferences(value: unknown): Preferences {
  const parsed = schema.parse(value)
  return { appearance: parsed.appearance ?? 'system', mode: parsed.settings.mode, settings: { ...parsed.settings, outputDirectory: null } }
}

export function readPreferences(storage: Pick<Storage, 'getItem'> | null): Preferences {
  try {
    const stored = storage?.getItem(preferencesKey)
    if (stored) return validatePreferences(JSON.parse(stored))
  } catch { /* Invalid or inaccessible storage never restores session data. */ }
  return structuredClone(browserDefaults)
}

export function writePreferences(storage: Pick<Storage, 'setItem'> | null, value: Preferences): Preferences {
  const validated = validatePreferences(value)
  const { outputDirectory: _directory, ...settings } = validated.settings
  void _directory
  storage?.setItem(preferencesKey, JSON.stringify({ appearance: validated.appearance, mode: validated.mode, settings }))
  return validated
}
