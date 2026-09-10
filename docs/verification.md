# Verification record

This record distinguishes completed local evidence from future release gates.

## Implemented and locally verified

| Requirement | Evidence |
| --- | --- |
| Secure local desktop boundary | Context isolation, sandboxing, disabled Node integration, CSP, blocked navigation/window creation, sender checks, Zod payload schemas in `src/main` and `src/preload` |
| Local supplied fonts | WOFF2 declarations in `src/renderer/src/styles.css`; production Vite build emits both font assets |
| Strict PNG/JPEG processing | `ImageEngine` invokes fixed adapter arguments, disables OxiPNG pixel transforms, validates preservation, rejects APNG, and generated PNG/JPEG tests pass |
| Conversion and resize | Generated PNG-to-WebP, transparent-PNG-to-JPEG, and rounded 1000×333-to-100×33 resize integration tests pass |
| Safe export | OutputPublisher collision test passes; service tests prove exports use a private snapshot even after the original is changed |
| Toolchain checks | `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test` passed with 18 tests on macOS arm64 during implementation |
| Codec acquisition | `pnpm run fetch:codecs` verified pinned SHA-256 checksums, created universal arm64/x64 adapters, and successfully ran local `jpegtran -version` and `oxipng --version` |
| Package evidence | Electron-builder created arm64 and x64 macOS DMGs; arm64 app launched successfully for five seconds in a local smoke test, with bundled codecs and both Sharp architecture variants inspected |

## Release gates still required

- Build the final DMG with the intended Apple Developer signing identity, notarize it, and test the downloaded artifact on a clean macOS arm64 machine.
- Smoke test the x64 package on a clean Intel macOS host. This arm64 host built and inspected the x64 artifact but cannot execute it natively.
- Perform an accessibility pass with VoiceOver and a 200% text-scale/manual keyboard test on the final packaged application.
- Do not advertise Windows or Linux binaries until their codec bundles, capability probes, and package smoke tests exist.
