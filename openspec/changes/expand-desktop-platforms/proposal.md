## Why

After web/PWA v1.0 passes the WEB-STABLE gate, Ekko wants a desktop edition for large/heavy batches, dependable folder intake and automatic exports, and the existing strict native PNG/JPEG optimizer before browser parity is proved. The repository already has an Electron/native macOS implementation, but cross-platform codecs, heavy-batch qualification, and public-release evidence are incomplete.

## What Changes

- Retain Electron, reuse the stable shared React/domain layer, and keep native processing/filesystem adapters independent from browser WASM and download limitations.
- Qualify heavier local batches with resource/disk budgets, bounded concurrency, codec timeouts, responsive cancellation, and cleanup rather than unbounded intake.
- Harden folder intake and session-authorized automatic exports with source protection, collision-safe publication, truthful saved-file receipts, and retryable failures.
- Prove the existing strict PNG/JPEG contract with a real-file corpus in packaged applications; browser fidelity limitations do not reduce native guarantees.
- Prepare and verify macOS releases first, followed sequentially by Windows and Linux codec bundles/installers on named supported OS/architecture hosts.
- Keep remote image processing, accounts, telemetry, destructive overwrite, watched-folder automation, persistent image libraries, new formats, and a Tauri migration outside this desktop milestone.
- Require recorded WEB-STABLE evidence before implementation starts. This proposal is a deferred plan, not a statement that any desktop release is ready.
- Inherit the root design authority and implemented REUI/font/theme foundation from web; preserve the conditional Motion Icon redistribution gate and any explicit icon migration deferral.

## Capabilities

### New Capabilities

- `desktop-heavy-batches`: Measured native capacity, resource admission, bounded execution/cancellation, strict conformance, and cleanup for heavier workflows.
- `desktop-folder-export`: User-authorized folder intake and reliable automatic publication with collision, link, interruption, and retry protections on each desktop OS.
- `desktop-platform-distribution`: Independently qualified platform/architecture artifacts, bundled offline dependencies, licensing, source-build instructions, and an explicit web-stability dependency.

### Modified Capabilities

None. These additions extend the existing macOS-first workspace and preserve `lossless-optimization`, `image-transform`, and `safe-batch-export` guarantees. They add heavy-workload and non-macOS qualification requirements without changing those baseline contracts.

## Impact

- Existing ownership: `src/main/services/{image-engine,intake,remage-service,output-publisher,preferences-store,capabilities}.ts`, `src/main/index.ts`, and `src/preload/index.ts` remain the trusted native boundary.
- Shared UI/contracts from `release-web-pwa-v1` require platform capabilities and distinct verified native publication receipts.
- Codec fetch/path/probe configuration, `pnpm-workspace.yaml`, package scripts, native assets, release CI, and installer/signing setup need OS/architecture-aware additions.
- `docs/platform-execution-plan.md` defines D-01–D-05 acceptance, platform use-case tradeoffs, rollout order, and proposed workload qualification. `docs/verification.md` remains historical evidence until actual checks are added.
- Native signing/distribution involves platform credentials and possible certificate/developer-program costs; no paid processing API is required. Public publication and signing credentials are separate from writing this plan.
