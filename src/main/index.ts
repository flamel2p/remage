import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import { localLegalMetadata } from '../shared/app-metadata'
import { PreferencesSchema, SubmitBatchRequestSchema, type Preferences } from '../shared/contracts'
import { openSelectedOutputDirectory, registerOpenOutputDirectory } from './ipc/open-output-directory'
import { RemageService } from './services/remage-service'

let mainWindow: BrowserWindow | null = null
let remage: RemageService

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    title: 'Remage',
    backgroundColor: '#17142A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (event.sender !== mainWindow?.webContents) throw new Error('Untrusted renderer request.')
}

function installIpc(): void {
  registerOpenOutputDirectory(ipcMain, {
    assertTrustedSender,
    openOutputDirectory: () => remage.openOutputDestination((path) => openSelectedOutputDirectory(path, (destination) => shell.openPath(destination)))
  })
  ipcMain.handle('remage:choose-files', async (event) => {
    assertTrustedSender(event)
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile', 'multiSelections'] })
    return result.canceled ? remage.snapshot() : remage.addPaths(result.filePaths)
  })
  ipcMain.handle('remage:choose-folder', async (event) => {
    assertTrustedSender(event)
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
    return result.canceled ? remage.snapshot() : remage.addFolder(result.filePaths[0])
  })
  ipcMain.handle('remage:add-dropped-files', async (event, paths: unknown) => {
    assertTrustedSender(event)
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string')) throw new Error('Invalid dropped-file request.')
    return remage.addPaths(paths)
  })
  ipcMain.handle('remage:get-snapshot', (event) => {
    assertTrustedSender(event)
    return remage.snapshot()
  })
  ipcMain.handle('remage:get-preferences', (event) => {
    assertTrustedSender(event)
    return remage.getPreferences()
  })
  ipcMain.handle('remage:save-preferences', async (event, preferences: unknown) => {
    assertTrustedSender(event)
    await remage.savePreferences(PreferencesSchema.parse(preferences) as Preferences)
  })
  ipcMain.handle('remage:remove-source', (event, sourceId: unknown) => {
    assertTrustedSender(event)
    if (typeof sourceId !== 'string') throw new Error('Invalid source identifier.')
    return remage.removeSource(sourceId)
  })
  ipcMain.handle('remage:clear-queue', (event) => {
    assertTrustedSender(event)
    return remage.clearQueue()
  })
  ipcMain.handle('remage:requeue-source', (event, sourceId: unknown) => {
    assertTrustedSender(event)
    if (typeof sourceId !== 'string') throw new Error('Invalid source identifier.')
    return remage.requeueSource(sourceId)
  })
  ipcMain.handle('remage:submit-batch', async (event, request: unknown) => {
    assertTrustedSender(event)
    await remage.submit(SubmitBatchRequestSchema.parse(request))
  })
  ipcMain.handle('remage:cancel-batch', async (event) => {
    assertTrustedSender(event)
    await remage.cancel()
  })
  ipcMain.handle('remage:choose-output-directory', async (event) => {
    assertTrustedSender(event)
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : remage.selectOutputDestination(result.filePaths[0])
  })
  ipcMain.handle('remage:choose-export-directory', async (event) => {
    assertTrustedSender(event)
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : remage.selectDestination(result.filePaths[0])
  })
  ipcMain.handle('remage:get-app-metadata', (event) => {
    assertTrustedSender(event)
    return { version: app.getVersion(), ...localLegalMetadata }
  })
  ipcMain.handle('remage:export-result', (event, resultId: unknown, destination: unknown) => {
    assertTrustedSender(event)
    if (typeof resultId !== 'string' || typeof destination !== 'string') throw new Error('Invalid export request.')
    return remage.exportResult(resultId, destination)
  })
  ipcMain.handle('remage:export-all', (event, resultIds: unknown, destination: unknown) => {
    assertTrustedSender(event)
    if (!Array.isArray(resultIds) || resultIds.some((id) => typeof id !== 'string') || typeof destination !== 'string') {
      throw new Error('Invalid export request.')
    }
    return remage.exportAll(resultIds, destination)
  })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  const scriptSrc = process.env.ELECTRON_RENDERER_URL ? "'self' 'unsafe-inline'" : "'self'"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'self'; base-uri 'none'; form-action 'none'`]
      }
    })
  })
  remage = new RemageService()
  await remage.initialize()
  installIpc()
  createWindow()
  remage.subscribe((event) => mainWindow?.webContents.send('remage:event', event))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  app.on('before-quit', () => {
    void remage.dispose()
  })
}

void bootstrap()
