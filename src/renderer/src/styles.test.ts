import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('renderer assets', () => {
  it('uses the supplied local Atkinson and Lilex font files', async () => {
    const stylesheet = await readFile(resolve(import.meta.dirname, 'styles.css'), 'utf8')
    expect(stylesheet).toContain("@import '../../../assets/design/fonts.css'")
    expect(stylesheet).toContain("@import '../../../assets/design/reui-theme.css'")
    const fontDirectory = resolve(import.meta.dirname, '../../../assets/design')
    const declarations = await readFile(resolve(fontDirectory, 'fonts.css'), 'utf8')
    const urls = [...declarations.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1])
    expect(urls).toHaveLength(4)
    for (const url of urls) { expect(url).not.toMatch(/^https?:/); await access(resolve(fontDirectory, url)) }
  })
})
