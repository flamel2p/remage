# Remage product requirements

Version: 1.0 draft · 2026-09-09

## 1. Document status and authority

This is the complete proposed V1 product contract. Requirements describe intended behavior, not implemented features. Ekko confirmed a macOS-first desktop release on 2026-09-09, with Windows/Linux versions required in the future. The code architecture therefore preserves cross-platform boundaries, while this V1 change produces and verifies macOS only.

Sources, in priority order:

1. Ekko's requests: build an open-source image optimizer and format converter named Remage; support width/height resizing; write full requirements and phased plans; use the supplied `assets/fonts/` files.
2. The supplied `optimizer.png` and `converter.png`, inspected as interaction references.
3. [Investigation](remage-investigation.md): source-grounded codec capabilities, platform alternatives, preservation pitfalls, and initial acceptance criteria.
4. This PRD and [delivery plan](development-plan.md). An active OpenSpec change will record the executable implementation scope after platform selection.

When implementation reveals an unsupported preservation guarantee, update the documented support boundary explicitly; do not silently relabel lossy output as lossless. Actual implementation and test status belongs in the delivery plan and verification record.

## 2. Product purpose

Remage is a private, local image utility that makes image files smaller, changes their dimensions, and converts their formats. Users should complete a batch without understanding individual codec commands or risking their original files.

Primary audience assumption: developers and designers preparing assets for websites and applications. Secondary audience: people reducing image sizes for sharing or storage. These are working personas, not validated market research.

Primary job: “I have several images. Help me prepare smaller, correctly sized files in the format I need, tell me what changed, and keep my originals safe.”

### Product outcomes

- A new user can add files, understand the settings, process them, and locate the outputs in one workspace.
- Every optimization claim is supported by actual byte counts and a defined quality contract.
- Common batches run entirely on the user's device without sign-in, uploads, paid APIs, or recurring infrastructure costs.
- Contributors can build, test, and understand the project through documented commands and bounded modules.

No fixed compression percentage is a product promise. Savings depend on source content and encoding. Performance measurements must name the hardware, fixture corpus, settings, and build.

### Business and distribution assumptions

V1 is a free open-source utility. There are no paid tiers, accounts, subscription checks, or Upgrade actions. Monetization is outside the current request. Distribution and source-code license are separate decisions: a runnable local build can be developed before publication, but public releases need an explicit project license and bundled dependency/font notices. No store submission, paid developer enrollment, or public publishing is implied by local development.

## 3. Scope and release boundary

### V1 requirements

- Optimizer and Converter modes in a single workspace.
- Local multi-file intake, drag-and-drop, and folder intake where the selected platform supports it.
- Batch queue, inspection, thumbnails, validation, progress, cancellation, per-file errors, retry, and removal.
- Strict lossless optimization for supported static PNG and JPEG inputs.
- No optional lossy optimizer in V1. Strict optimization is the optimizer contract; resize and conversion disclose their own transformations.
- Optional proportional or exact width/height resize in either mode.
- Converter core: static PNG, JPEG, and WebP. Codec support must be demonstrated by the selected macOS build, with a separate input/output matrix.
- Output destination, safe file names, per-file export, completed-batch export, and accurate summaries.
- Supplied local fonts; keyboard accessibility and usable minimum-size layouts.
- Reproducible setup, engine tests, UI checks, and a packaged/release-artifact smoke test.

### Conditional or future scope

- AVIF and HEIC are deferred. HEIC import is not equivalent to AVIF support and requires a tested native/codec path before it can be advertised.
- Windows/Linux releases depend on platform selection and validation on those systems.
- Animated GIF/APNG/WebP, multipage TIFF, high-bit-depth/HDR processing, camera RAW, PSD/AI layers, ICO, and vector optimization require explicit later contracts. Until supported, reject these inputs clearly rather than flattening or reducing them silently.
- No crop/editor, AI enhancement, background removal, cloud storage, remote URLs, watched folders, automatic overwrite, persistent image library, CLI product, or plugin system in V1.

## 4. Product terminology and invariants

| Term | Meaning |
| --- | --- |
| Source | Original file selected by the user; never modified by Remage |
| Queue item | One source and its inspection/processing state |
| Batch | Queue items submitted with one immutable settings snapshot |
| Candidate | Temporary processed bytes, not yet a published output |
| Result | Validated candidate or an unchanged original selected by the optimizer |
| Export | Writing/downloading a result under a safe output name |
| Lossless optimization | Same-format optimization without changing supported image content, dimensions, orientation, transparency, or rendering-relevant color information |
| Lossy optimization | Explicitly authorized re-encoding that may reduce image information |
| Resize | A transformation of pixel dimensions; it is never advertised as preserving all original detail |
| Unchanged | No valid smaller result was selected for same-format, original-size optimization |

Invariants:

