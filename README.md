# Remage

Remage processes images locally through a shared React workspace and separate browser/native adapters. **Web/PWA v1.0 is in development; it is not a qualified public release.** macOS remains the existing native implementation. Windows/Linux and heavier desktop workflows follow the [web-first execution plan](docs/platform-execution-plan.md) after WEB-STABLE.

The browser candidate converts/resizes static 8-bit sRGB PNG, JPEG and WebP, supports explicit individual downloads and selected-result ZIP, and keeps images/results in memory only. Browser strict optimization is unavailable. Metadata preservation stays selected; optional metadata is rejected until removal is explicitly selected. ICC/CMYK and unsupported color declarations remain rejected. JPEG requires loss acknowledgement and a selected transparency background.

The existing native adapter has two modes:

- **Optimizer** performs strict static PNG and JPEG optimization. It accepts a result only when it is smaller and passes format, dimensions, transparency, orientation, decoded-pixel, ICC, and EXIF preservation checks.
- **Converter** resizes or converts static PNG, JPEG, and WebP images. This path is an explicit transformation: JPEG is lossy and transparent images are composited onto a user-selected background before JPEG output.

No image bytes are uploaded. Remage has no account, telemetry or cloud processing. The PWA lifecycle uses compatible local assets and user-visible waiting updates; it does not provide dependable background processing or native folder powers.

The supported subset and provisional browser limits are in the [web release contract](docs/web-release-contract.md). [Verification](docs/web-verification.md) distinguishes local tests/browser-engine evidence from pending physical devices, installed surfaces and production qualification.

## Native formats

| Source | Strict optimize | Resize | Convert to |
| --- | --- | --- | --- |
| PNG | Yes | Yes | PNG, JPEG, WebP |
| JPEG | Yes | Yes | PNG, JPEG, WebP |
| WebP | No | Yes | PNG, JPEG, WebP |

Only static, 8-bit images within the documented intake limits are supported. Animated, multi-page, high-bit-depth, AVIF, HEIC, TIFF, SVG, RAW, and vector files are rejected in this release.

## Run the browser candidate

Prerequisites: Node 24+ and pnpm 11+. Browser processing needs no native sidecar codec, database, API service or REUI credentials.

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

Use the printed localhost URL. In a separate terminal, build/serve the standalone artifact when testing PWA behavior:

```sh
pnpm build:web
pnpm preview:web
```

`dist/web` is separate from Electron's `out`. Stop the named server with Ctrl-C. See [static hosting](docs/static-web-hosting.md) for HTTPS, base paths, MIME types, security headers and atomic update/rollback requirements. Physical device budgets, installed/offline/update qualification and corresponding-source/relink materials for the combined WASM remain release gates.

## Run native macOS

Prerequisites: macOS, Node 24+, pnpm 11+, and Xcode command-line tools.

```sh
pnpm install --frozen-lockfile
pnpm run fetch:codecs
pnpm run dev
```

`fetch:codecs` downloads the pinned OxiPNG and libjpeg-turbo macOS adapters, verifies SHA-256 checksums, extracts the signed local executables, and does not install anything system-wide.

## Verify and package

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run package:mac
```

The default package command creates an arm64 DMG. `pnpm run package:mac:x64` creates the x64 DMG on a suitable macOS build host. Release distribution still requires an Apple Developer signing identity and notarization; the local package is not a notarized public release.

## Privacy and file safety

- The native renderer cannot access Node, the shell, arbitrary filesystem paths or native image codecs. Browser processing uses dedicated local Workers and opaque session handles.
- The native main process validates picker/drop payloads, real paths, content signatures, dimensions, queue limits, output destinations and IPC senders. The browser adapter validates selected content and enforces its separate provisional budgets.
- Originals are read-only inputs. A completed output is written only to a selected folder using collision-safe names such as `photo-optimized.png`; existing files are never overwritten.
- Native temporary candidates live in the macOS temporary directory and are removed on cancellation or app exit. Browser originals/results stay in memory; application caches contain build assets only. Preferences contain settings only, never image bytes, source paths, destinations or result history.

## Architecture

`src/renderer` contains the React UI and supplied local fonts. `src/preload` exposes the small typed bridge. `src/main` owns dialogs, sources, batch coordination, filesystem output, preferences, and codec invocation. `src/shared` contains schemas and pure sizing/format logic. See [docs/architecture.md](docs/architecture.md) for the boundaries and [NOTICE.md](NOTICE.md) for third-party notices.

UI changes follow the root [design.md](design.md), its shared tokens and locally bundled Google Fonts. The shared renderer uses reviewed free REUI/Radix-nova primitives and pinned Tailwind v4. [REUI setup](docs/reui-setup.md) documents development tooling, the ignored `.env.local` license-key location, and the Motion Icon redistribution gate. [UI provenance](docs/ui-component-provenance.md) records source adaptations and notices; Motion Icons remain deferred.

Contributions follow [the contributing guide](docs/contributing.md), the active OpenSpec change and one shared implementation owner at a time. Report reproducible bugs with the manual issue template; do not upload private source images or credentials.

## Troubleshooting

- If strict PNG/JPEG optimization is shown as unavailable, run `pnpm run fetch:codecs` again and verify that macOS can execute the local adapters.
- If an image is rejected, confirm it is a static PNG, JPEG, or WebP file and within the queue limits. The filename extension is not trusted; Remage checks file contents.
- If export fails, select a writable destination and retry from the completed row. The candidate remains available in the current session.
- If macOS warns about an unsigned DMG, build/sign/notarize it with your Apple Developer distribution identity before public distribution.

## License

Remage is released under the [MIT License](LICENSE). Bundled and runtime dependencies retain their own licenses in [NOTICE.md](NOTICE.md).
