import type { ImageFormat } from '../shared/contracts'

const utf8 = new TextEncoder()
export const mimeFor = (format: ImageFormat): string => format === 'jpeg' ? 'image/jpeg' : `image/${format}`

export function resultName(source: string, format: ImageFormat): string {
  let stem = source.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\:*?"<>|]/g, '_')
    .replace(/\.[^.]*$/, '').replace(/^[.\s]+|[.\s]+$/g, '')
  if (!stem) stem = 'image'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `_${stem}`
  while (utf8.encode(stem).length > 160) stem = Array.from(stem).slice(0, -1).join('')
  return `${stem}.${format === 'jpeg' ? 'jpg' : format}`
}

export function uniqueNames(items: readonly { sourceName: string; resultFormat: ImageFormat }[]): string[] {
  const used = new Set<string>()
  return items.map((item) => {
    const base = resultName(item.sourceName, item.resultFormat), dot = base.lastIndexOf('.')
    let name = base, suffix = 2
    while (used.has(name.toLocaleLowerCase('en-US'))) name = `${base.slice(0, dot)} (${suffix++})${base.slice(dot)}`
    used.add(name.toLocaleLowerCase('en-US'))
    return name
  })
}
