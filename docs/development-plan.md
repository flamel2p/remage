# Remage phased development plan

Date: 2026-09-09 · Status: planned; macOS-first platform decision confirmed.

Requirements authority: [PRD](product-requirements.md). Technical evidence: [investigation](remage-investigation.md). Implementation status must be proven by actual files and checks; an unchecked phase is not delivered.

## Delivery strategy

Build one useful local product through four dependent phases. Phases are engineering checkpoints, not separate paid tiers. The current user request authorizes development; do not introduce redundant permission gates between phases. Stop only for a material unresolved product decision or an action outside the request, such as public release.

Freeze the platform and codec matrix in an OpenSpec proposal/design/spec/tasks set before selecting the app framework. Each phase must satisfy its gate before the dependent phase is declared complete. Tests may be developed alongside the behavior they verify.

### Ownership

Use the project roster on demand. Product manager owns requirement clarity; technical lead owns architecture and independent technical review; UI/UX designer owns flow and visual review; developer is the sole owner of product changes for the active slice; QA derives observable checks; lead orchestrator reconciles evidence. Independent reviews may run in parallel; overlapping implementation may not.

## Phase 1 — Foundation and local workspace

Outcome: the application opens with Remage's bundled fonts and can inspect a safe, editable local image queue.

Requirements: FR-01, FR-02, queue foundation in FR-07, typography, NFR-06/07/08/10.

Deliverables:

- Complete PRD and confirmed platform/format decisions; OpenSpec artifacts and traceable tasks.
- Reproducible project scaffold, dependency lockfile, lint/typecheck/test/build commands.
- Shared models for inspection, operations, settings snapshots, queue states, capabilities, results, and errors.
- Platform boundary for picking/dropping files, accessing bytes, choosing destinations, and exporting.
- Local font declarations and centralized design tokens; Optimizer/Converter shell.
- Empty drop state, queue rows, source metadata, thumbnails, validation, remove/clear, and keyboard flow.
- Bounded folder traversal and documented file/pixel/queue limits.

Gate:

- Build and static checks pass from documented commands.
- Actual UI displays supplied fonts and both modes at supported minimum dimensions.
- Picker/drop parity, duplicate/corrupt/unsupported input behavior, queue transitions, and validation are verified.
- Adding/removing images leaves original hashes unchanged and releases preview resources.

Dependency: planned Electron/macOS package and adapter selection. Engine/encoding success must not be simulated as delivered behavior.

## Phase 2 — Strict optimizer and safe outputs

Outcome: the application performs useful, verified PNG/JPEG lossless optimization and exports separate files.

Requirements: FR-03, FR-07 execution, FR-08/09 core, NFR-01/02/03/04/05/09.

Deliverables:

- Dedicated adapters using decoded-sample-preserving PNG optimization and coefficient-preserving JPEG optimization, both retaining required metadata. Encoded file bytes are expected to change.
- Explicit handling for orientation, ICC/color metadata, alpha, unsupported depth, and animated/multipage sources.
- Bounded background queue, cancellation, timeout, per-item errors, cleanup, and immutable batch settings.
- Candidate validation, actual byte comparison, unchanged fallback, and truthful summaries.
- Unique output names, atomic/exclusive native writes or platform-appropriate downloads, per-result export, and export failure recovery.

Gate:

- Real fixtures demonstrate decoded/sample/coefficient preservation and relevant metadata retention.
- Already optimized input never becomes a larger “optimized” result.
- Mixed batches, cancelled jobs, duplicate names, and failed writes preserve sources and valid existing results.
- Processing succeeds without a cloud service. Required codec binaries/assets are part of the build rather than an undocumented global-tool prerequisite.

## Phase 3 — Resize, conversion, and optional smaller-file mode

Outcome: one batch workflow can prepare correctly sized assets in the agreed common formats.

Requirements: FR-04, FR-05, FR-06, and completion of FR-07, FR-08, FR-09.

Deliverables:

- Resize off by default; width/height validation, proportional bounding-box fit, exact dimensions, and explicit enlargement behavior.
- Actual preflight/output dimensions with orientation-aware calculations.
- Converter capability matrix and static PNG/JPEG/WebP adapters where agreed and supported.
- Clear lossy controls, transparency background selection, and format-specific preservation disclosures.
- Batch export and retry semantics; results retain submitted settings when current options change.

Gate:

- Every advertised output format is decoded successfully with matching signature, extension, and dimensions.
- Landscape/portrait/bounding-box/exact/no-enlarge cases match the PRD.
- Transparent-to-JPEG output matches the chosen background; no silent animation/page/depth loss occurs.
- Conversion size increases and unchanged optimizer results have correct, distinct summaries.
- User can complete optimize, convert, resize, cancel, recover, and export flows in the actual app.

## Phase 4 — Reliability, documentation, and release artifact

