import { createHash } from 'node:crypto'
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = new URL('..', import.meta.url).pathname
const destination = join(root, 'resources', 'codecs', 'darwin')
const temporary = await mkdtemp(join(tmpdir(), 'remage-codecs-'))

const sources = {
  oxipngArm64: {
    url: 'https://github.com/oxipng/oxipng/releases/download/v10.2.1/oxipng-10.2.1-aarch64-apple-darwin.tar.gz',
    sha256: '7039fcfc78e8aa1ed2b57d848057a0296f082e92b3e1807ac65402d10d926764'
  },
  oxipngX64: {
    url: 'https://github.com/oxipng/oxipng/releases/download/v10.2.1/oxipng-10.2.1-x86_64-apple-darwin.tar.gz',
    sha256: '111883bbe42b25e01cb1ca41f39f8094e4830b173f0e42be342ecc4ca48f3131'
  },
  jpeg: {
    url: 'https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.dmg',
    sha256: 'e69c4a3bb6bf8d6cc4f329ac9c8cf36c033d69e8f6b02e45cc324cf697ddfe1f'
  }
}

async function download(name, source) {
  const response = await fetch(source.url)
  if (!response.ok) throw new Error(`Could not download ${name}: ${response.status} ${response.statusText}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== source.sha256) throw new Error(`${name} did not match its pinned SHA-256 checksum.`)
  const file = join(temporary, basename(new URL(source.url).pathname))
  await writeFile(file, bytes, { mode: 0o644 })
  return file
}

async function findFile(directory, name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isFile() && entry.name === name) return path
    if (entry.isDirectory()) {
      const found = await findFile(path, name)
      if (found) return found
    }
  }
  return null
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = join(prefix, entry.name)
    if (entry.isFile()) files.push(relative)
    if (entry.isDirectory()) files.push(...(await listFiles(join(directory, entry.name), relative)))
  }
  return files
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('Remage codec packaging must run on macOS.')
  await rm(destination, { recursive: true, force: true })
  await mkdir(join(destination, 'bin'), { recursive: true })
  await mkdir(join(destination, 'lib'), { recursive: true })

  const [oxipngArm64Archive, oxipngX64Archive, jpegDmg] = await Promise.all([
    download('OxiPNG arm64', sources.oxipngArm64),
    download('OxiPNG x64', sources.oxipngX64),
    download('libjpeg-turbo', sources.jpeg)
  ])
  const oxipngArm64Directory = join(temporary, 'oxipng-arm64')
  const oxipngX64Directory = join(temporary, 'oxipng-x64')
  await Promise.all([mkdir(oxipngArm64Directory), mkdir(oxipngX64Directory)])
  await Promise.all([
    execFileAsync('tar', ['-xzf', oxipngArm64Archive, '-C', oxipngArm64Directory]),
    execFileAsync('tar', ['-xzf', oxipngX64Archive, '-C', oxipngX64Directory])
  ])
  const [oxipngArm64, oxipngX64] = await Promise.all([findFile(oxipngArm64Directory, 'oxipng'), findFile(oxipngX64Directory, 'oxipng')])
  if (!oxipngArm64 || !oxipngX64) throw new Error('An OxiPNG archive did not contain its binary.')
  await execFileAsync('lipo', ['-create', oxipngArm64, oxipngX64, '-output', join(destination, 'bin', 'oxipng')])
  await chmod(join(destination, 'bin', 'oxipng'), 0o755)

  let mountPoint = ''
  try {
    const attachment = await execFileAsync('hdiutil', ['attach', '-nobrowse', '-readonly', jpegDmg])
    mountPoint = attachment.stdout.trim().split('\n').map((line) => line.trim().split(/\s{2,}/).at(-1) ?? '').find((path) => path.startsWith('/Volumes/')) ?? ''
    if (!mountPoint) throw new Error('Could not find the mounted libjpeg-turbo volume.')
    const packageFile = await findFile(mountPoint, 'libjpeg-turbo.pkg')
    if (!packageFile) throw new Error('The libjpeg-turbo disk image did not contain its package payload.')
    const packageDirectory = join(temporary, 'libjpeg-package')
    const payloadDirectory = join(temporary, 'libjpeg-payload')
    await execFileAsync('pkgutil', ['--expand', packageFile, packageDirectory])
    const payload = await findFile(packageDirectory, 'Payload')
    if (!payload) throw new Error('The libjpeg-turbo package did not contain a payload archive.')
    await mkdir(payloadDirectory)
    await execFileAsync('tar', ['-xf', payload, '-C', payloadDirectory])
    const jpegtran = await findFile(payloadDirectory, 'jpegtran')
    const jpegLibrary = await findFile(payloadDirectory, 'libjpeg.62.4.0.dylib')
    if (!jpegtran || !jpegLibrary) {
      throw new Error(`The libjpeg-turbo package did not contain the expected universal binaries. Found: ${(await listFiles(payloadDirectory)).join(', ')}`)
    }
    await copyFile(jpegtran, join(destination, 'bin', 'jpegtran'))
    await copyFile(jpegLibrary, join(destination, 'lib', 'libjpeg.62.dylib'))
    await chmod(join(destination, 'bin', 'jpegtran'), 0o755)
  } finally {
    if (mountPoint) await execFileAsync('hdiutil', ['detach', mountPoint]).catch(() => undefined)
  }

  await execFileAsync('install_name_tool', ['-rpath', '/opt/libjpeg-turbo/lib', '@executable_path/../lib', join(destination, 'bin', 'jpegtran')])
  const jpegtran = join(destination, 'bin', 'jpegtran')
  await execFileAsync('codesign', ['--force', '--sign', '-', join(destination, 'lib', 'libjpeg.62.dylib')])
  await execFileAsync('codesign', ['--force', '--sign', '-', jpegtran])
  await execFileAsync('codesign', ['--force', '--sign', '-', join(destination, 'bin', 'oxipng')])
  await execFileAsync(jpegtran, ['-version'])
  await execFileAsync(join(destination, 'bin', 'oxipng'), ['--version'])
  await stat(join(destination, 'lib', 'libjpeg.62.dylib'))
  console.log('Fetched and verified macOS image codecs.')
}

try {
  await main()
} finally {
  await rm(temporary, { recursive: true, force: true })
}
