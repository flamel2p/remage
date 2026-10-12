import { createStoreZip } from './zip'
import { protocolVersion, type ArchiveRequest, type ArchiveResponse } from './protocol'

const scope = self as unknown as { onmessage: (event: MessageEvent<ArchiveRequest>) => Promise<void>; postMessage(message: ArchiveResponse, transfer?: Transferable[]): void }
scope.onmessage = async (event: MessageEvent<ArchiveRequest>) => {
  const request = event.data
  if (request.version !== protocolVersion || request.type !== 'archive') return
  const identity = { version: protocolVersion, jobId: request.jobId }
  try {
    const bytes = await createStoreZip(request.entries.map((entry) => ({ name: entry.name, bytes: new Uint8Array(entry.bytes) })), request.retainedBytes, (completed, total) => {
      const message: ArchiveResponse = { ...identity, type: 'progress', completed, total }; scope.postMessage(message)
    })
    const response: ArchiveResponse = { ...identity, type: 'complete', bytes: bytes.buffer }
    scope.postMessage(response, [response.bytes])
  } catch (error) {
    const response: ArchiveResponse = { ...identity, type: 'error', message: error instanceof Error ? error.message : 'ZIP preparation failed. Try a smaller selection.' }
    scope.postMessage(response)
  }
}
