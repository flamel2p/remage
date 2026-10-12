import { createRoot } from 'react-dom/client'
import { App } from '../renderer/src/App'
import '../renderer/src/styles.css'
import { BrowserService } from './browser-service'
import { PwaController } from './pwa'
import { PwaPanel } from './pwa-panel'

const api = new BrowserService()
const pwa = new PwaController(api, __REMAGE_BUILD_ID__, import.meta.env.BASE_URL, import.meta.env.DEV)
const root = createRoot(document.getElementById('root')!)
root.render(<App api={api} statusPanel={<PwaPanel controller={pwa} buildId={__REMAGE_BUILD_ID__} />} beforeProcess={pwa.beforeProcess} />)
void pwa.start()
window.addEventListener('pagehide', (event) => { if (event.persisted) api.suspend(); else { pwa.dispose(); api.dispose() } })
window.addEventListener('pageshow', (event) => { if (event.persisted) api.resume(); void pwa.check() })
window.addEventListener('beforeunload', (event) => {
  if (!api.hasSessionWork()) return
  event.preventDefault(); event.returnValue = ''
})

if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); pwa.dispose(); api.dispose() })
