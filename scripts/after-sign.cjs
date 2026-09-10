const { access } = require('node:fs/promises')
const { join } = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const codecs = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'codecs', 'darwin')
  const files = [join(codecs, 'lib', 'libjpeg.62.dylib'), join(codecs, 'bin', 'jpegtran'), join(codecs, 'bin', 'oxipng')]
  for (const file of files) {
    await access(file)
    await execFileAsync('codesign', ['--force', '--sign', '-', file])
  }
}
