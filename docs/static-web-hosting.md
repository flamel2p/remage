# Static web hosting and release preparation

This is the deployment contract for the local web candidate. It does not identify an approved production destination or claim that a public artifact has been deployed. Browser/device, source-license and WEB-STABLE gates remain in [web verification](web-verification.md).

## Build and serve

The standalone Vite build uses `pnpm build:web` and writes `dist/web`, separately from Electron's `out` directory. `pnpm dev:web` is the development server; `pnpm preview:web` serves the built local artifact. Stop each with Ctrl-C in its own terminal. Confirm the printed URL and server readiness before using it; a started process alone is not proof that the application works.

Host the complete artifact on one HTTPS origin. Localhost is suitable for local service-worker testing. Configure a stable base path before building; a subdirectory build must use matching HTML asset URLs, manifest scope/start URL and service-worker scope. Do not move a built artifact to a different base path. No processing API, account service, database, registry credentials or REUI MCP is needed at runtime.

```sh
# Origin root, for example https://example.com/
pnpm build:web

# Subdirectory, for example https://example.com/remage/
REMAGE_WEB_BASE=/remage/ pnpm build:web
REMAGE_WEB_BASE=/remage/ pnpm preview:web
```

`REMAGE_WEB_BASE` defaults to `/` and accepts an absolute same-origin path; relative paths, external URLs, queries and dot segments are rejected. Mount the emitted directory at that same path and redirect the bare mount (such as `/remage`) to its trailing-slash form. Use the matching base for local preview as well. `web-build.json` identifies the embedded UI build and the SHA-256/length inventory; `sw.js` owns that compatible inventory. A complete initial installation is still an uncontrolled visit until the user enables offline use with an empty session or closes all windows and reopens. Registration alone does not prove offline readiness.

Build identity includes the relevant source, configuration, lockfile, local assets and notices. `REMAGE_WEB_QA_TAG` is an optional **nonsecret** build discriminator for repeatable update/rollback tests; it is not a credential or release version. The asset digest also identifies the exact emitted set. Keep the reviewed artifact's identity with its verification evidence.

The artifact must contain local fonts, icons, module Workers, glue, WASM and the complete generated asset-version manifest. Serve WASM as `application/wasm`, JavaScript modules as JavaScript, and the app manifest as `application/manifest+json`. Do not rewrite missing asset/module/WASM URLs to HTML. HTML and service-worker/version manifests should revalidate; content-hashed assets can use a long immutable cache lifetime.

## Candidate response headers

Review these on the actual host and test all workflows against the exact served artifact:

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

WASM compilation needs the narrow script exception; inline style support accommodates primitive layout and measured chrome offsets. There is no arbitrary JavaScript eval allowance. Deliver `frame-ancestors` as an HTTP header, not a meta tag. Cross-origin isolation is not required for the single-threaded codec; do not add COOP/COEP without a measured need and compatibility review. Configure HSTS only after the intended HTTPS domain and subdomain policy are verified.

## Update and rollback

Publish a complete build atomically. Keep old content-hashed assets available at their original URLs while older clients can remain open. Never overwrite a version's Worker/WASM under the same immutable filename. The service worker validates the complete required set before marking it ready; partial new installation must leave older complete caches usable.

Version 1 uses the normal waiting-worker lifecycle: no forced activation, `skipWaiting`, `clients.claim`, background session discard or automatic reload. The user finishes/downloads or deliberately discards session data, closes every Remage browser/PWA window and reopens. A retained/frozen client can delay activation. Application caches contain only allowlisted build assets; imported images/results/names/handles stay outside them.

Rollback serves a complete earlier artifact, including its service worker, version manifest and exact compatible assets. Test it with an older open client and a new/reopened client, then offline. Never delete old client assets to accelerate a rollback. App-controlled preservation does not guarantee survival of browser storage eviction. Online reopening is required if the entire shell was evicted.

Before public distribution, provide the corresponding source and rebuild/relink materials required by the combined WASM's LGPL dependencies, all notices and the precise release limits. A local build or an upstream source link does not complete this distribution gate. [Codec provenance and licensing](browser-codec-decision.md).

Production publication requires an approved destination and concrete reviewed artifact. After publication, record served build identity, HTTPS/MIME/header checks, real downloads and privacy observations, installed/offline reopening, update/rollback, and named device/browser versions before recording WEB-STABLE.
