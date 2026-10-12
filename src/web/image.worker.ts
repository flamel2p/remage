import { initializeImageMagick } from '@imagemagick/magick-wasm'
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url'
import { constrainCodec, transformImage } from './codec'
import { protocolVersion, type ImageRequest, type ImageResponse } from './protocol'

const scope = self as unknown as { onmessage: (event: MessageEvent<ImageRequest>) => Promise<void>; postMessage(message: ImageResponse, transfer?: Transferable[]): void }
let initialization: Promise<void> | undefined
scope.onmessage = async (event: MessageEvent<ImageRequest>) => {
  const request = event.data
  if (request.version !== protocolVersion || request.type !== 'image') return
  const identity = { version: protocolVersion, jobId: request.jobId, batchId: request.batchId, sourceId: request.sourceId }
  try {
    initialization ??= initializeImageMagick(new URL(wasmUrl, import.meta.url)).then(constrainCodec).catch((error: unknown) => {
      throw new Error(`Unable to initialize browser processing assets. Reconnect and retry to restore the required codec: ${error instanceof Error ? error.message : 'initialization failed'}`)
    })
    await initialization
    const output = transformImage(new Uint8Array(request.bytes), request.settings, request.retainedBytes, request.kind === 'preview', request.maxOutputBytes)
    const response: ImageResponse = { ...identity, type: 'complete', bytes: output.bytes.buffer, thumbnail: output.thumbnail.buffer, width: output.width, height: output.height, format: output.format }
    scope.postMessage(response, [response.bytes, response.thumbnail])
  } catch (error) {
    const response: ImageResponse = { ...identity, type: 'error', message: error instanceof Error ? error.message : 'The browser codec failed. Retry, or reconnect if processing assets are missing.' }
    scope.postMessage(response)
  }
}
