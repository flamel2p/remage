## Context

See `proposal.md` for the user-confirmed release direction. Current implementation evidence is `src/renderer/src/App.tsx`, `src/shared/contracts.ts`, `src/main/services/{image-engine,remage-service,intake,output-publisher}.ts`, and `docs/verification.md`. The UI calls `window.remage` directly, `ImageEngine` imports Node/Sharp and invokes native binaries, codec discovery hardcodes Darwin, and CSS has an 800px minimum width. Existing tests and package evidence describe desktop only.

This design is proposed, not implemented. `docs/platform-execution-plan.md` records the two release tracks, source references, proposed resource budgets, and W-01–W-12 stability criteria. Existing desktop requirements remain authoritative for the desktop edition.

Ekko's subsequent UI foundation decision is authoritative in root `design.md`: locally bundled Atkinson Hyperlegible Next/Lilex, violet light/dark tokens, `radix-nova` REUI/shadcn with Card surfaces, and outline Motion Icons only after written public-source redistribution permission. `docs/reui-setup.md` records actual developer MCP/font readiness separately from pending renderer adoption.

## Goals / Non-Goals

**Goals:**

- Share UI and pure domain rules while giving browser and desktop engines independent capability and export contracts.
- Keep image processing local, cancellable, bounded, responsive, and honest about transformations and metadata.
- Support ordinary browser use and an offline-ready installed PWA without a processing service.
- Preserve a working desktop source/build throughout the web extraction.

**Non-Goals:**

- A Tauri/Rust migration, universal engine rewrite, automatic filesystem writes, persisted image sessions, background completion after tab closure, or strict JPEG browser parity as a v1.0 blocker.
- Treating browser installation as a way to remove browser memory, filesystem, or lifecycle limits.

## Decisions

### 1. Add a web entry and inject the platform API

Keep the current repository and React/Vite stack. Add a browser-only Vite entry/build with independent output, dependency graph, and TypeScript boundary. Inject the platform API at the React root instead of duplicating `App.tsx` or reading `window.remage` throughout UI components. Keep Electron/preload as the desktop adapter.

Reuse `planResize`, formatting, schema validation, queue/result meanings, and submitted-settings snapshots. Extend capabilities to identify file selection, optional folder intake, output-directory selection, opening destinations, automatic export, download/ZIP, codec availability, and supported metadata policy. Platform actions come from capability data rather than OS-name checks.

Alternatives: a fresh frontend duplicates existing behavior; a monorepo/package split adds packaging work before module boundaries require it; replacing Electron with Tauri does not solve browser codecs. Native imports MUST be absent from the web bundle.

### 2. Use a session file/blob registry and one dedicated processing worker

Browser selection/drop yields `File` objects, never trusted native paths. Keep source handles and validated result bytes in a session-only registry keyed by opaque IDs. Read small headers to check signatures, dimensions, animation/depth/color information before unsafe decode allocations. Retain originals for reprocessing; send transferable job buffers separately so transfer ownership cannot destroy the only original or completed result.

Start with one image job at a time in a dedicated Worker. Bound header parsing, decode/encode duration, result retention, estimated decoded memory, and archive generation. Terminate/reset the active Worker on cancellation/timeouts when required; reject stale worker messages by job/batch identity. Completed validated results survive cancelled work. A worker crash becomes a recoverable per-file error rather than an endless processing state.

Use the proposed admission/ZIP budgets in the roadmap as conservative starting values, then reduce them from weakest-device measurements. Do not carry native limits or concurrency into the browser. Buffers, workers, thumbnails, object URLs, and archives have explicit clear/remove/cancel/unmount cleanup.

Check orientation-normalized source and rounded planned output dimensions/pixels, including enlargement, before allocating decode/resize/encode buffers. Reserve source/output rasters, encoder/WASM/validation scratch space and retained session data together. A small accepted source cannot authorize an arbitrarily large output. Publish a calibrated combined working-set profile; individual encoded-byte caps do not establish total process-memory safety.