1. Source bytes never change.
2. UI progress and byte savings describe observed results, not estimates presented as results.
3. No candidate with the wrong format, invalid dimensions, or failed integrity validation becomes a successful result.
4. An unsupported input produces an actionable error without stopping unrelated valid items.
5. Settings changes cannot mutate or mislabel an already submitted batch.
6. Lossless means the complete processing path preserves the stated content; an encoder flag alone is insufficient.
7. No claimed capability appears as enabled until its adapter is available in the running build.

## 5. User flows

### Flow A: optimize a batch

1. Open Remage in Optimizer mode, strict lossless selected, resize off.
2. Choose/drop files or a folder. See inspected source dimensions, format, and size.
3. Choose an output destination or the platform's export flow. Review optional compression and resize settings.
4. Select Optimize images. Capture settings and process eligible items in a bounded background queue.
5. See completed/total progress and per-file completed, unchanged, cancelled, or error status.
6. Inspect actual output sizes and savings. Save successful results and locate the destination.

### Flow B: convert and optionally resize

1. Select Converter; add or reuse unprocessed sources.
2. Select an available output format. Show format-specific controls and warnings.
3. Optionally enable resize, enter dimensions, and choose proportional fit or exact dimensions.
4. Select Convert images. Process using one settings snapshot.
5. Save/download validated outputs. A larger converted file is a valid result and displays its size increase.

### Flow C: recover from mixed results

1. A batch contains valid, corrupt, and unsupported sources.
2. Valid items complete; failures retain source identity and readable reasons.
3. The user may remove failed queue entries or retry eligible failures using the original batch settings. To apply new settings, explicitly requeue from the source.
4. Batch export includes only successful/unchanged available results and states how many were excluded.

## 6. Functional requirements

### FR-01 Workspace and navigation — Phase 1

- Keep Optimizer/Converter visible and keyboard operable.
- Mode changes never discard sources or completed results without a clear user action.
- Show empty, ready, processing, mixed-result, and completed states.
- Existing results retain their original operation and settings, even when the active mode changes.
- Disable conflicting run actions while processing; adding future work must not alter the active snapshot.

### FR-02 Intake and inspection — Phase 1

- File picker and drag/drop use the same intake/validation pipeline.
- Folder traversal is bounded, skips symlinks and hidden/system files, and reports unsupported entries without following cycles.
- Detect supported formats from content, not merely filename extensions or browser MIME strings.
- Inspect dimensions, orientation, alpha, bit depth, animation/page count, and byte size before processing.
- Display a thumbnail generated independently from the export-quality path. A thumbnail is never the processing source.
- Suppress repeated intake of the same source only within the pending queue and explain skipped duplicates. Explicit requeue creates a new item linked to the original source and preserves earlier results. Distinct files sharing a basename remain distinct.
- Proposed limits: 200 items per batch, 100 MiB per file, 40 million decoded pixels per image, dimensions up to 16,384 pixels, and 512 MiB of aggregate source bytes per queue. Confirm these with actual memory measurements; exceeding a limit must produce a clear message before large allocation. If an item exceeds remaining capacity, retain previously accepted items and report that item as rejected.
- Native codec timeouts and malformed-file handling must prevent one input from hanging the entire application.

### FR-03 Strict lossless optimization — Phase 2

- Default to original format and original dimensions; no JPEG re-encoding, quantization, chroma conversion, or hidden transparent-RGB changes in strict mode.
- PNG path preserves decoded samples, alpha, orientation, and color interpretation for the supported subset; reversible encoding reductions are allowed.
- JPEG path uses coefficient-preserving optimization and retains rendering-relevant markers/metadata.
- Preserve metadata by default. Any optional removal is explicitly selected and preserves information necessary for correct rendering.
- Compare the validated candidate with the original. If the candidate is not smaller, select the original and report “No size reduction” or “Already optimized.”
- Compression effort may trade processing time for savings; it must not change the quality contract.
- Unsupported bit depth, animation, or color models are rejected explicitly or handled through a separately verified adapter.

### FR-04 Optional lossy optimization — Phase 3, proposed default

- User must explicitly select the lossy mode. The app never silently falls back from strict mode.
- Quality applies only to relevant encoders and uses a documented bounded scale; it is not a percentage of preserved quality.
- Before running, state that recompression changes image data.
- Same-format, original-size output still uses the no-larger fallback. Resized/converted output must fulfill the requested transformation even when it is larger.
- Repeat processing always starts from the original source, not a previously lossy result.

### FR-05 Resize — Phase 3

