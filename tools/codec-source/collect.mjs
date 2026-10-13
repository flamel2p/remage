import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const directory = dirname(fileURLToPath(import.meta.url))
const lockPath = resolve(directory, 'lock.json')
const output = resolve(process.argv.find(argument => argument.startsWith('--out='))?.slice(6) ?? 'release/codec-source/downloads')
const record = process.argv.includes('--record-checksums')
const lock = JSON.parse(await readFile(lockPath, 'utf8'))
const sha = async path => { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex') }
await mkdir(output, { recursive: true })
for (const source of lock.sources) {
  if (!/^[a-z0-9-]+$/.test(source.name) || !/^[a-f0-9]{40}$/.test(source.commit)
    || source.file !== `${source.name}-${source.commit}.tar.gz`
    || !/^https:\/\/codeload\.github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/tar\.gz\/[a-f0-9]{40}$/.test(source.url)
    || !source.url.endsWith('/' + source.commit)
    || (!record && (!/^[a-f0-9]{64}$/.test(source.sha256 ?? '') || !Number.isSafeInteger(source.bytes) || source.bytes <= 0))) throw new Error(`Invalid or unsealed source lock: ${source.name}`)
}
let next = 0
async function collect() {
  while (next < lock.sources.length) {
    const source = lock.sources[next++], target = resolve(output, source.file)
    let exists = true
    try { await stat(target) } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error }
    if (!exists) {
      const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(120_000) })
      if (!response.ok || !response.body) throw new Error(`Source retrieval failed for ${source.name}: HTTP ${response.status}`)
      const partial = target + '.partial-' + randomUUID()
      let bytes = 0
      try {
        await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _encoding, callback) {
          bytes += chunk.length
          callback(bytes > 200 * 1024 * 1024 ? new Error(`Source archive too large: ${source.name}`) : null, chunk)
        } }), createWriteStream(partial, { flags: 'wx' }))
        await rename(partial, target)
      } catch (error) { await rm(partial, { force: true }); throw error }
    }
    const hash = await sha(target), bytes = (await stat(target)).size
    if (source.sha256 && (source.sha256 !== hash || source.bytes !== bytes)) throw new Error(`Source checksum mismatch for ${source.name}; retain the lock and investigate the downloaded file.`)
    if (record) { source.sha256 = hash; source.bytes = bytes }
    process.stdout.write(JSON.stringify({ name: source.name, commit: source.commit, bytes, sha256: hash, reused: exists }) + '\n')
  }
}
const outcomes = await Promise.allSettled(Array.from({ length: 4 }, collect))
const failed = outcomes.find(outcome => outcome.status === 'rejected')
if (failed) throw failed.reason
if (record) await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n')
await writeFile(resolve(output, 'retrieval.json'), JSON.stringify({ schema: 1, sources: lock.sources.map(({ name, repository, commit, tag, url, file, sha256, bytes }) => ({ name, repository, commit, tag, url, file, sha256, bytes })) }, null, 2) + '\n')
