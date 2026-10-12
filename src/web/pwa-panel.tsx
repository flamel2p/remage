import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { PwaController } from './pwa'

export function PwaPanel({ controller, buildId }: { controller: PwaController; buildId: string }): React.JSX.Element {
  const state = useSyncExternalStore(controller.subscribe, controller.getState), [confirmation, setConfirmation] = useState<'offline' | 'update' | null>(null)
  const iphoneSafari = /iPhone/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
  const disabled = state.busy || state.operation
  return <>
    <Alert className="pwa-panel" variant={state.mode === 'ready' ? 'success' : ['blocked', 'error', 'partial'].includes(state.mode) ? 'warning' : 'info'}>
      <AlertTitle>{state.mode === 'ready' ? 'Offline ready' : 'Application setup'}{state.installed ? ' · Installed window' : ''}</AlertTitle>
      <AlertDescription><p role="status" data-pwa-state={state.mode}>{state.label}</p>
        {state.recoveryError && <p role="alert">{state.recoveryError}</p>}
        {state.waiting && <p data-pwa-waiting="true">An update is waiting. Finish processing and download any results you need, or deliberately clear the session. Close every Remage tab and installed window, then reopen. Frozen or unresponsive windows delay activation.</p>}
        <p className="help-text">Cached application files can be evicted by the browser. If the whole page cache is lost, reopen online. Images and results remain temporary; installation does not save them or guarantee background processing. Older application caches are retained and can use storage.</p>
        <div className="pwa-actions">
          {state.mode !== 'unsupported' && <><Button variant="outline" disabled={disabled} onClick={() => void controller.update()}>Check for update</Button><Button variant="outline" disabled={disabled} onClick={() => void controller.restore()}>Restore offline files</Button></>}
          {state.mode === 'setup' && <Button variant="secondary" disabled={disabled} onClick={() => { if (state.hasSession) setConfirmation('offline'); else void controller.enableOffline(false) }}>Enable offline use</Button>}
          {state.waiting && state.hasSession && <Button variant="outline" disabled={disabled} onClick={() => setConfirmation('update')}>Clear session for update</Button>}
          {state.installAvailable && !state.installed && <Button variant="outline" onClick={() => void controller.install()}>Install Remage</Button>}
        </div>
        {iphoneSafari && !state.installed && <p className="help-text">In Safari on iPhone, use Share → Add to Home Screen. Enable Open as Web App if offered, then Add. <a href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios" target="_blank" rel="noreferrer">Apple instructions</a></p>}
        <p className="help-text">Application build <span className="data-text" data-build-id={buildId}>{buildId.slice(0, 12)}</span></p>
      </AlertDescription>
    </Alert>
    <AlertDialog open={confirmation !== null} onOpenChange={(open) => { if (!open) setConfirmation(null) }}><AlertDialogContent><AlertDialogTitle>Discard this temporary session?</AlertDialogTitle><AlertDialogDescription>Download any results you need first. A download request does not confirm that a file was saved. This action clears the selected originals, previews and results from Remage. Your source files are unchanged.{confirmation === 'offline' ? ' The empty page will then reload to enable offline control.' : ' After clearing, close every Remage window and reopen for the update.'}</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline">Keep session</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={() => { if (confirmation === 'offline') void controller.enableOffline(true); else void controller.clearForUpdate() }}>Discard session</Button></AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </>
}
