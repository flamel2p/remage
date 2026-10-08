## 1. Baseline and release contracts

- [ ] 1.1 Record the current native typecheck/lint/test/build and macOS workflow baseline with exact host/artifact evidence; preserve unrelated work and existing native contracts.
- [ ] 1.2 Reconcile the old macOS-first PRD with this web v1.0 scope and record proposed defaults, supported format/metadata policy, browser/PWA matrix, and W-01–W-12 evidence locations.
- [ ] 1.3 Prepare licensed real-file fixtures covering orientation, ICC/EXIF, alpha/hidden RGB, palette/grayscale, progressive JPEG, animation/depth, corrupt files, efficient originals, and conversions that increase bytes.

## 2. Shared platform seam and browser build

- [ ] 2.1 Inject the platform API into the React entry/workspace and replace direct component calls to window.remage without changing native engine behavior.
- [ ] 2.2 Add platform operation/file/export/metadata capabilities and distinct browser download versus native publication receipts; keep raw paths out of shared UI state.
- [ ] 2.3 Add the browser entry, Vite configuration, isolated output/scripts, and TypeScript/import boundaries; verify no Electron/Sharp/Node native dependency enters the web build.
- [ ] 2.4 Prove the existing Electron entry, settings, native run, and export remain functional after extraction before proceeding.

## 3. Codec and metadata feasibility gate

- [ ] 3.1 Evaluate and pin browser inspect/decode/resize/PNG/JPEG/WebP adapters, their notices, WASM asset loading, initialization failures, and baseline single-thread execution.
- [ ] 3.2 Prove all core supported PNG/JPEG/WebP conversions with signature/dimension/orientation/background and encoder-configuration checks; reject unsupported animation/depth/color before unsafe processing.
- [ ] 3.3 Prove default metadata preservation or explicit unsupported-policy handling and user-selected removal without misinterpreting ICC/color information.
- [ ] 3.4 Evaluate strict PNG against the preservation corpus using original compressed bytes; record verified subset or disable the capability. Keep strict JPEG unavailable unless independently proved without decode/re-encode.
- [ ] 3.5 Benchmark named laptop/phone fixtures at proposed boundaries and select documented admission/result/ZIP budgets; gate the workflow on core transform feasibility rather than assumed codec availability.

## 4. Browser intake and session registry

- [ ] 4.1 Implement equivalent picker/drop validation, content-header inspection, bounded parsing, mixed-input errors, and duplicate-source identity rules without native path assumptions.
- [ ] 4.2 Implement opaque session source/result handles, original-byte reprocessing, settings-only persistence, and actionable empty/unavailable/loading states.
- [ ] 4.3 Enforce count/source/result and source/planned-output dimension/pixel budgets plus combined working-set reservations before corresponding allocations; release resources on remove/clear/unmount and expose session-loss guidance.

## 5. Worker jobs and transformation execution

- [ ] 5.1 Implement a typed versioned Worker job protocol with immutable submitted settings, one active image job, job/batch identity, and transfer ownership that preserves retained originals/results.
- [ ] 5.2 Implement the verified conversion/resize adapters and output validation, including EXIF-normalized dimension planning, pre-allocation planned-output/working-set admission, JPEG acknowledgement/background, and larger-output accounting; verify small-source oversized-enlargement rejection.
- [ ] 5.3 Implement strict optimization only for the supported proven subset with full validation/no-larger unchanged behavior and non-exportable invalid candidates.
- [ ] 5.4 Implement queued/active cancellation, stale-message rejection, bounded execution, Worker reset, and failure/retry while retaining completed results.
- [ ] 5.5 Verify actual mixed-batch accounting, settings isolation, source requeue, timeout recovery, and repeated resource teardown with observable behavior tests.

## 6. Browser downloads and ZIP