- Resize is off by default and available in both modes.
- Accept positive integer width/height; reject zero, negatives, decimals, non-numbers, and over-limit values.
- With aspect ratio locked, one dimension derives the other; two supplied dimensions describe a containing box. Fit inside it without cropping.
- With aspect ratio unlocked, both dimensions are required and define exact output dimensions. Warn that proportions may change.
- Do not enlarge by default. If requested bounds exceed the source, the app must explain the resulting dimensions. Exact-dimension mode must reject conflicting enlargement requests unless enlargement is explicitly enabled.
- Apply EXIF orientation before calculating visible dimensions. Remove/reset the orientation marker consistently after a transformed raster is encoded.
- For proportional fit, calculate scale from the supplied bounds and clamp it to at most 1 when enlargement is off. Round each scaled dimension down to a whole pixel, with a minimum of 1 pixel; for a single supplied dimension, use that dimension exactly unless the no-enlargement constraint applies, and floor the derived dimension. Account for this integer rounding in preview and verification.
- Show intended dimensions before processing and actual dimensions in the result.
- Selecting resize changes the quality statement to “Resized”; it cannot retain “Original image data preserved.”
- Enabling resize exits the strict original-dimension optimizer path and uses the transformation pipeline. When the destination is JPEG, display a visible JPEG re-encoding/loss warning and applicable quality setting before allowing the run. A lossless PNG/WebP encoder may preserve the resized raster, but the result is still a transformation of the original. Disabling resize restores the selected optimizer mode; no hidden lossy fallback is permitted.

### FR-06 Format conversion — Phase 3

- Display separate supported import and output formats. The running build's capabilities are authoritative.
- PNG output is losslessly encoded without palette quantization by default.
- JPEG output is labeled lossy; transparent input uses a visible, selectable background, default white.
- WebP supports explicitly named lossy/lossless options if available. Strict transparent-RGB preservation needs exact handling in addition to a lossless encoder option.
- AVIF encoding is labeled according to its actual configuration; do not offer a universal “lossless” guarantee without a verified end-to-end path.
- Conversion can increase bytes. Report increases without treating them as processing errors.
- Output signature, MIME/type, extension, dimensions, and selected encoder must agree.
- Same-format conversion remains an explicit re-encode operation; direct users to Optimizer when their goal is strict same-format optimization.
- Unsupported animation, layers/pages, depth, or color data cannot be discarded silently.

### FR-07 Queue execution and cancellation — Phases 1–3

- State model: inspecting → ready → queued → processing → completed/unchanged/error/cancelled.
- Export is tracked separately from processing so an export failure does not erase a valid result.
- Invalid transitions and duplicate run submissions are prevented.
- Process with bounded concurrency; expensive codecs do not run on the interface thread.
- Cancel stops future items and attempts to terminate active processing safely. Never mark an incomplete output successful.
- Completed results remain available after cancellation. A worker/process adapter should terminate active work; an adapter that cannot interrupt a codec immediately must display “Cancelling” until it safely finishes, discard its uncommitted candidate, and then mark the item cancelled. Do not start another queued item in that interval.
- Per-file failures identify the source, operation, and recoverable action. Do not show raw stack traces as product messages.
- Removing/clearing a queue item releases temporary memory/resources and never deletes source files.
- Closing with active work or unsaved results requires a clear warning where the platform supports it.

### FR-08 Results and summaries — Phases 2–3

- Show original/output size, dimensions, source/target format, operation, status, and export availability.
- Savings = source bytes minus selected result bytes; percent = savings/source bytes × 100.
- Aggregate totals include only completed/unchanged results with matching source totals; errors and cancellations are counted separately.
- Display units consistently as binary KiB/MiB with exact bytes available. Preserve negative savings for larger conversions.
- A successful 0-byte output is impossible. Missing or invalid output is an error.
- Long filenames remain distinguishable and are fully discoverable by keyboard and pointer.

### FR-09 Output safety and export — Phases 2–3

- Always write separate outputs. Suggested suffixes: `-optimized`, `-resized`, `-converted` with the correct extension.
- Resolve collisions with numeric suffixes; do not overwrite an existing source or output, including repeated exports.
- Native output uses exclusive/atomic publication from temporary storage where supported. Failure/cancellation removes incomplete artifacts.
- Paths originate from user-authorized file/destination selection; filenames cannot escape the destination.
- Offer export per result and for all eligible results. Browser delivery uses downloads/ZIP if native destination access is unavailable, documented as a platform adaptation.
- Export failures preserve available results and expose retry. Successful publication is not inferred from completed encoding alone.

### FR-10 Settings and privacy — Phase 4

- Persist small validated preferences where appropriate: mode, encoder settings, resize configuration, and appearance.
- Do not persist image bytes, image history, or source paths without a separately specified need. Native destination access may require re-selection on restart.
- Start safely if stored settings are corrupt or incompatible with the running version.
- No network request is required to process an imported image. Fonts and codec assets ship locally.
- No analytics, remote font service, image uploads, or automatic update/publishing service in V1.

## 7. Typography and visual requirements

The supplied files are authoritative visual assets:

