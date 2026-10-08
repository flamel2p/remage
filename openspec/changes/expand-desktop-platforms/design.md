## Context

See `proposal.md` for motivation and the user-confirmed dependency on stable web v1.0. The current native implementation already has immutable snapshots, bounded batches, opaque destinations, strict PNG/JPEG adapters, and collision-safe publication. It is macOS-first: `capabilities.ts` selects Darwin resources, `fetch-codecs.mjs` uses DMG extraction/lipo/dylib signing, and `pnpm-workspace.yaml` selects Darwin packages. `docs/verification.md` records arm64 smoke evidence and outstanding signing/Intel/platform checks.

This is a deferred design. Shared adapter/receipt contracts will come from `release-web-pwa-v1`; re-read their implemented versions before applying this change. D-01–D-05 and use-case tradeoffs are defined in `docs/platform-execution-plan.md`.

Root `design.md` owns shared visual rules and its token/local-font assets. Inherit the implemented Radix REUI/shadcn Card foundation and platform-specific actions; verify native viewport, light/dark, focus and Unicode behavior independently. Motion Icon adoption inherits the written public-source redistribution gate and any explicit web deferral, not merely the account's Ultimate entitlement.

## Goals / Non-Goals

**Goals:**

- Use native processing/filesystem control to handle heavier workloads and reliable destination exports while retaining the same UI/domain vocabulary as web.
- Qualify each OS/architecture independently using actual bundled codecs and downloaded application artifacts.
- Preserve originals, strict fidelity, cancellation, retry, bounded resources, and the local/no-account promise.

**Non-Goals:**

- Replacing Electron, forcing the native engine through browser WASM, releasing every architecture simultaneously, watched folders, CLI products, background services, image libraries, auto-overwrite, or introducing remote processing.
- Increasing concurrency or limits just because the runtime is native.

## Decisions

### 1. Keep Electron with independent native engine ownership

Reuse the stable React workspace and pure validation/resize/accounting logic. Electron/preload remains the trusted native adapter; keep codecs, input paths, snapshots, and destination handles in the main process. Review context isolation, sender validation, schemas, CSP/navigation restrictions, and opaque IDs after integration. Browser download receipts and native verified publication stay distinct.

Alternatives: Tauri requires a new shell/native integration without improving the already implemented strict engine; a shared WASM-only engine sacrifices current native proof and capacity; a hosted service contradicts on-device use and adds operations. A single repository does not imply identical processing capabilities.

### 2. Qualify capacity through bounded scheduling and disk spooling

Treat the current 200-item, 100 MiB/file, 512 MiB aggregate-source, 40-megapixel, 16,384-dimension limits and concurrency two as baseline values requiring fresh qualification, not guarantees. Prefer streamed folder enumeration, lightweight queue records, bounded source snapshots/candidates on disk, and per-job decoded-memory reservations. Keep immutable submitted settings and source fingerprint validation.

Publish and enforce both source and planned-output dimension/pixel limits. Before corresponding decode/resize/encode allocations, derive rounded orientation-normalized output dimensions and reserve source/output rasters, native encoder/validation working sets and concurrent retained resources. Enabled enlargement of a small source must not bypass the qualified output or combined-memory budget.

Benchmark one then two active jobs; increase capacity/concurrency only with measured headroom. Define temporary-storage/result retention budgets, disk-space checks, per-codec deadlines, watchdog termination, and explicit cleanup. Cancellation stops scheduling and prevents candidate publication; uninterruptible work reports cancelling until discarded. Validate kill/escalation behavior separately on Windows and Unix-like targets.

Results remain retryable during the session, but are not a persistent library. Clear/remove/exit releases owned snapshots/candidates. Crash leftovers use a namespaced startup cleanup policy that never deletes arbitrary user files; document and test the maximum retention of orphaned private temporary files.

Workload targets in the roadmap are qualification inputs. Failure narrows published support, rather than replacing safe bounds with an unbounded queue.

### 3. Preserve native strict optimization and expand corpus evidence

Keep `jpegtran -copy all -optimize` and preservation-oriented OxiPNG as the native strict paths. Validate same-format dimensions, samples, alpha/hidden RGB, orientation, required ICC/EXIF/color information and no-larger behavior. Use actual oriented/profile/palette/grayscale/progressive fixtures; generated pixel-only tests do not establish the full contract. Test CLI argument/configuration and coefficient-preserving JPEG behavior as well as decoded outputs.

Use the shared corpus for browser/native comparisons, labeling deliberate capability differences. A desktop strict result cannot inherit a browser transformation label or unsupported metadata policy. No release optimization percentage is promised.

