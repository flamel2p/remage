import { z } from 'zod'

export const ImageFormatSchema = z.enum(['png', 'jpeg', 'webp'])
export type ImageFormat = z.infer<typeof ImageFormatSchema>

export const ModeSchema = z.enum(['optimizer', 'converter'])
export type Mode = z.infer<typeof ModeSchema>

export const ItemStatusSchema = z.enum([
  'inspecting',
  'ready',
  'queued',
  'processing',
  'cancelling',
  'completed',
  'unchanged',
  'error',
  'cancelled'
])
export type ItemStatus = z.infer<typeof ItemStatusSchema>

export const ExportStatusSchema = z.enum(['not-exported', 'exporting', 'exported', 'error'])
export type ExportStatus = z.infer<typeof ExportStatusSchema>

export const ResizeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  width: z.number().int().positive().max(16_384).nullable().default(null),
  height: z.number().int().positive().max(16_384).nullable().default(null),
  lockAspectRatio: z.boolean().default(true),
  allowEnlargement: z.boolean().default(false)
})
export type ResizeSettings = z.infer<typeof ResizeSettingsSchema>

export const OperationSettingsSchema = z
  .object({
    mode: ModeSchema.default('optimizer'),
    outputFormat: ImageFormatSchema.nullable().default(null),
    resize: ResizeSettingsSchema.default({
      enabled: false,
      width: null,
      height: null,
      lockAspectRatio: true,
      allowEnlargement: false
    }),
    jpegBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFFFFF'),
    jpegLossAcknowledged: z.boolean().default(false),
    outputDirectory: z.string().nullable().default(null),
    preserveMetadata: z.boolean().default(true)
  })
  .superRefine((settings, context) => {
    if (settings.mode === 'converter' && !settings.outputFormat) {
      context.addIssue({ code: 'custom', path: ['outputFormat'], message: 'Choose an output format.' })
    }

    if (settings.resize.enabled) {
      const { height, lockAspectRatio, width } = settings.resize
      if (!width && !height) {
        context.addIssue({ code: 'custom', path: ['resize'], message: 'Enter a width, height, or both.' })
      }
      if (!lockAspectRatio && (!width || !height)) {
        context.addIssue({
          code: 'custom',
          path: ['resize'],
          message: 'Exact dimensions require both width and height.'
        })
      }
    }

    if (settings.mode === 'converter' && settings.outputFormat === 'jpeg' && !settings.jpegLossAcknowledged) {
      context.addIssue({
        code: 'custom',
        path: ['jpegLossAcknowledged'],
        message: 'Acknowledge JPEG re-encoding before continuing.'
      })
    }
  })
export type OperationSettings = z.infer<typeof OperationSettingsSchema>

export const ImageMetadataSchema = z.object({
  format: ImageFormatSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hasAlpha: z.boolean(),
  orientation: z.number().int().nullable(),
  bitDepth: z.string().nullable(),
  pages: z.number().int().positive(),
  space: z.string().nullable(),
  hasIccProfile: z.boolean(),
  hasExif: z.boolean()
})
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>

export const QueueItemSchema = z.object({
  id: z.string().uuid(),
  sourceName: z.string().min(1),
  sourceBytes: z.number().int().nonnegative(),
  metadata: ImageMetadataSchema.nullable(),
  thumbnailDataUrl: z.string().nullable(),
  status: ItemStatusSchema,
  error: z.string().nullable(),
  previousResultId: z.string().uuid().nullable(),
  createdAt: z.string().datetime()
})
export type QueueItem = z.infer<typeof QueueItemSchema>

export const ResultSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceName: z.string().min(1),
  sourceBytes: z.number().int().nonnegative(),
  resultBytes: z.number().int().nonnegative(),
  sourceFormat: ImageFormatSchema,
  resultFormat: ImageFormatSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  operation: z.enum(['strict-optimization', 'resize', 'conversion']),
  status: z.enum(['completed', 'unchanged']),
  exportStatus: ExportStatusSchema,
  exportPath: z.string().nullable(),
  settings: OperationSettingsSchema,
  createdAt: z.string().datetime()
})
export type Result = z.infer<typeof ResultSchema>

export const CapabilitySchema = z.object({
  format: ImageFormatSchema,
  canInspect: z.boolean(),
  canStrictOptimize: z.boolean(),
  canEncode: z.boolean(),
  detail: z.string().nullable()
})
export type Capability = z.infer<typeof CapabilitySchema>

export const AppSnapshotSchema = z.object({
  queue: z.array(QueueItemSchema),
  results: z.array(ResultSchema),
  capabilities: z.array(CapabilitySchema),
  activeBatchId: z.string().uuid().nullable(),
  activeMode: ModeSchema,
  progressLabel: z.string().nullable()
})
export type AppSnapshot = z.infer<typeof AppSnapshotSchema>

export const SubmitBatchRequestSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1),
  settings: OperationSettingsSchema
})
export type SubmitBatchRequest = z.infer<typeof SubmitBatchRequestSchema>

export const PreferencesSchema = z.object({
  mode: ModeSchema.default('optimizer'),
  settings: OperationSettingsSchema.default({
    mode: 'optimizer',
    outputFormat: null,
    resize: {
      enabled: false,
      width: null,
      height: null,
      lockAspectRatio: true,
      allowEnlargement: false
    },
    jpegBackground: '#FFFFFF',
    jpegLossAcknowledged: false,
    outputDirectory: null,
    preserveMetadata: true
  })
})
export type Preferences = z.infer<typeof PreferencesSchema>

export const defaultSettings: OperationSettings = {
  mode: 'optimizer',
  outputFormat: null,
  resize: {
    enabled: false,
    width: null,
    height: null,
    lockAspectRatio: true,
    allowEnlargement: false
  },
  jpegBackground: '#FFFFFF',
  jpegLossAcknowledged: false,
  outputDirectory: null,
  preserveMetadata: true
}

export type RemageEvent = { type: 'snapshot'; snapshot: AppSnapshot }

export interface RemageApi {
  chooseFiles(): Promise<AppSnapshot>
  chooseFolder(): Promise<AppSnapshot>
  addDroppedFiles(files: File[]): Promise<AppSnapshot>
  getSnapshot(): Promise<AppSnapshot>
  getPreferences(): Promise<Preferences>
  savePreferences(preferences: Preferences): Promise<void>
  removeSource(sourceId: string): Promise<AppSnapshot>
  clearQueue(): Promise<AppSnapshot>
  requeueSource(sourceId: string): Promise<AppSnapshot>
  submitBatch(request: SubmitBatchRequest): Promise<void>
  cancelBatch(): Promise<void>
  chooseOutputDirectory(): Promise<string | null>
  exportResult(resultId: string, destination: string): Promise<AppSnapshot>
  exportAll(resultIds: string[], destination: string): Promise<AppSnapshot>
  onEvent(listener: (event: RemageEvent) => void): () => void
}