| File | Role |
| --- | --- |
| `assets/fonts/atkinson-hyperlegible-next.woff2` | Navigation, headings, controls, labels, filenames, body copy; normal variable weight 200–800 |
| `assets/fonts/atkinson-hyperlegible-next-italic.woff2` | Intentional italic explanatory text; italic variable weight 200–800; never the sole error cue |
| `assets/fonts/lilex.woff2` | File sizes, dimensions, percentages, compact format labels, technical identifiers; normal variable weight 100–700 |

- Load bundled fonts locally. The ranges above were verified from local WOFF2 name/fvar tables during this task. Use Atkinson 400/500/600/700 and Lilex 400/500; do not invent unavailable styles.
- Atkinson is the primary family; Lilex is a restrained data face rather than the default body font.
- Native UI frameworks may need a compatible local font container; preserve source files and document any derived asset. Font licensing must permit redistribution before a public release.
- All three fonts' embedded metadata points to the Open Font License website, but accompanying license files were not supplied. Match and include the actual upstream notices before distribution; do not infer complete redistribution evidence from that URL alone.
- Target 16px body text, 14px desktop result rows, secondary text at least 13px, and 20–24px section headings. Verify 200% text scaling, missing-glyph fallbacks, and long Unicode filenames in the actual UI.
- Keep the reference's two-mode structure and generous empty drop area. A populated workspace prioritizes readable results and settings.
- Use Remage branding and original line icons, with a restrained purple/slate palette, semantic colors, and explicit focus/error/success states.
- No copied rocket, Upgrade action, fake browser traffic lights, or external service terms.
- Use centralized design tokens for typography, color, spacing, radii, and motion. Minimum normal-text contrast 4.5:1; large-text/UI component contrast as applicable.
- Respect reduced motion, native keyboard conventions, system text scaling where available, and a minimum desktop viewport/window content area of 800 × 600. If browser delivery is selected, also support a 375-pixel layout without horizontal page overflow.

## 8. Non-functional requirements

| ID | Requirement | Verification |
| --- | --- | --- |
| NFR-01 | All processing occurs locally | Observe representative operations with network access unavailable and inspect network activity |
| NFR-02 | Interface remains interactive during a batch | Interact with cancellation/navigation while processing a representative large fixture |
| NFR-03 | Resource use is bounded | Test limits, queue concurrency, cancellation, cleanup, and repeated batches |
| NFR-04 | Sources cannot be overwritten through normal or invalid inputs | Hash originals before/after; duplicate-name and destination traversal tests |
| NFR-05 | Codec failures are isolated and understandable | Corrupt/unsupported/timeout and unwritable-destination cases |
| NFR-06 | No renderer-to-shell or unrestricted filesystem bridge | Platform-specific boundary review, validated commands, safe process invocation |
| NFR-07 | Primary flow is keyboard accessible | Actual picker, settings, run, cancel, result, and export checks |
| NFR-08 | Release is reproducible | Documented clean install, lockfile, build, tests, artifact smoke test |
| NFR-09 | Support claims match packaged capabilities | Decode/encode fixture matrix in the actual artifact |
| NFR-10 | Dependencies remain replaceable at the application boundary | Codec adapters and filesystem integration separated from UI/state logic |

## 9. Acceptance criteria and release gate

V1 is complete only when every in-scope requirement has evidence. A preview UI, passing typecheck, or successful development build alone is insufficient.

Required fixture coverage: compressible and already optimized PNG/JPEG, transparent RGB under zero alpha, EXIF-rotated JPEG, ICC-tagged images, portrait/landscape/tiny images, extension-content mismatches, corrupt images, duplicate basenames, invalid dimensions, oversized sources, unsupported animation/high-depth inputs, and every supported conversion output.

The final verification record must report:

- Exact commands and pass/fail results for engine, state, integration, build, and UI checks.
- Dimensions and pixel/coefficient/metadata comparisons supporting strict optimization claims.
- Compression results from actual byte counts without selected best-case marketing claims.
- Screenshots of empty, populated, processing/result, and error states using bundled fonts.
- Manual/runtime verification boundaries, supported operating systems/architectures, and untested targets.
- Remaining defects and explicit release blockers. A phase cannot pass while its required behavior is only mocked or disabled.

## 10. Decisions requiring an answer

1. macOS desktop is the V1 target; Windows and Linux are future releases, not V1 artifact claims.
2. V1 uses strict PNG/JPEG optimization and static PNG/JPEG/WebP transformation. AVIF, HEIC, broad screenshot-format parity, and optional lossy optimization need a future approved capability change.
3. Project license, distribution identity, signing/notarization, and public hosting are release decisions; they do not block authoring/testing local source but must be settled before publication.

Detailed sequencing, ownership, dependencies, and test gates: [Development plan](development-plan.md).
