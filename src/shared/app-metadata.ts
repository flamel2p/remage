export type AppMetadata = {
  version: string
  license: string
  notices: readonly string[]
}

export const localLegalMetadata = {
  license: 'MIT License',
  notices: [
    'OxiPNG 10.2.1 is bundled under the MIT license.',
    'libjpeg-turbo 3.2.0 and jpegtran are bundled under Independent JPEG Group and BSD-style licenses.',
    'sharp and libvips are bundled for image inspection, thumbnails, resizing, and conversion.',
    'Atkinson Hyperlegible Next and Lilex font files are bundled with their upstream licenses.'
  ]
} as const
