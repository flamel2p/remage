# Remage investigation and provisional delivery plan

Date: 2026-09-09

Status: discovery complete for the core workflows; platform, quality modes, and first-release format scope await Ekko's answers. No product code exists yet. This document is research and a proposed plan, not an approved OpenSpec change or evidence of implemented behavior.

## Sources of requirements

- Ekko's request: an open-source project named Remage with image size optimization without quality loss, width/height resizing, and image format conversion.
- Local references: [`optimizer.png`](../optimizer.png) and [`converter.png`](../converter.png), visually inspected.
- Local project instructions: [`AGENTS.md`](../AGENTS.md). The workspace contains agent configuration and an empty OpenSpec setup; no existing application, package manifest, or active change was found.
- Independent product/UX and technical-lead investigations informed the proposed scope below.

The screenshots show a top Optimizer/Converter switch, a large file/folder drop area, a queue count, bottom controls, and a conversion format selector. They do not establish the intended technology, distribution platform, or a requirement to support every listed format. The footer references an ImageOptim service. The official ImageOptim product describes a different free macOS utility, with lossless defaults and an optional lossy mode. Remage should use its own branding and artwork. [Official ImageOptim](https://imageoptim.com/mac)

## Product contract

Recommended audience: developers, designers, and people preparing images for websites, apps, sharing, or storage. This audience is an assumption, not a confirmed business requirement. The requested product is an open-source utility; no monetization, account system, or paid service is assumed.

1. Process files locally. No image uploads, hosted processing service, telemetry, or account requirement.
2. Preserve originals. Write separate outputs with collision-safe names.
3. Keep the screenshots' two primary workflows and batch-oriented interaction.
4. Default to lossless optimization at original dimensions. If a valid candidate is not smaller, retain the original and report that no reduction was achieved.
5. Treat resize and format conversion as distinct transformations, with truthful quality and transparency disclosures.
6. Show actual input/output bytes, dimensions, format, status, and savings, including size increases after conversion.

## Quality definitions

| Operation | Proposed guarantee | Limitation |
| --- | --- | --- |
| Lossless optimization | Preserve image content, dimensions, orientation, transparency, and rendering-relevant color information | Already optimized files may not become smaller |
| Optional lossy optimization | User explicitly accepts re-encoding for smaller output | No universal claim that quality or appearance is unchanged |
| Resize | Honor the selected dimensions and aspect-ratio behavior with high-quality resampling | Changes pixels and can remove detail |
| Conversion | Produce a valid file in the selected supported format | File size can increase; target formats differ in transparency, color, bit depth, and animation support |

JPEG quality 100 is not a substitute for lossless JPEG optimization. The strict path should preserve encoded coefficients through a tool such as jpegtran, avoiding a decode/re-encode cycle. PNG optimization should preserve transparent pixel data as well as visible pixels; oxipng's optional alpha optimization changes RGB under full transparency and should remain disabled for a strict contract. [libjpeg-turbo usage](https://github.com/libjpeg-turbo/libjpeg-turbo/blob/main/doc/usage.txt), [oxipng](https://github.com/oxipng/oxipng)

Metadata requires an explicit policy. Proposed default: preserve metadata and color interpretation in strict optimization; offer safe removal separately. Never strip orientation or color profiles blindly. Resize/conversion must normalize orientation and update dimensions consistently. Do not silently flatten animation, discard additional pages, or reduce high-bit-depth/HDR inputs without a supported, disclosed transformation.

## Pending decisions

Questions were sent to Ekko during discovery; no answers have been recorded yet.

| Decision | Recommended starting point | Why it matters |
| --- | --- | --- |
| Platform | macOS desktop first for the supplied app-style workflow | Determines UI technology, codecs, file/folder handling, packaging, and platform tests |
| Quality modes | Lossless default plus explicitly optional lossy mode | Determines optimizer controls and acceptance criteria |
| Format scope | Common formats first: PNG, JPEG, WebP, AVIF; HEIC import only with a tested supporting backend | Matching RAW/PSD/AI and the full screenshot list adds substantial decoding, fidelity, and packaging work |

## Architecture options

These are alternatives, not a final technology decision. The selected platform must settle the choice before implementation.

| Approach | Fit | Pitfalls and dependency risks |
| --- | --- | --- |
| Electron + TypeScript UI + sharp/libvips + dedicated lossless adapters | Provisional preference if multiple desktop platforms are required; one UI and processing contract | Larger runtime, regular Electron security updates, native binary packaging per OS/CPU, codec-specific metadata handling |
| SwiftUI + ImageIO + dedicated lossless/format libraries | Strong option if macOS-only is confirmed; native file dialogs, window behavior, and image integration | Apple platform coupling; ImageIO alone does not prove strict optimization or all desired encoders; extra libraries still need packaging |
| Tauri + Rust processing adapters | Smaller desktop shell and explicit native boundary | More Rust/C codec integration and cross-platform build work; Rust tooling is not installed in the inspected environment |
| Browser + Web Workers + WASM codecs | No desktop installation and convenient local processing | Browser memory, folder access, metadata/color fidelity, and codec support require narrower guarantees and separate verification |

For a native macOS implementation, query ImageIO's source and destination types at runtime; decoding support does not establish encoding support. Apple's guide documents these capability queries but is archived, so current format behavior still requires tests on the minimum supported OS. [ImageIO capability discovery](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/ImageIOGuide/imageio_basics/ikpg_basics.html)

Tauri's smaller shell uses the operating system's webview, trading a bundled browser for platform-specific rendering behavior. Codec dependencies remain additional work regardless of shell size. [Tauri architecture](https://v2.tauri.app/concept/architecture/)

sharp provides documented JPEG, PNG, WebP, AVIF, TIFF, GIF, and SVG-input support with its common prebuilt binaries. HEIC support must not be inferred from AVIF support. Native packages need explicit Electron packaging treatment and target-architecture verification. [sharp installation](https://sharp.pixelplumbing.com/install/)

sharp exposes metadata controls and separate lossy/lossless output options. Encoding a lossless format alone does not prove the entire decode-transform-encode pipeline preserved source information. [sharp output options](https://sharp.pixelplumbing.com/api-output/)

An Electron implementation should use isolated, sandboxed rendering, a narrow validated IPC contract, blocked external navigation, and local packaged UI assets. Processing should run away from the UI thread with bounded concurrency and resource limits. These are concrete engineering requirements, not a guarantee supplied by the framework. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security)

jSquash is an available browser/Web Worker WASM codec family to evaluate if browser delivery is selected. Its existence does not establish a coefficient-preserving JPEG optimizer or full metadata fidelity. [jSquash project](https://github.com/jamsinclair/jSquash)

All approaches can avoid a paid image-processing API. Remaining external dependencies are codec/library maintainers, build tooling, and platform distribution requirements. Pin versions and keep processing behind tested adapters. Determine Remage's license before publication and preserve the actual notices and redistribution requirements of bundled dependencies; a wrapper package's license is not sufficient evidence for every bundled codec.

## Proposed user experience

- One Remage window with an Optimizer/Converter segmented control.
- Empty state: large drop target, visible Choose images action, optional Choose folder action, and an accurate supported-format list.
- Populated state: compact batch list with thumbnail, filename, dimensions, original bytes, result bytes, status, and output action.
- Settings: mode-specific compression/format controls; shared optional resize controls; output destination.
- Explicit Optimize images or Convert images action captures a settings snapshot for that batch.
- Resize defaults to proportional fitting inside a width/height box, without cropping or enlargement. An unlocked mode can provide exact dimensions, with a clear stretching disclosure.
- JPEG output explains lossy encoding and uses an explicitly shown background for transparent input.
- Progress: queued, processing, complete, unchanged, cancelled, and error states. A bad file must not prevent valid files from completing.
- Preserve queue/result meaning when tabs or future settings change. Clear removes queue entries, never source files.
- Adapt the muted purple/slate reference palette with readable contrast and restrained line icons. Native desktop chrome where applicable. Do not reproduce Upgrade, third-party artwork, or unrelated service terms.
- Keyboard alternatives for drag/drop, visible focus, labeled icon actions, reduced-motion support, and usable layouts at the minimum supported window size.

## Proposed delivery sequence

1. Record Ekko's platform, quality, and format decisions. Create an OpenSpec change through the CLI with proposal, design, capability specifications, and implementation tasks. Replace provisional assumptions with confirmed choices.
2. Implement the application shell, local file/folder intake, validated queue, and settings model. Keep one owner for product implementation.
3. Implement and verify strict PNG/JPEG optimization against real fixtures, including unchanged-output fallback and preservation of originals.
4. Implement conversion and resizing for the agreed format matrix, with format-specific warnings and explicit unsupported-input handling.
5. Complete batch progress, per-file recovery, destination handling, collision-safe export, and result summaries.
6. Run engine tests, integration tests, relevant UI interaction checks, and a packaged-app smoke test on the supported platform. Review code and documentation independently.
7. Add reproducible build/run instructions, license/notices, actual support matrix, and known limitations. Archive the OpenSpec change only when its acceptance criteria are verified.

## Acceptance and verification plan

| ID | Observable acceptance criterion | Required evidence |
| --- | --- | --- |
| AC-01 | Picker and drop intake produce equivalent queue entries; invalid input does not block valid files | Intake integration and UI checks |
| AC-02 | Strict optimization preserves dimensions, orientation, transparency, and supported image content | Fixture comparisons; JPEG coefficient or equivalent preservation check; PNG samples and color metadata |
| AC-03 | No-larger fallback uses actual file sizes and reports unchanged files correctly | Compressible and already optimized fixtures |
| AC-04 | Width/height inputs reject invalid values and honor fit/ratio/no-enlargement rules | Landscape, portrait, tiny, and boundary-size images |
| AC-05 | Output signature, extension, selected format, and dimensions agree | Decode every supported output format |
| AC-06 | JPEG loss and transparency behavior are visible before processing | Transparent fixture and UI interaction |
| AC-07 | Mixed batches expose accurate progress and isolated errors | Valid, corrupt, unsupported, cancelled, and retry scenarios |
| AC-08 | Saved outputs never overwrite originals or collide silently | Temporary-directory integration tests and duplicate names |
| AC-09 | Running and completed results retain the submitted settings | Tab/settings changes during and after processing |
| AC-10 | Primary workflow works with keyboard and minimum-window layout | Actual UI checks, focus inspection, and screenshots |
| AC-11 | Local-processing claim matches runtime behavior | Network inspection during representative processing |
| AC-12 | Packaged application contains required codecs and starts cleanly | Smoke test of an actual local package, separate from development mode |

Verification boundary at this point: reference inspection, repository/tool discovery, primary-source research, and independent requirements/architecture review only. No application, image-processing tests, UI tests, or packaged build has been completed.
