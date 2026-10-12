import type { OperationSettings } from '../shared/contracts'

export const protocolVersion = 1 as const
export type JobIdentity = { version: typeof protocolVersion; jobId: string; batchId: string; sourceId: string }
export type ImageRequest = JobIdentity & {
  type: 'image'; kind: 'transform' | 'preview'; bytes: ArrayBuffer; settings: OperationSettings; retainedBytes: number; maxOutputBytes: number
}
export type ImageResponse = JobIdentity & (
  | { type: 'complete'; bytes: ArrayBuffer; width: number; height: number; format: 'png' | 'jpeg' | 'webp'; thumbnail: ArrayBuffer }
  | { type: 'error'; message: string }
)
export type ArchiveRequest = {
  version: typeof protocolVersion; type: 'archive'; jobId: string; retainedBytes: number
  entries: { name: string; bytes: ArrayBuffer }[]
}
export type ArchiveResponse = { version: typeof protocolVersion; jobId: string } & (
  | { type: 'progress'; completed: number; total: number }
  | { type: 'complete'; bytes: ArrayBuffer }
  | { type: 'error'; message: string }
)

export interface WorkerPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: ImageRequest | ArchiveRequest, transfer: Transferable[]): void
  terminate(): void
}
