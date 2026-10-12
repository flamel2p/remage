import { afterEach, describe, expect, it, vi } from 'vitest'
import { Downloads } from './downloads'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('browser download resource ownership', () => {
  it('counts every pending Blob, requests one anchor action, releases after grace or disposal', () => {
    vi.useFakeTimers()
    const click = vi.fn(), remove = vi.fn(), append = vi.fn()
    vi.stubGlobal('document', { createElement: () => ({ click, remove, href: '', download: '', hidden: false }), body: { append } })
    let number = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++number}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const downloads = new Downloads(), bytes = new Uint8Array(128)
    downloads.request(bytes, 'image/png', 'first.png'); downloads.request(bytes, 'image/png', 'second.png')
    expect(downloads.retainedBytes).toBe(256); expect(click).toHaveBeenCalledTimes(2); expect(remove).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob)
    vi.advanceTimersByTime(60_000)
    expect(downloads.retainedBytes).toBe(0); expect(revoke).toHaveBeenCalledTimes(2)
    downloads.request(bytes, 'image/png', 'third.png'); downloads.dispose()
    expect(downloads.retainedBytes).toBe(0); expect(revoke).toHaveBeenCalledTimes(3)
  })
  it('releases a failed download URL without claiming retained bytes', () => {
    vi.stubGlobal('document', { createElement: () => ({ click: () => { throw new Error('blocked') }, remove: vi.fn() }), body: { append: vi.fn() } })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const downloads = new Downloads()
    expect(() => downloads.request(new Uint8Array(20), 'image/png', 'image.png')).toThrow(/blocked/)
    expect(downloads.retainedBytes).toBe(0); expect(revoke).toHaveBeenCalledWith('blob:failed')
  })
})
