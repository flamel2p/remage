# Architecture

## Boundaries

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
