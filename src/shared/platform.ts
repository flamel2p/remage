export type PlatformCapabilities = {
  runtime: 'browser' | 'desktop'
  folderIntake: boolean
  destinationWriting: boolean
  openDestination: boolean
  automaticExport: boolean
  downloads: boolean
  archiveExport: boolean
  metadata: 'preserve' | 'restricted'
}

export const desktopPlatform: PlatformCapabilities = {
  runtime: 'desktop',
  folderIntake: true,
  destinationWriting: true,
  openDestination: true,
  automaticExport: true,
  downloads: false,
  archiveExport: false,
  metadata: 'preserve'
}

export const browserPlatform: PlatformCapabilities = {
  runtime: 'browser',
  folderIntake: false,
  destinationWriting: false,
  openDestination: false,
  automaticExport: false,
  downloads: true,
  archiveExport: true,
  metadata: 'restricted'
}
