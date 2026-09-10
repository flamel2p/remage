/// <reference types="vite/client" />

import type { RemageApi } from '../../shared/contracts'

declare global {
  interface Window {
    remage: RemageApi
  }
}

export {}
