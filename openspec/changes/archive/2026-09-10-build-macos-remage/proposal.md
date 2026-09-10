## Why

People preparing web and application assets need a local way to shrink, resize, and convert batches without uploading private files or overwriting originals. Remage starts on macOS, while its processing and interface contracts must remain portable to future Windows and Linux releases.

## What Changes

- Create Remage as a macOS-first Electron desktop application with a local React/TypeScript interface, bundled fonts, and a restricted main/renderer boundary.
- Add an accessible Optimizer/Converter workspace with file and folder intake, inspection, editable queue, settings snapshots, background progress, cancellation, and per-file recovery.
- Add strict lossless optimization for supported static PNG and JPEG files, including a no-larger fallback and preservation checks.
- Add optional resizing and conversion for a verified initial format matrix: static PNG, JPEG, and WebP. Defer AVIF and HEIC until their macOS codec paths and fidelity contracts have direct test evidence.
- Add safe output export with collision-safe names, atomic publication, result summaries, and local-only processing.
- Establish reproducible build, test, fixture, capability, and packaged-artifact verification for macOS arm64 and x64 where available.

## Capabilities

### New Capabilities

- `desktop-workspace`: Local macOS-first Remage window, secure desktop bridge, accessible mode navigation, intake, inspection, and batch queue behavior.
- `lossless-optimization`: Strict PNG/JPEG optimization that preserves the documented image contract and keeps a source file when no smaller valid candidate exists.
- `image-transform`: Explicit resize and conversion behavior for the verified static PNG/JPEG/WebP capability matrix, including loss/transparency disclosures.
- `safe-batch-export`: Immutable batch settings, bounded processing, cancellation, truthful result accounting, and collision-safe output publication.

### Modified Capabilities

- None.

## Impact

- Adds a new Electron + React + TypeScript package structure, local WOFF2 font usage, desktop packaging, test fixtures, and documentation.
- Adds native image-processing dependencies and adapters. Their versions, notices, packaged binaries, and macOS arm64/x64 behavior require verification.
- Does not add a remote service, account, telemetry, paid image API, public deployment, or cross-platform release in this change.
