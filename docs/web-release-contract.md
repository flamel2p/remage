# Web/PWA version 1.0 contract

Maintained 2026-10-12. Approved scope comes from the active [web change](../openspec/changes/release-web-pwa-v1/proposal.md) and its four specifications. This contract reconciles the historical desktop PRD; implementation and release evidence are recorded separately in [web verification](web-verification.md).

## Defaults and capabilities

- Fresh browser sessions start in Converter when no strict adapter is verified. No output format is selected automatically. Restored valid preferences remain usable; an explicitly selected unavailable Optimizer explains the limitation and offers Converter.
- Resize is off; proportions locked; enlargement off; JPEG loss acknowledgement off; JPEG alpha background white; metadata preservation on. Native defaults remain unchanged.
- Appearance defaults to system, with light/dark/system choices. Persist settings only. Never persist selected image bytes, filenames, previews, source/result handles, history or destinations.
- Local picker and drop are the browser baseline. Folder destination writes/opening, automatic exports and guaranteed background execution are absent. Completed results offer individual downloads and selected bounded ZIPs.
- A browser download receipt means Download requested, not a confirmed saved file. ZIP ready means a prepared archive available for an explicit download action. Native publication remains a distinct receipt.

## Candidate format and metadata subset

The core matrix is static 8-bit PNG/JPEG/WebP input to PNG/JPEG/WebP output, plus the shared containing-box/exact resize rules. It requires independent decoding/fixture proof before advertising support. Known sRGB interpretation is the initial subset; ICC, CMYK/YCCK, unsupported gamma/chromaticity/color declarations, animation and high depth are explicitly rejected. Optional metadata cannot be removed to disguise an unsupported color interpretation.

The selected candidate adapter is pinned ImageMagick WASM, documented in the [codec decision](browser-codec-decision.md). PNG output stays 8-bit without palette quantization. WebP output uses verified lossless/exact encoding, quality 100, full alpha quality and single-thread settings. JPEG output requires acknowledgement, uses the chosen alpha background, and remains a disclosed lossy transformation. All conversions/resizes are transformations; encoder losslessness does not promise original-detail preservation.

Metadata preservation remains selected by default. If source optional metadata cannot be preserved by the selected path, submission must fail with a recoverable explanation. Explicit removal may permit an otherwise supported transformation; trusted orientation is applied before resize planning. Color rejection remains in force regardless of that choice.

No browser strict PNG or JPEG adapter is currently qualified. The initial candidate keeps strict capabilities unavailable. Introducing either requires a separate original-compressed-byte proof of full preservation; JPEG decode/re-encode is never a substitute for jpegtran.

## Resource profile and qualification

The initial implementation uses the conservative profile for every browser: 10 sources, 20 MiB per source, 50 MiB aggregate sources, 50 MiB retained results/serialized archive, 8,192 px maximum side, 12 million source and planned-output pixels, one active image job, 60-second image timeout and 30-second archive timeout. Every operation must also pass a combined reservation; the maximum dimensions alone do not admit an operation.

Browser-only state bounds also cap one selection at 100 inspected files, rejection detail rows at 10, retained results at 100 and displayed source names at 255 Unicode scalars. Aggregate intake feedback reports excluded/omitted files instead of allocating unlimited rejected rows. In-flight file reads and outstanding download Blob bytes participate in memory admission; encoded-byte ceilings alone do not bound those allocations.

The provisional combined reservation is 256 MiB, including retained bytes, input/transfer copies, source/output raster and processing/validation allowances, codec scratch and archive output/copy/scratch. Archive generation pauses image scheduling and terminates the idle codec Worker before allocating the ZIP. These are admission estimates, not a physical browser heap cap or measured weakest-device guarantee. ImageMagick's own memory resource limit is not a total heap bound. Publish qualified limits only after W2/W-03/W-12 measurements; lower them when a supported device lacks headroom.

Service-worker installation/recovery must hash and cache the approximately 15.4 MB WASM asset. That browser-managed context adds response/hash scratch outside the image Worker's measured heap. Validate aggregate headroom with setup/update activity too; manual recovery waits until active processing/archive work ends. Do not describe the admission estimate as a hard process-memory limit.

## Browser and release evidence

Required qualification remains desktop Chrome/Firefox/Safari, Edge smoke, real Android Chrome and real iPhone Safari. Installed surfaces include a verified desktop Chromium target, Android Chrome and iOS home-screen PWA. Playwright Chromium/Firefox/WebKit and mobile viewport emulation are useful local checks; they do not replace retail Safari, Edge or physical-device/installed-surface evidence.

The [execution plan](platform-execution-plan.md) owns W-01–W-12. Each gate's record in web-verification.md must name artifact/hash, fixture/settings, actual browser/device/version, observed outcome and limitation. WEB-STABLE requires the complete prescribed matrix, measured resource/cancellation cycles, offline reopen, safe multi-client update/rollback and served-production checks, with no unresolved blocking corruption/privacy/fidelity/core-flow failure.

The local candidate is not a public version 1.0 release. Static hosting is prepared only after a concrete candidate exists; publication requires an authorized destination/action. Deferred desktop implementation cannot begin merely because source/build checks pass.

## Design and licensing

Root [design.md](../design.md) governs typography, violet palettes, Card surfaces, responsive behavior and accessibility. The intended outline Motion Icon migration is explicitly deferred while written public-source/fork/rebuild/distribution permission is outstanding; current local icons remain. REUI account access and keys are developer tooling, excluded from runtime assets and caches.

Remage source remains MIT. Fonts retain OFL notices; free REUI/shadcn source retains MIT provenance; the browser WASM has its own full dependency notices and corresponding-source/rebuild obligations. Resolve those binary-distribution obligations before public artifact publication, independently from the proprietary icon rights gate.