Alternatives: main-thread codecs block controls; unbounded pools multiply decoded/WASM memory; durable image storage introduces privacy, quota, and recovery scope not needed for v1.0.

### 3. Separate transformations from strict optimization

Evaluate pinned jSquash PNG/JPEG/WebP and resize modules behind small codec adapters. Their availability is a candidate, not proof of fidelity. Sharp's current optional WASM runtime explicitly does not support browsers: [official installation guidance](https://sharp.pixelplumbing.com/install/#webassembly), inspected 2026-10-08.

Core v1.0 is verified static 8-bit PNG/JPEG/WebP conversion/resize for the supported color/metadata subset. Normalize EXIF orientation before deriving visible dimensions. PNG output avoids palette quantization; JPEG requires explicit loss acknowledgement and chosen alpha background; WebP uses a tested lossless/exact configuration where that capability is exposed. Do not equate encoder losslessness with full source preservation.

Metadata policy is explicit: preservation stays selected by default, and an operation unsupported under that selection fails before processing with a recoverable explanation. A user can explicitly select metadata removal for a transformation; orientation/color information still must be applied correctly. ICC/profile or unsupported color cases are rejected unless correct decode/encode interpretation and output policy are proved. Removing a profile to conceal an unsupported color conversion is not allowed.

Strict optimization accepts original compressed bytes and verifies same format, dimensions, orientation, samples (including hidden transparent RGB), ICC/EXIF and required color information. Accept a candidate only if validated and smaller. A valid non-smaller candidate yields unchanged original bytes; failed validation yields an error. A PNG WASM adapter is included only when this proof passes. Browser JPEG decode/encode is a transformation, never a substitute for native `jpegtran`.

If no strict browser adapter passes, show the Optimizer capability as unavailable with a clear explanation and ship Converter/resize without a false optimizer claim. The exact support subset is recorded before release. Custom JPEG-WASM compilation is deferred.

### 4. Model browser downloads separately from native publication

Extend the shared export receipt/status model with observable outcomes, for example a discriminated union for `native-published`, `download-requested`, `archive-ready`, and `error`. Existing desktop `exported` means successful publication; web code must not reuse it to claim a confirmed save.

Single download uses an explicit user action, validated result Blob, sanitized filename, and controlled object URL lifecycle. Batch export builds one bounded ZIP from completed/unchanged results, with STORE entries to avoid recompressing encoded images, deterministic names/collision suffixes, and visible excluded counts. Reject archives over the output-plus-overhead budget before building them; permit smaller selections. Failed export leaves results available for retry. Downloads cannot guarantee the browser's final destination or collision behavior, so do not promise filesystem-level no-overwrite protection.

Build archives incrementally in a dedicated cancellable Worker. Pause new image scheduling and wait for the active image job to finish or be explicitly cancelled before allocating an archive. The coordinator must reserve retained sources/results/thumbnails, archive output, transfer/temporary copies and archive-Worker scratch space against one calibrated working-set budget, including any idle image Worker's retained WASM heap or terminating that Worker first. Reject before allocation if admission fails, even when the serialized ZIP is below its independent ceiling. Archive cancellation/timeout releases its resources, retains results and resumes queued image scheduling; clear invalidates pending archive work safely.

Folder intake through a directory input is a possible enhancement; arbitrary destination writes and automatic export are deferred. The read-only directory input and write-authorized directory API are distinct: [directory input](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory) has broad recent-browser support, while [directory writing](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) remains limited and permission-dependent (inspected 2026-10-08).

### 5. Make PWA readiness versioned and explicit

Use a manifest and service-worker build integration to cache the shell, local fonts/icons, Workers, and every codec asset required for advertised offline operations. Keep content-hashed assets and a build manifest identifying the compatible UI/Worker/WASM set. Precache the complete set before marking a build offline-ready. Cache only application assets, never selected images, thumbnails, filenames, or result history.

