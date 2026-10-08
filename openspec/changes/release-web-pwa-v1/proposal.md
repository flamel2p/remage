## Why

Ekko confirmed on 2026-10-08 that Remage's public version 1.0 should be a free, open-source web/PWA edition, followed by desktop work after web stability. The current React workspace is reusable, but its Electron bridge, native Sharp processing, macOS codecs, and filesystem export cannot run unchanged in a browser.

## What Changes

- Add a browser build alongside the existing desktop source, sharing React UI, validation, resize rules, and result semantics through explicit platform adapters.
- Deliver on-device static PNG/JPEG/WebP conversion and resizing, responsive intake, worker-based batches, cancellation, honest results, single downloads, and batch ZIP export.
- Enable browser strict optimization only for a verified format/subset; strict JPEG parity is deferred and SHALL NOT be replaced with implicit lossy recompression.
- Add PWA installation where supported, complete application/codec caching, explicit offline readiness, and updates that preserve active work.
- Establish measured browser limits, a production browser/device support matrix, open-source build instructions, and a reproducible stability gate before desktop implementation.
- Keep accounts, billing, telemetry, remote image processing, saved image history, automatic filesystem export, and advanced formats outside web v1.0.
- Preserve the existing desktop strict-quality contract and native engine for the later `expand-desktop-platforms` change.
- Apply root `design.md`, local Atkinson/Lilex fonts and violet light/dark tokens through a Radix-based REUI/shadcn Card foundation. Motion Icons are the selected later icon family, gated on written permission for public-source redistribution; retain current local icons until that gate passes.

## Capabilities

### New Capabilities

- `web-workspace`: Private, responsive browser workspace, capability-aware platform actions, file intake, preferences, and bounded session lifecycle.
- `browser-image-processing`: Worker/WASM processing, verified format/metadata boundaries, resize/conversion disclosure, and gated strict optimization.
- `browser-batch-export`: Immutable browser batches, cancellation, actual accounting, single downloads, and safe batch ZIP export.
- `pwa-lifecycle`: Installation guidance, coherent offline asset caching, cache-loss recovery, safe updates, and release stability evidence.

### Modified Capabilities

None. Existing desktop workspace, native lossless optimization, transformation, and filesystem safety requirements are preserved. The added browser requirements explicitly scope platform differences without reducing desktop guarantees.

## Impact

- Current sources: `src/renderer/src/App.tsx`, `styles.css`, `src/shared/contracts.ts`, `resize.ts`, `format.ts`, and `src/preload/index.ts` define reuse seams. The native engine/services remain desktop-owned.
- Proposed additions: browser entry/build configuration, browser platform adapter, file/blob registry, worker protocol, WASM codec adapters, download/ZIP publisher, and PWA manifest/service worker.
- Build/test boundaries must prevent Electron, Node filesystem APIs, and Sharp from entering the web bundle; the existing macOS build must remain functional.
- New dependencies are evaluated/pinned browser codecs, ZIP support, and PWA build tooling with retained notices. No paid processing vendor or backend is required.
- Shared UI adoption adds reviewed/pinned Tailwind v4, shadcn/Radix and selected REUI source dependencies. Fonts and developer MCP setup are prepared, but production renderer migration is pending; premium icon access does not prove redistribution rights.
- The detailed execution order, proposed limits, use-case pros/cons, release gates, and source references are in `docs/platform-execution-plan.md`. These artifacts are plans, not implementation evidence.
