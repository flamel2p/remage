## Context

See [proposal.md](proposal.md) for motivation and the capability specs for observable behavior. The repository currently contains no application code. macOS is the first release target; Windows and Linux are later targets, so the source layout must isolate operating-system services and image-codec adapters from shared state and UI contracts.

The supplied WOFF2 fonts are directly usable by Chromium. The local environment has current Node, pnpm, Xcode, and Swift but does not have global JPEG/PNG optimizer executables or Rust. A release therefore cannot rely on Homebrew, Cargo, or user-installed command-line tools.

## Goals / Non-Goals

**Goals:**

- Ship a local macOS arm64/x64 desktop application whose core can later package on Windows and Linux.
- Keep all image bytes, filesystem access, codec process invocation, and output publication outside the renderer.
- Make strict PNG/JPEG optimization testable separately from resize/conversion.
- Use an executable capability registry so UI availability follows the actual packaged engine.
- Use the supplied fonts without any remote font request.

**Non-Goals:**

- Windows/Linux release artifacts in this change.
- Optional lossy “smaller file” mode. Strict optimization is the V1 optimizer contract; resize and selected conversions make their own transformations explicit.
- AVIF, HEIC, TIFF, BMP, RAW, PSD/AI, SVG, ICO, animation, multi-page image support, watch folders, cloud storage, accounts, telemetry, automatic updates, or public distribution.
- A general image editor or an API service.

## Decisions

### 1. Electron, React, and TypeScript form the macOS-first shell

Use Electron with a React/TypeScript renderer built by Vite/electron-vite or an equivalent local toolchain. Use electron-builder for macOS packaging. This keeps the supplied WOFF2 assets native to the renderer, delivers macOS now, and retains a viable Windows/Linux path without porting UI or processing contracts.

Alternatives considered:

- SwiftUI/ImageIO is a strong native macOS option, but turns supplied WOFF2 usage into an asset-conversion concern and requires a second UI implementation for future platforms.
- Tauri offers a smaller shell but adds Rust installation and native codec/sidecar integration before there is a supported engine.
- A browser app has weaker local filesystem and strict-lossless JPEG support.

### 2. Renderer, desktop service, and processing engine are distinct boundaries

Use these module boundaries:

```
renderer/             React state, components, local CSS, font declarations
shared/               DTOs, schemas, settings snapshots, result/state types
preload/              Narrow typed bridge only
main/                 windows, dialogs, task registry, export, lifecycle
engine/               inspect, strict optimize, transform, validate adapters
platform/macos/       Finder dialogs, filesystem rules, package-specific paths
```

The renderer refers to opaque source/task/result identifiers rather than executable paths. The main process owns source/destination handles and uses a validated custom media protocol for previews. All inputs and outputs are validated at each boundary. The processing engine receives an internal source reference and immutable submitted settings, then returns a candidate/result DTO; it never mutates application UI state.

### 3. Secure local Electron configuration is required from the first window