Processing runs in dedicated Workers, not the service worker. Installed PWAs still depend on browser lifecycle and storage. [Service workers](https://web.dev/learn/pwa/service-workers) support cached offline assets, and [storage quotas/eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) prevent promising permanent cache availability (inspected 2026-10-08).

New builds install into separate versioned caches and activate at a user-visible safe point. Do not force `skipWaiting`, reload, or terminate a batch during processing or with retained results the user has not chosen to discard. A download request cannot prove that results are saved, so update confirmation must explicitly preserve/export/discard the session. Coordinate update readiness across open tabs/PWA windows; do not retire assets still needed by a live client. Frozen/unresponsive clients are not assumed to consent; defer destructive activation/cleanup until their safety is established. Failed precache preserves the previous coherent build against app-controlled cache changes, without guaranteeing survival of independent browser eviction.

When a runnable shell exists, missing/evicted assets clear offline readiness and provide reconnect/recovery guidance. Disclose during setup that complete shell eviction can prevent any offline launch; recovery then requires online reopening to restore a coherent asset set. Offline readiness describes the verified cached state, not permanent storage.

Installation UI is browser-specific and progressive: unsupported installation does not block the normal web app. Web v1.0 does not claim processing continues after the browser closes or a mobile OS suspends it.

### 6. Ship a portable static artifact with production evidence

Use static HTTPS hosting with configurable base paths, correct WASM MIME types, and CSP permitting only required same-origin scripts/workers/WASM. Bundle fonts/codecs rather than use runtime CDNs. Single-threaded Worker execution is the baseline; multithreaded WASM/COOP/COEP is deferred until measured benefit justifies header and compatibility work. No image upload endpoint, accounts, analytics, or database is required.

Add web verification commands during implementation; retain existing desktop commands. Validate the exact production artifact in real browser/device/PWA sessions. Hosting provider, URL, icon export sizes, and exact tested browser versions are release-time details, not architecture dependencies. Public deployment remains a separate action.

## Risks / Trade-offs

- **WASM fidelity/maintenance:** Pin exact modules, retain licenses, use real-file corpus, and disable unsupported capabilities. Small adapters reduce codec-library lock-in; no paid API is required.
- **Browser memory/ZIP spikes:** One job, early admission checks, bounded retained results/archives, weakest-device measurements, and recovery after timeouts. Mobile budgets can be lower than desktop-browser budgets.
- **Metadata/color surprises:** No silent stripping or color-profile reinterpretation; explicit policy and rejection before unsupported operations.
- **PWA version mixing/cache eviction:** Complete versioned asset manifests, failed-update fallback, multi-client safe activation, and honest offline readiness/recovery.
- **Browser export limitations:** Report download initiation rather than confirmed filesystem writes; keep downloads/ZIP as core and native directory writing deferred.
- **Shared UI regression:** Keep desktop engine contracts intact and run existing native checks plus desktop smoke evidence after adapter extraction.
- **Component adoption:** Introduce Tailwind v4/shadcn/Radix through a bounded UI slice; inspect resets, aliases and actual registry dependencies. Root design tokens control appearance and primitive APIs retain keyboard/focus behavior. Keep copied source local and maintain its upstream fixes/notices.
- **Icon rights:** Ultimate discovery access is verified, but written public-source rights are outstanding. Keep premium source intake conditional, preserve current local icons and record any deferred migration explicitly. This gate does not expand the release into proprietary blocks/templates or an online runtime dependency.

## Migration Plan

1. Record current desktop baseline; extract injectable UI/platform contracts with unchanged native processing behavior.
2. Prove browser codec/metadata support and select limits before implementing the complete user workflow.
3. Add browser intake, processing, downloads, responsive UI, then PWA lifecycle in that dependency order.
4. Build a web release candidate, verify W-01–W-12, and record the exact support matrix before calling it version 1.0.
5. Preserve the old desktop entry/package commands. Roll back web by serving a previous coherent build; never replace codec assets in place. Keep previous hashed assets long enough for active clients and test rollback for both online and installed users.
6. Begin `expand-desktop-platforms` implementation only after WEB-STABLE evidence is recorded. Planning completion is not release completion.
