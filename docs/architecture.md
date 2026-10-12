# Architecture

Implementation record: 2026-10-12, active `release-web-pwa-v1`. The browser adapter and isolated build are implemented; responsive UI/PWA qualification is in progress. [Verification](web-verification.md) owns observed evidence and release gates.

## Shared and browser boundaries

The React workspace receives `RemageApi` explicitly. Platform capabilities select available actions; UI code does not import the Electron bridge, native engine or browser codec. Shared Zod DTOs, resize planning and formatting remain pure. The native preload injects the desktop adapter; `src/web/main.tsx` injects `BrowserService`. The standalone Vite build emits `dist/web`, independently of Electron's `out`, and rejects native imports in both application and Worker graphs.

`BrowserService` owns an in-memory registry of original bytes, opaque source/result IDs and immutable submitted settings. Intake uses bounded PNG/JPEG/WebP content parsing and validates animation, depth, color, metadata and resource admission before decoding. MIME and extensions are hints. An isolated image Worker loads the pinned local Magick WASM, transforms one image at a time, validates outputs, and terminates after each job, timeout or cancellation. Original bytes remain available for retry/requeue; completed results survive unrelated failures.

Browser strict optimization is unavailable. Converter defaults to no selected format, metadata preservation stays selected, and unsupported optional metadata requires explicit removal. ICC/CMYK and unqualified color declarations remain rejected even with removal selected. JPEG always requires re-encoding acknowledgement and an explicit alpha background. PNG/lossless WebP preserve the verified decoded samples under the restricted transform contract; this does not claim original-file or native strict-optimizer parity.

Downloads use safe format-correct names and `download-requested` receipts. A separate Worker builds deterministic STORE ZIP entries from selected validated results. Archives pause new image scheduling, wait for active image teardown, and enforce combined retained/transient reservations. Validation retains its cancellation-aware reservation until cleanup. ZIP readiness is separate from the explicit user download gesture. No browser destination path or confirmed-save receipt is fabricated.

Source/result/ZIP/admission limits are provisional estimates, not browser heap caps. See [release contract](web-release-contract.md) and [codec decision](browser-codec-decision.md). Real weakest-device timing/memory and repeated boundary/cancellation qualification remain required. Files, names, previews, handles and result bytes are never persisted; only validated settings and appearance preferences may be stored.

## Existing native boundaries

```text
React renderer
  │ typed, context-isolated bridge
  ▼
Electron main process ── source records / queue / result records / preferences
  │                                │
  │ fixed executable arguments      └── OutputPublisher
  ▼
ImageEngine ── sharp transforms / jpegtran / oxipng ── private temp candidates
```

The renderer receives queue and result DTOs with opaque IDs. Source and candidate paths stay in main-process records. The preload API has no arbitrary file, path, Node, or shell function. Main-process IPC handlers accept only the active window’s sender and validate untrusted payloads before executing an operation.

## Processing contracts

Strict mode invokes only fixed `jpegtran` or `oxipng` argument arrays. JPEG uses `jpegtran -copy all -optimize`; PNG uses OxiPNG level 4 without alpha-value optimization. Candidates must have the original format, visible dimensions, alpha state, orientation, decoded raw samples, ICC profile, and EXIF metadata. A valid candidate that is equal or larger is discarded and recorded as **No size reduction**. Any failed preservation check records an error and is never exported as an optimization result.

Resize/conversion uses sharp/libvips. The engine applies EXIF orientation before calculating bounds. Aspect lock and no-enlargement are defaults; exact dimensions require both width and height. JPEG conversion requires a user acknowledgement and flattens alpha onto the chosen color.

## Output and lifecycle

Each submission holds an immutable settings snapshot. At most two files process concurrently. Before processing, Remage copies the source to a private temporary snapshot and verifies its SHA-256 fingerprint from intake; a source changed after intake is rejected rather than silently processed. Cancellation stops scheduling new work, terminates active codec execution at a safe point, and discards uncommitted candidates. Both optimized and unchanged results export from a verified private candidate/snapshot, never by rereading a live original. Output names are sanitized, resolved inside the selected destination, collision-suffixed, and published via a temporary file plus hard-link reservation. Export failure leaves the result available for retry.

## Platform path

macOS packaging includes sidecar codecs in `Contents/Resources/codecs`. The renderer and shared contracts are platform-neutral. A Windows/Linux release needs platform-specific codec acquisition, signing, path probes, and a packaging smoke test; it does not require rewriting the React or queue contracts.
