import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('renderer assets', () => {
  it('uses the supplied local Atkinson and Lilex font files', async () => {
    const stylesheet = await readFile(resolve(import.meta.dirname, 'styles.css'), 'utf8')
    expect(stylesheet).toContain('atkinson-hyperlegible-next.woff2')
    expect(stylesheet).toContain('lilex.woff2')
    await access(resolve(import.meta.dirname, '../../../assets/fonts/atkinson-hyperlegible-next.woff2'))
    await access(resolve(import.meta.dirname, '../../../assets/fonts/lilex.woff2'))
  })
})
