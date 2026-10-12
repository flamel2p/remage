import { admitArchive } from './budgets'
import { crc32Update } from './crc32'

export type ZipEntry = { name: string; bytes: Uint8Array }
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

export async function createStoreZip(entries: readonly ZipEntry[], retainedBytes: number, progress: (completed: number, total: number) => void = () => {}, yieldWork: () => Promise<void> = tick): Promise<Uint8Array<ArrayBuffer>> {
  const names = entries.map((entry) => new TextEncoder().encode(entry.name))
  const seen = new Set<string>()
  entries.forEach((entry, index) => {
    if (!entry.name || /[/\\\u0000-\u001f]/.test(entry.name) || entry.name === '.' || entry.name === '..' || names[index].length > 65535 || seen.has(entry.name.toLocaleLowerCase('en-US'))) throw new Error('ZIP entry names must be distinct safe basenames.')
    seen.add(entry.name.toLocaleLowerCase('en-US'))
  })
  const size = admitArchive(retainedBytes, entries.map((entry) => ({ name: entry.name, bytes: entry.bytes.length })))
  const output = new Uint8Array(size), view = new DataView(output.buffer)
  const records: { offset: number; crc: number }[] = []
  let cursor = 0
  const u16 = (offset: number, value: number): void => view.setUint16(offset, value, true)
  const u32 = (offset: number, value: number): void => view.setUint32(offset, value, true)
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index], name = names[index], offset = cursor
    u32(cursor, 0x04034b50); u16(cursor + 4, 20); u16(cursor + 6, 0x800)
    u16(cursor + 12, 33); u32(cursor + 18, entry.bytes.length); u32(cursor + 22, entry.bytes.length); u16(cursor + 26, name.length)
    output.set(name, cursor + 30); cursor += 30 + name.length
    let crc = 0xffffffff
    for (let from = 0; from < entry.bytes.length; from += 256 * 1024) {
      const chunk = entry.bytes.subarray(from, from + 256 * 1024)
      output.set(chunk, cursor); cursor += chunk.length; crc = crc32Update(crc, chunk)
      await yieldWork()
    }
    crc = (crc ^ 0xffffffff) >>> 0; u32(offset + 14, crc)
    records.push({ offset, crc }); progress(index + 1, entries.length)
    await yieldWork()
  }
  const directory = cursor
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index], name = names[index], record = records[index]
    u32(cursor, 0x02014b50); u16(cursor + 4, 20); u16(cursor + 6, 20); u16(cursor + 8, 0x800)
    u16(cursor + 14, 33); u32(cursor + 16, record.crc); u32(cursor + 20, entry.bytes.length); u32(cursor + 24, entry.bytes.length)
    u16(cursor + 28, name.length); u32(cursor + 42, record.offset)
    output.set(name, cursor + 46); cursor += 46 + name.length
  }
  u32(cursor, 0x06054b50); u16(cursor + 8, entries.length); u16(cursor + 10, entries.length)
  u32(cursor + 12, cursor - directory); u32(cursor + 16, directory)
  if (cursor + 22 !== size) throw new Error('ZIP size did not match its reservation.')
  return output
}

export async function validateStoreZip(bytes: Uint8Array, entries: readonly ZipEntry[], yieldWork: () => Promise<void> = tick, cancelled: () => boolean = () => false): Promise<void> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), records: { offset: number; crc: number }[] = []
  const bad = (): never => { throw new Error('The ZIP failed entry, checksum or byte validation. Retry preparation; original results remain available.') }
  const checkCancelled = (): void => { if (cancelled()) throw new Error('ZIP validation cancelled. Original results remain available.') }
  const u16 = (offset: number): number => { if (offset + 2 > bytes.length) return bad(); return view.getUint16(offset, true) }
  const u32 = (offset: number): number => { if (offset + 4 > bytes.length) return bad(); return view.getUint32(offset, true) }
  const names = entries.map((entry) => new TextEncoder().encode(entry.name))
  const equal = (offset: number, expected: Uint8Array): void => { if (offset + expected.length > bytes.length) return bad(); for (let index = 0; index < expected.length; index++) if (bytes[offset + index] !== expected[index]) return bad() }
  let cursor = 0
  for (let index = 0; index < entries.length; index++) {
    checkCancelled()
    const entry = entries[index], name = names[index], offset = cursor
    if (u32(cursor) !== 0x04034b50 || u16(cursor + 4) !== 20 || u16(cursor + 6) !== 0x800 || u16(cursor + 8) !== 0 || u32(cursor + 18) !== entry.bytes.length || u32(cursor + 22) !== entry.bytes.length || u16(cursor + 26) !== name.length || u16(cursor + 28) !== 0) return bad()
    const crc = u32(cursor + 14); equal(cursor + 30, name); cursor += 30 + name.length
    let checksum = 0xffffffff
    for (let from = 0; from < entry.bytes.length; from += 256 * 1024) {
      checkCancelled()
      const expected = entry.bytes.subarray(from, from + 256 * 1024)
      equal(cursor, expected); checksum = crc32Update(checksum, bytes.subarray(cursor, cursor + expected.length)); cursor += expected.length
      await yieldWork()
      checkCancelled()
    }
    if (((checksum ^ 0xffffffff) >>> 0) !== crc) return bad()
    records.push({ offset, crc })
  }
  const directory = cursor
  for (let index = 0; index < entries.length; index++) {
    checkCancelled()
    const entry = entries[index], name = names[index], record = records[index]
    if (u32(cursor) !== 0x02014b50 || u16(cursor + 6) !== 20 || u16(cursor + 8) !== 0x800 || u16(cursor + 10) !== 0 || u32(cursor + 16) !== record.crc || u32(cursor + 20) !== entry.bytes.length || u32(cursor + 24) !== entry.bytes.length || u16(cursor + 28) !== name.length || u16(cursor + 30) !== 0 || u16(cursor + 32) !== 0 || u32(cursor + 42) !== record.offset) return bad()
    equal(cursor + 46, name); cursor += 46 + name.length
  }
  if (cursor + 22 !== bytes.length || u32(cursor) !== 0x06054b50 || u16(cursor + 4) !== 0 || u16(cursor + 6) !== 0 || u16(cursor + 8) !== entries.length || u16(cursor + 10) !== entries.length || u32(cursor + 12) !== cursor - directory || u32(cursor + 16) !== directory || u16(cursor + 20) !== 0) return bad()
}
