export class Downloads {
  private readonly urls = new Map<string, { timer: ReturnType<typeof setTimeout>; bytes: number }>()
  get retainedBytes(): number { return [...this.urls.values()].reduce((sum, url) => sum + url.bytes, 0) }

  request(bytes: Uint8Array<ArrayBuffer>, type: string, name: string): void {
    const url = URL.createObjectURL(new Blob([bytes], { type }))
    const anchor = document.createElement('a')
    try {
      anchor.href = url; anchor.download = name; anchor.hidden = true
      document.body.append(anchor)
      anchor.click()
      this.urls.set(url, { timer: setTimeout(() => this.release(url), 60_000), bytes: bytes.length })
    } catch (error) { URL.revokeObjectURL(url); throw error }
    finally { anchor.remove() }
  }

  private release(url: string): void {
    clearTimeout(this.urls.get(url)?.timer); this.urls.delete(url); URL.revokeObjectURL(url)
  }

  dispose(): void { for (const url of this.urls.keys()) this.release(url) }
}