- [ ] 6.1 Implement single-result Blob downloads with safe format-correct names and download-requested receipts instead of confirmed-saved status.
- [ ] 6.2 Implement eligible-result selection and incremental cancellable ZIP creation in a dedicated Worker with deterministic collision-suffixed STORE entries, excluded counts, and matching validated result bytes.
- [ ] 6.3 Pause new image scheduling, wait for active work to finish or be explicitly cancelled, and enforce serialized archive plus combined retained/transient working-set budgets including idle image-Worker WASM memory or terminate that Worker before allocation; support smaller selections, cancellation, cleanup, scheduling resumption and retry without reprocessing.
- [ ] 6.4 Verify Unicode/traversal-like/duplicate names, empty selections, incorrect output rejection, archive failures, below-size/over-memory rejection, responsiveness/cancellation during archive creation, and actual browser download contents.

## 7. Responsive and accessible workspace

- [ ] 7.1 Introduce reviewed/pinned Tailwind v4/shadcn/Radix and selected free REUI source with radix-nova/Card consistency; migrate the shared renderer to root design.md, its local font declarations and complete REUI theme tokens, reviewing native reset/alias effects and retaining notices/provenance.
- [ ] 7.2 Remove the web 800px minimum-width constraint and adapt header, settings, queue/result rows, modal, touch targets, and fixed actions for 375px through desktop layouts using the design authority.
- [ ] 7.3 Replace desktop destination/open-folder controls with browser download actions and clear capability/fidelity/metadata/session wording; provide a useful Converter default when strict optimization is unavailable.
- [ ] 7.4 Verify both themes, font roles/weights/Unicode fallbacks, composed contrast, keyboard-only flow, screen-reader status, dialog focus return, long filenames, 200 percent zoom, reduced motion, and mixed-result recovery in real target browsers.
- [ ] 7.5 Record the written Motion Icon public-source/fork/distribution rights and applicable notices before premium intake; if available, adopt reviewed outline static/motion icons and verify semantics/reduced motion. Otherwise record explicit deferral with existing local icons and qualify that released scope without claiming premium adoption.

## 8. PWA installation and offline assets

- [ ] 8.1 Add manifest, icons, build identity, browser-specific install guidance, and ordinary-browser fallback without requiring installation.
- [ ] 8.2 Precache the complete compatible shell/fonts/Workers/WASM set with a version manifest; report partial setup versus complete offline readiness.
- [ ] 8.3 Keep user-selected data out of caches and persistent storage; verify preferences contain settings only.
- [ ] 8.4 Prove every advertised format/download workflow offline after reload and installed-app restart while required assets remain cached; verify codec eviction with a runnable shell, disclose complete shell eviction preventing offline launch, and test online restoration/partial-install recovery.

## 9. Safe updates and static deployment preparation

- [ ] 9.1 Implement waiting-build notification and safe explicit activation that does not discard active batches or retained results; coordinate readiness across open clients.
- [ ] 9.2 Verify failed precache, mixed-version prevention, old-client asset retention including frozen/unresponsive clients, session-aware update handling, and rollback to a coherent earlier build; distinguish app-controlled cache preservation from independent browser eviction.
- [ ] 9.3 Prepare portable HTTPS hosting/build instructions, base-path/WASM MIME/CSP requirements, same-origin bundled assets, and candidate security headers without a processing backend.

## 10. Production release and stability evidence

- [ ] 10.1 Add meaningful browser/PWA integration coverage and verification commands; run typecheck/lint/native tests/build and web tests/build for the release candidate.
- [ ] 10.2 Run W-01–W-12 on real Chrome/Firefox/Safari, Edge smoke, Android Chrome, iPhone Safari, and the declared installed-PWA combinations; record exact versions/devices/artifact.
- [ ] 10.3 Run source/planned-output/combined-working-set boundaries, oversized enlargement and archive-memory rejection cases, and 20 mixed batch cycles with at least five cancellation cycles on each supported browser engine; record resource cleanup and weakest-device timing/memory evidence.
- [ ] 10.4 After the release publication action is authorized, verify the served production artifact's processing, downloads, privacy, installation, offline reopening, update, and rollback flows.
- [ ] 10.5 Publish version 1.0 scope, limitations, measured budgets, MIT/dependency/font notices, contribution/setup guidance, and manual reproducible issue-report templates without telemetry.
- [ ] 10.6 Resolve blocking QA/technical review findings, record WEB-STABLE with W-01–W-12 evidence, and only then sync/archive this change and make the deferred desktop implementation eligible to begin.
