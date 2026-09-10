# Remage

Remage is an open-source, macOS-first desktop app for processing images locally. It has two modes:

- **Optimizer** performs strict static PNG and JPEG optimization. It accepts a result only when it is smaller and passes format, dimensions, transparency, orientation, decoded-pixel, ICC, and EXIF preservation checks.
- **Converter** resizes or converts static PNG, JPEG, and WebP images. This path is an explicit transformation: JPEG is lossy and transparent images are composited onto a user-selected background before JPEG output.

No image bytes are uploaded. Remage has no account, telemetry, cloud processing, or automatic update service.

## Supported formats

| Source | Strict optimize | Resize | Convert to |
| --- | --- | --- | --- |
| PNG | Yes | Yes | PNG, JPEG, WebP |
| JPEG | Yes | Yes | PNG, JPEG, WebP |
| WebP | No | Yes | PNG, JPEG, WebP |

Only static, 8-bit images within the documented intake limits are supported. Animated, multi-page, high-bit-depth, AVIF, HEIC, TIFF, SVG, RAW, and vector files are rejected in this release.

## Run locally

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

- The renderer cannot access Node, the shell, arbitrary filesystem paths, or image codecs.
- The main process validates picker/drop payloads, real paths, content signatures, dimensions, queue limits, output destinations, and IPC senders.
- Originals are read-only inputs. A completed output is written only to a selected folder using collision-safe names such as `photo-optimized.png`; existing files are never overwritten.
- Temporary candidates live in the macOS temporary directory and are removed on cancellation or app exit. Preferences contain settings only, never image bytes, source paths, destinations, or result history.

## Architecture

`src/renderer` contains the React UI and supplied local fonts. `src/preload` exposes the small typed bridge. `src/main` owns dialogs, sources, batch coordination, filesystem output, preferences, and codec invocation. `src/shared` contains schemas and pure sizing/format logic. See [docs/architecture.md](docs/architecture.md) for the boundaries and [NOTICE.md](NOTICE.md) for third-party notices.

## Troubleshooting

- If strict PNG/JPEG optimization is shown as unavailable, run `pnpm run fetch:codecs` again and verify that macOS can execute the local adapters.
- If an image is rejected, confirm it is a static PNG, JPEG, or WebP file and within the queue limits. The filename extension is not trusted; Remage checks file contents.
- If export fails, select a writable destination and retry from the completed row. The candidate remains available in the current session.
- If macOS warns about an unsigned DMG, build/sign/notarize it with your Apple Developer distribution identity before public distribution.

## License

Remage is released under the [MIT License](LICENSE). Bundled and runtime dependencies retain their own licenses in [NOTICE.md](NOTICE.md).
