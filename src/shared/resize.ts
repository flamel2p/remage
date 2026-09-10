import type { ResizeSettings } from './contracts'

export type Dimensions = { width: number; height: number }

export type ResizePlan = Dimensions & {
  isTransformation: boolean
  isEnlargement: boolean
}

export function planResize(source: Dimensions, settings: ResizeSettings): ResizePlan {
  if (!settings.enabled) {
    return { ...source, isTransformation: false, isEnlargement: false }
  }

  const { allowEnlargement, height, lockAspectRatio, width } = settings
  if (!width && !height) {
    throw new Error('Enter a width, height, or both.')
  }

  let targetWidth: number
  let targetHeight: number

  if (!lockAspectRatio) {
    if (!width || !height) {
      throw new Error('Exact dimensions require both width and height.')
    }
    targetWidth = width
    targetHeight = height
  } else if (width && height) {
    const scale = Math.min(width / source.width, height / source.height)
    const cappedScale = allowEnlargement ? scale : Math.min(scale, 1)
    targetWidth = Math.max(1, Math.floor(source.width * cappedScale))
    targetHeight = Math.max(1, Math.floor(source.height * cappedScale))
  } else if (width) {
    const cappedWidth = allowEnlargement ? width : Math.min(width, source.width)
    targetWidth = cappedWidth
    targetHeight = Math.max(1, Math.floor((source.height * cappedWidth) / source.width))
  } else {
    const cappedHeight = allowEnlargement ? height! : Math.min(height!, source.height)
    targetHeight = cappedHeight
    targetWidth = Math.max(1, Math.floor((source.width * cappedHeight) / source.height))
  }

  const isEnlargement = targetWidth > source.width || targetHeight > source.height
  if (isEnlargement && !allowEnlargement) {
    throw new Error('Enlargement is disabled.')
  }

  return {
    width: targetWidth,
    height: targetHeight,
    isTransformation: targetWidth !== source.width || targetHeight !== source.height,
    isEnlargement
  }
}