Outcome: a reproducible local release candidate with honest capabilities and evidence.

Requirements: FR-10 and all remaining NFRs; full V1 regression gate.

Deliverables:

- Validated preference persistence and safe recovery from invalid saved settings.
- Accessible focus, keyboard interaction, readable long names, minimum-window layout, reduced-motion behavior, and local font verification.
- Repeated-batch/resource cleanup checks and processing/network inspection.
- README, development instructions, support matrix, troubleshooting, architecture overview, source license decision, and third-party/font notices.
- Platform packaging configuration and actual local packaged artifact; smoke test with bundled codecs/assets.
- Independent technical/UX review; acceptance-to-test traceability and verification report.

Gate:

- All required tests/build checks pass; material review findings are fixed.
- Packaged/release artifact launches and performs a real optimize/resize/convert/export operation on the verified host.
- Unsupported and untested platforms are labeled. Packaging a macOS app does not prove Windows/Linux support.
- No public release claim while signing, license, hosting, or distribution requirements remain unresolved.
- Archive/sync the OpenSpec change only after implemented requirements and verification evidence agree.

## Architecture selection and dependency risks

| Confirmed target | Preferred candidate | Why alternatives rank lower |
| --- | --- | --- |
| macOS-first with future Windows/Linux | Electron + TypeScript UI + sharp/libvips for transformations and dedicated strict adapters | SwiftUI would need a second UI for later platforms; Tauri adds Rust/native codec work before a supported engine exists |
| Multiple desktop systems | Electron + TypeScript UI + sharp/libvips and dedicated lossless adapters | Tauri adds Rust/native integration; browser delivery does not give equivalent filesystem/codec behavior |
| Browser | TypeScript UI + Web Workers/WASM codecs with an explicit fidelity contract | Native sharp is not a browser codec; a server would contradict the local-processing scope |

These are conditional recommendations derived from the investigation, not committed technology choices. No paid processing vendor is required. Codec maintenance, native binary availability, metadata fidelity, platform API changes, and distribution tooling remain dependencies. Keep adapters small, pin versions, and test the exact bundle. Codec/font redistribution notices and native signing must be addressed before publication.

## Verification matrix

| Requirement | Phase ownership | Main acceptance target |
| --- | --- | --- |
| FR-01 | 1 | Stable mode/workspace navigation |
| FR-02 | 1 | Safe and consistent intake/inspection |
| FR-03 | 2 | Proven strict optimization and unchanged fallback |
| FR-04 | 3 | Explicit lossy mode without hidden fallback |
| FR-05 | 3 | Correct dimensions and transformation disclosures |
| FR-06 | 3 | Valid supported format conversion |
| FR-07 | 1–3 | Safe queue transitions, progress, cancellation and recovery |
| FR-08 | 2–3 | Actual result data and correct totals |
| FR-09 | 2–3 | Safe export and preserved originals |
| FR-10 | 4 | Validated settings persistence and local-only operation |

| Area | Automated evidence | Runtime evidence |
| --- | --- | --- |
| Settings/resize math | Valid/invalid dimensions, aspect fit, exact/no-enlarge, snapshot immutability | Intended/actual dimensions displayed correctly |
| Strict optimization | Real PNG/JPEG preservation, metadata, no-larger fallback | UI results and exported files match engine output |
| Conversion | Decode all formats; alpha/background; dimensions/signatures | Format controls and warnings match capabilities |
| Queue | Mixed failures, cancellation, retry, stable settings, cleanup | Responsive progress and recovery |
| Filesystem/export | Collisions, traversal, original hashes, write failures | Picker/destination/export behavior |
| UI/fonts | Build and selected component checks | Actual fonts, keyboard, minimum-size layouts, screenshots |
| Privacy | No configured processing endpoint/remote assets | Network-disabled processing and traffic inspection |
| Distribution | Clean build, packaged assets/codecs | Actual artifact launch and processing smoke test |

Do not add tests solely to mirror implementation. Prefer output bytes, file safety, and observable transitions. Record exact commands once appropriate checks pass; repeat only after relevant changes or unresolved failures.

## Current status

- [x] Inspect reference screenshots and available workspace.
- [x] Investigate lossless semantics, codecs, platform choices, and risks.
- [x] Inventory supplied fonts and assign their intended interface roles.
- [x] Draft complete PRD and four-phase delivery plan.
- [x] Record macOS-first platform choice and settle the executable first-release matrix: strict PNG/JPEG optimization; static PNG/JPEG/WebP resize/conversion.
- [ ] Create and validate the implementation OpenSpec change.
- [ ] Phase 1 implementation and gate.
- [ ] Phase 2 implementation and gate.
- [ ] Phase 3 implementation and gate.
- [ ] Phase 4 implementation and gate.

No product code, runtime verification, or release artifact is reported complete by this planning document.
