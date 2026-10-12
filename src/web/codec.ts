import {
  AlphaAction, ColorType, ImageMagick, MagickColor, MagickColors, MagickFormat, MagickGeometry,
  MagickReadSettings, ResourceLimits, type IMagickImage, type Orientation
} from '@imagemagick/magick-wasm'
import { OperationSettingsSchema, type ImageFormat, type OperationSettings } from '../shared/contracts'
import { browserLimits, admitImage } from './budgets'
import { inspectImage } from './inspect'
import { decoderInput } from './sanitize'

const formats = { png: MagickFormat.Png, jpeg: MagickFormat.Jpeg, webp: MagickFormat.WebP }
export const webpEncoder = Object.freeze({ quality: 100, lossless: true, exact: true, alphaQuality: 100, threadLevel: 0, method: 5 })
export type TransformOutput = { bytes: Uint8Array<ArrayBuffer>; thumbnail: Uint8Array<ArrayBuffer>; width: number; height: number; format: ImageFormat }

export function constrainCodec(): void {
  ResourceLimits.disk = 0n
  ResourceLimits.memory = 128n * 1024n * 1024n
  ResourceLimits.maxMemoryRequest = 128n * 1024n * 1024n
  ResourceLimits.maxProfileSize = 64n * 1024n
  ResourceLimits.width = BigInt(browserLimits.dimension)
  ResourceLimits.height = BigInt(browserLimits.dimension)
  ResourceLimits.area = BigInt(browserLimits.pixels)
  ResourceLimits.listLength = 4n
  ResourceLimits.time = BigInt(Math.ceil(browserLimits.imageTimeoutMs / 1000))
}

function encode(image: IMagickImage, format: ImageFormat, maxBytes = browserLimits.resultBytes): Uint8Array<ArrayBuffer> {
  image.depth = 8
  image.orientation = 0 // Pixels have already been normalized; no orientation tag is needed.
  if (format === 'png') {
    image.colorType = image.hasAlpha ? ColorType.TrueColorAlpha : ColorType.TrueColor
    image.settings.setDefine(MagickFormat.Png, 'color-type', image.hasAlpha ? 6 : 2)
    image.settings.setDefine(MagickFormat.Png, 'bit-depth', 8)
    image.settings.setDefine(MagickFormat.Png, 'exclude-chunks', 'date,time,bKGD,pHYs,tEXt,zTXt,iTXt,eXIf,orNT')
  } else if (format === 'webp') {
    image.quality = webpEncoder.quality
    image.settings.setDefine(MagickFormat.WebP, 'lossless', webpEncoder.lossless)
    image.settings.setDefine(MagickFormat.WebP, 'exact', webpEncoder.exact)
    image.settings.setDefine(MagickFormat.WebP, 'alpha-quality', webpEncoder.alphaQuality)
    image.settings.setDefine(MagickFormat.WebP, 'thread-level', webpEncoder.threadLevel)
    image.settings.setDefine(MagickFormat.WebP, 'method', webpEncoder.method)
  } else image.quality = 90
  return image.write(formats[format], (borrowed) => {
    if (borrowed.length > maxBytes) throw new Error('This encoded result exceeds the remaining result-byte budget. Download and clear retained results, then retry.')
    return borrowed.slice()
  })
}

export function transformImage(bytes: Uint8Array, rawSettings: OperationSettings, retainedBytes: number, preview = false, maxOutputBytes = browserLimits.resultBytes): TransformOutput {
  const settings = preview ? rawSettings : OperationSettingsSchema.parse(rawSettings)
  const header = inspectImage(bytes)
  if (!preview && settings.mode === 'optimizer' && !settings.resize.enabled) throw new Error('Strict browser optimization is unavailable: no PNG/JPEG/WebP preservation adapter has passed verification. Choose Converter or enable resize.')
  const outputFormat = preview ? 'png' : settings.mode === 'converter' ? settings.outputFormat! : header.metadata.format
  if (!preview && outputFormat === 'jpeg' && !settings.jpegLossAcknowledged) throw new Error('Acknowledge JPEG re-encoding before continuing.')
  const output = admitImage(header, settings, retainedBytes, bytes.length)
  const input = decoderInput(bytes, header, preview || !settings.preserveMetadata)
  return ImageMagick.read(MagickColors.Transparent, 1, 1, (image) => {
    image.onWarning = (warning) => { throw new Error(`The image could not be processed without a codec warning: ${warning.error.message}. Select an intact source or use the desktop edition.`) }
    image.read(input, new MagickReadSettings({ format: formats[header.metadata.format], frameCount: 1 }))
    if (image.width !== header.encodedWidth || image.height !== header.encodedHeight) throw new Error('Decoded dimensions disagree with the inspected header.')
    if (header.metadata.orientation) image.orientation = header.metadata.orientation as Orientation
    image.autoOrient()
    if (image.width !== header.metadata.width || image.height !== header.metadata.height) throw new Error('Orientation normalization failed.')
    if (preview || !settings.preserveMetadata) image.strip()
    if (preview) {
      image.thumbnail(128, 128)
      const thumb = encode(image, 'png', 128 * 128 * 5)
      return { bytes: thumb, thumbnail: new Uint8Array(0), width: image.width, height: image.height, format: 'png' }
    }
    if (output.width !== image.width || output.height !== image.height) {
      const geometry = new MagickGeometry(output.width, output.height)
      geometry.ignoreAspectRatio = true
      image.resize(geometry)
    }
    if (outputFormat === 'jpeg') {
      image.backgroundColor = new MagickColor(settings.jpegBackground)
      image.alpha(AlphaAction.Remove)
      image.hasAlpha = false
    }
    const encoded = encode(image, outputFormat, maxOutputBytes)
    const actual = inspectImage(encoded)
    if (actual.metadata.format !== outputFormat || actual.metadata.width !== output.width || actual.metadata.height !== output.height || actual.hasRemovableMetadata || (outputFormat === 'jpeg' && actual.metadata.hasAlpha)) throw new Error(`The encoded output failed validation: expected ${outputFormat} ${output.width}×${output.height}; got ${actual.metadata.format} ${actual.metadata.width}×${actual.metadata.height}; optional metadata=${actual.hasRemovableMetadata}.`)
    const thumbnail = image.clone((copy) => { copy.strip(); copy.thumbnail(128, 128); return encode(copy, 'png', 128 * 128 * 5) })
    return { bytes: encoded, thumbnail, width: output.width, height: output.height, format: outputFormat }
  })
}
