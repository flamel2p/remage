import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Preferences, RemageApi, SubmitBatchRequest } from '../shared/contracts'

const api: RemageApi = {
  chooseFiles: () => ipcRenderer.invoke('remage:choose-files'),
  chooseFolder: () => ipcRenderer.invoke('remage:choose-folder'),
  addDroppedFiles: (files) => ipcRenderer.invoke('remage:add-dropped-files', files.map((file) => webUtils.getPathForFile(file)).filter(Boolean)),
  getSnapshot: () => ipcRenderer.invoke('remage:get-snapshot'),
  getPreferences: () => ipcRenderer.invoke('remage:get-preferences'),
  savePreferences: (preferences: Preferences) => ipcRenderer.invoke('remage:save-preferences', preferences),
  removeSource: (sourceId) => ipcRenderer.invoke('remage:remove-source', sourceId),
  clearQueue: () => ipcRenderer.invoke('remage:clear-queue'),
  requeueSource: (sourceId) => ipcRenderer.invoke('remage:requeue-source', sourceId),
  submitBatch: (request: SubmitBatchRequest) => ipcRenderer.invoke('remage:submit-batch', request),
  cancelBatch: () => ipcRenderer.invoke('remage:cancel-batch'),
  chooseOutputDirectory: () => ipcRenderer.invoke('remage:choose-output-directory'),
  chooseExportDirectory: () => ipcRenderer.invoke('remage:choose-export-directory'),
  openOutputDirectory: () => ipcRenderer.invoke('remage:open-output-directory'),
  getAppMetadata: () => ipcRenderer.invoke('remage:get-app-metadata'),
  exportResult: (resultId, destination) => ipcRenderer.invoke('remage:export-result', resultId, destination),
  exportAll: (resultIds, destination) => ipcRenderer.invoke('remage:export-all', resultIds, destination),
  onEvent: (listener) => {
    const subscription = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload)
    ipcRenderer.on('remage:event', subscription)
    return () => ipcRenderer.removeListener('remage:event', subscription)
  }
}

contextBridge.exposeInMainWorld('remage', api)
