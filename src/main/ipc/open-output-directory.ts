import type { IpcMain, IpcMainInvokeEvent } from 'electron'

type OpenOutputDirectoryDependencies = {
  assertTrustedSender: (event: IpcMainInvokeEvent) => void
  openOutputDirectory: () => Promise<void>
}

export async function openSelectedOutputDirectory(path: string, openPath: (path: string) => Promise<string>): Promise<void> {
  if (await openPath(path)) throw new Error('Could not open the selected save destination. Choose another folder in Settings.')
}

export function registerOpenOutputDirectory(
  ipc: Pick<IpcMain, 'handle'>,
  { assertTrustedSender, openOutputDirectory }: OpenOutputDirectoryDependencies
): void {
  ipc.handle('remage:open-output-directory', async (event) => {
    assertTrustedSender(event)
    await openOutputDirectory()
  })
}
