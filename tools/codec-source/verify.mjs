import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const lockPath = resolve('tools/codec-source/lock.json'), lockBytes = await readFile(lockPath)
const lock = JSON.parse(lockBytes), directory = await mkdtemp(resolve('release/codec-source/rejection-check-'))
const python = process.argv[2] ?? 'python3.14'
try {
  for (const [index, source] of lock.sources.entries()) {
    const original = resolve('release/codec-source/downloads', source.file), target = resolve(directory, source.file)
    if (index) await symlink(original, target)
    else { const bytes = await readFile(original); bytes[0] ^= 1; await writeFile(target, bytes) }
  }
  const retrieval = spawnSync(process.execPath, ['tools/codec-source/collect.mjs', '--out=' + directory], { encoding: 'utf8' })
  assert.notEqual(retrieval.status, 0); assert.match(retrieval.stderr, /checksum mismatch/)
  const extraction = spawnSync(python, ['tools/codec-source/prepare.py', '--downloads', directory, '--work', directory + '-work'], { encoding: 'utf8' })
  assert.notEqual(extraction.status, 0); assert.match(extraction.stderr, /checksum mismatch/)
  const publicPacket = spawnSync(python, ['tools/codec-source/pack.py', '--public'], { encoding: 'utf8' })
  assert.notEqual(publicPacket.status, 0); assert.match(publicPacket.stderr, /Public packet refused/)
  assert.deepEqual(await readFile(lockPath), lockBytes)
  process.stdout.write(JSON.stringify({ checksumRetrievalRejected: true, checksumExtractionRejected: true,
    publicPacketRefused: true, lockUnchangedSha256: createHash('sha256').update(lockBytes).digest('hex') }) + '\n')
} finally { await rm(directory, { recursive: true, force: true }); await rm(directory + '-work', { recursive: true, force: true }) }