Create one local `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, sandboxing enabled, a restrictive local content security policy, no remote navigation, and denied unexpected window creation. The preload layer exposes only validated operations: choose sources/folder/destination, add dropped files, subscribe to task updates, submit/cancel/retry, remove/clear, and export. It does not expose arbitrary Node, shell, command execution, or path APIs.

The main process validates IPC senders and payloads with runtime schemas. It invokes codec executables with fixed executable paths and argument arrays, never a shell command. It validates source format/content and output destination before reads/writes.

Alternative: letting the renderer access Node or path strings directly simplifies initial code but makes malformed files and renderer bugs able to broaden filesystem/process access. It is rejected.

### 4. A capability registry is the format source of truth

At startup, `CapabilityRegistry` reports per format and operation whether the exact packaged engine can inspect, strictly optimize, resize, decode, and encode it. V1 must advertise only static PNG/JPEG/WebP conversion and strict static PNG/JPEG optimization after an on-device adapter probe passes. The UI obtains its format list from the registry; extension allow-lists are supplementary only.

Future AVIF/HEIC, animation, high bit depth, multi-page images, and non-macOS codecs add adapters plus capability/fixture tests. A decoder is not considered an encoder, and an encoder is not considered a strict optimizer.

### 5. Use separate strict and transformation engine paths

`inspect(source)` determines content type, visible dimensions after orientation, alpha, metadata presence, animation/page/depth flags, and queue limits.

`optimizeStrict(source, settings)` routes:

- PNG to a bundled oxipng executable/library configured to preserve metadata and decoded samples, including no alpha-value optimization.
- JPEG to a bundled jpegtran/libjpeg-turbo path configured for coefficient-preserving optimization and metadata copying.

Candidates pass format, decoded-pixel, dimension, orientation, alpha, and metadata checks appropriate to their strict contract. The adapter selects the source only when a valid candidate is non-smaller; an invalid candidate produces an error and is never exportable.

`transform(source, settings)` uses a packaged image library such as sharp/libvips for static PNG/JPEG/WebP resize/conversion. It normalizes orientation before resize, propagates metadata only when compatible, and enforces target-specific behavior. JPEG transformation is explicitly lossy; transparent-to-JPEG composites against the selected background. Transform results are not passed through the strict no-larger fallback because the requested format/dimensions are authoritative.

Alternatives considered:

- One `sharp` pipeline is concise but does not implement coefficient-preserving JPEG strict optimization and risks accidental image re-encoding.
- Relying on global `sips`, Homebrew tools, or Cargo fails a clean user installation and differs by host.

### 6. Queue execution owns immutable submissions and cleanup

`BatchCoordinator` snapshots operation settings and source IDs at submission, then schedules bounded workers. State transitions are validated: inspecting → ready → queued → processing → completed/unchanged/error/cancelled. Export status is separate.

Workers encode to a private temporary path. The coordinator validates the candidate before results are published. Cancellation blocks new work and signals the adapter; an uninterruptible adapter is in `cancelling` until it reaches a safe point, at which the uncommitted temporary candidate is discarded. Memory-heavy previews are created separately, revocable, and never used as processing input.

### 7. Output publication uses an atomic, collision-safe routine

`OutputPublisher` derives a sanitized filename from source basename plus operation suffix and target extension, resolves collisions against the selected destination, and atomically moves/renames a verified temporary file where the filesystem supports it. It never overwrites a source or existing output. If a destination write fails, the encoded result record remains available for retry; partial temporary outputs are cleaned.

### 8. Initial dependencies must be packaged and independently checked

The implementation will pin renderer/runtime/testing versions in a lockfile. Candidate engine dependencies are Electron, React, TypeScript, Zod, sharp/libvips for transformations, and bundled lossless PNG/JPEG adapters. Before a dependency is adopted, verify macOS arm64/x64 binaries, license/notices, support, and packaging configuration. Native sharp artifacts must remain unpacked from ASAR when required. The application must fail a capability probe clearly instead of crashing if a native adapter is absent.

## Data flow

```
picker / drop / folder
         |
         v
main validates handles --> engine inspect --> source DTO --> renderer queue
                                                       |
                           immutable submit snapshot <-+
                                                       |
                                                       v
renderer <-- progress/result DTO <-- coordinator <-- strict/transform worker
                                                       |
                                                       v
                             temp candidate --> validate --> OutputPublisher
```

Sources and destinations exist only for the active session unless the user explicitly reselects them. Persist small validated preferences only after the core workflow exists; do not persist image paths, bytes, task history, or raw results in V1.

## Verification approach

- Unit tests: settings snapshots, state transitions, dimension math/rounding, filename derivation, collision rules, totals, and capability gating.
- Engine integration tests: generated and checked-in fixtures for PNG/JPEG strict paths, EXIF orientation, ICC profiles, transparent RGB, corruption, oversized/depth/animation rejection, target validation, and output cleanup.
- Security tests: invalid IPC payloads and unsafe output names do not grant filesystem/process behavior.
- UI tests: full keyboard intake/submission/cancellation/result/export flow; bundled font CSS is loaded; empty, queued, processing, unchanged, error, and completed states are visible.
- Package smoke test: built macOS artifact launches with no global optimizer installed and optimizes, transforms, and exports representative fixtures locally.

Strict claims require both adapter-command/configuration assertions and output comparisons. PNG tests compare decoded samples including transparent RGB; JPEG tests prove the coefficient-preserving adapter is selected and compare decoded pixels plus relevant metadata. A successful development-mode test does not satisfy the package gate.

## Risks / Trade-offs

- [Native codec packaging differs by CPU architecture] → package and smoke-test macOS arm64 and x64 separately; hide adapters that fail the startup probe.
- [Strict PNG/JPEG preservation rules are easy to weaken through defaults] → centralize strict adapter configuration; use fixtures for alpha, orientation, ICC, metadata, and no-larger fallback.
- [Electron has a larger runtime and security maintenance burden] → update Electron regularly; keep one local secure window, no remote content, and minimal preload API.
- [Future platform paths can drift] → shared DTOs, engine interface, capability registry, and renderer have no macOS-specific imports; isolate macOS APIs under `platform/macos`.
- [JPEG/PNG output can consume disk/memory unexpectedly] → enforce intake limits, bounded concurrency, temporary-file cleanup, and cancellation semantics.
- [Bundled font/license notice is incomplete] → do not publish until upstream font and codec notices are included and reviewed.

## Migration Plan

No prior product data exists. Scaffold the application, then add platform/engine modules behind the interfaces above. Existing planning documents are retained as supporting product documentation. If a native engine dependency fails packaging, leave its capability disabled and block the phase gate rather than silently substituting a weaker path. Remove the app/artifact as a normal local build output to roll back; no source or user files are mutated by deployment.