### 4. Treat filesystem publication as a platform-specific contract

Keep session-only user-authorized source/destination handles. Native file picker/drop/folder enumeration follows content validation and link/hidden-file boundaries. Directory selection is not persistent broad filesystem authorization. Revalidate destination safety/writability when exporting; test symlink/reparse behavior and path normalization on each OS.

Automatic export uses the submitted destination, safe derived names, temporary publication and exclusive collision-safe finalization. Test the current hard-link strategy on the supported destination filesystem; when unavailable, use an equally source-safe exclusive publication strategy or reject with an actionable retry, never overwrite as fallback. Windows case-insensitive names, reserved names, UNC/network/removable volumes and cross-volume behavior need explicit qualification or exclusion.

Destination authorization must hold during publication, not only at an earlier path check. Exercise destination/link/reparse changes between validation and finalization; a path-based check-then-write alone is not evidence of the no-escape guarantee. Use a platform-qualified handle/publication strategy or reject unsupported cases safely.

Report saved/exported only after verified successful publication. Denied permissions, deleted destinations, disk full, interruption or collision exhaustion preserve the validated candidate and allow a different destination without reprocessing. Preserve native destination-opening through trusted platform APIs.

### 5. Make codec acquisition and distribution OS/architecture aware

Replace Darwin-only resource assumptions with a manifest keyed by OS/CPU containing pinned source URL, checksum, license, executable/library paths and probe command. Bundle codecs and Sharp dependencies built for the target, with no runtime codec download during normal processing. Keep fixed arguments and execute without a shell. Do not reuse a macOS binary for Windows/Linux.

Start qualification with macOS arm64 and Intel x64, then Windows x64, then a declared Linux x64 distribution/filesystem baseline. Additional ARM targets are deferred until they have real-host evidence. Record minimum OS/runtime dependencies at qualification time. Keep installer types intentionally small: existing macOS DMG, one Windows installer, and one verified Linux artifact before adding alternative package channels.

Prepare source-build instructions, checksums, notices, release notes, and matrix builds. Native binary availability, ABI/libc compatibility, Electron/codec patching and distribution trust are ongoing dependencies. No app-store submission or auto-update service is required for the first desktop milestone.

### 6. Release only verified platform artifacts

macOS arm64 evidence does not qualify Intel; packaging on CI does not qualify Windows/Linux. For each target, test the downloaded artifact on a clean supported machine: launch, capability probes, strict corpus, resize/convert, folder intake, automatic export/retry, cancellation, offline operation, and cleanup. Prepare signing/notarization where required for the published distribution path. [Electron code-signing guidance](https://www.electronjs.org/docs/latest/tutorial/code-signing), inspected 2026-10-08, distinguishes unsigned distribution friction from signed/notarized release preparation.

Do not place credentials in source, workflow literals, logs, or artifacts. A missing certificate/host blocks that target's public release without invalidating already verified targets. Native compatibility and fidelity descriptions use the actual released matrix.

## Risks / Trade-offs

- **Release maintenance:** Three OS families and multiple architectures need independent qualification and security updates; sequence releases rather than expand simultaneous work.
- **Capacity/disk pressure:** Native capacity is controllable but finite; spool with budgets, watchdogs, memory reservations and reproducible benchmark evidence.
- **Filesystem differences:** Publication strategy, permissions, links and reserved names vary; verify each supported filesystem and reject unsupported cases safely.
- **Fidelity gaps:** Retain native engine contracts and add real-file proofs; compare browser/native capabilities without claiming identical codecs.
- **Native/vendor dependencies:** Electron, Sharp/libvips, CLI codecs and OS signing are dependencies. Adapters/manifests and reproducible source builds limit lock-in; switching shells adds migration cost and cannot remove OS distribution policy.
- **Credentials/trust:** Smooth Windows/macOS distribution may require paid signing identities/developer enrollment. Plan release preparation separately from code implementation and label unsigned development artifacts accurately.

## Migration Plan

1. Verify WEB-STABLE and re-read the implemented shared contracts; keep the last web/native artifacts available.
2. Integrate the native UI adapter, qualify strict fidelity and capacity, and harden folder/publication behavior on macOS.
3. Complete macOS arm64/Intel downloaded-artifact gates before advertising those targets.
4. Add Windows codec/installer support and qualify it; then repeat for a declared Linux baseline. A failed target stays unavailable while verified targets can proceed.
5. Version native application and codec manifests together. Rollback uses the previous complete installer/bundle; never replace a codec inside an installed app independently.
6. Run shared web regression checks after native/shared changes. Archive only after advertised targets have D-01–D-05 evidence; record deferred targets without implying completion.
