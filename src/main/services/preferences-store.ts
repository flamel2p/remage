import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { PreferencesSchema, type Preferences } from '../../shared/contracts'

export class PreferencesStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<Preferences> {
    try {
      return PreferencesSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      return PreferencesSchema.parse({})
    }
  }

  async write(preferences: Preferences): Promise<void> {
    const safePreferences = PreferencesSchema.parse(preferences)
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(safePreferences, null, 2), { encoding: 'utf8', mode: 0o600 })
  }
}
