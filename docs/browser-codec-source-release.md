# Browser codec source release gate

This is a preparation checklist for conveying the combined `magick-wasm` 0.0.44 binary. It is not a completed license-compliance certificate. Source provenance, selected artifact hash, full notices and pinned upstream revisions are in [browser-codec-decision.md](browser-codec-decision.md).

Before any public binary release:

1. Archive the exact wrapper, Magick.Native, ImageMagick and dependency sources identified by the pinned source chain, including build scripts, generated inputs and the applicable license texts. Resolve each dependency revision from the tagged clone script; a moving branch or a link alone is insufficient.
2. Record the exact upstream Emscripten/toolchain, CMake/configuration options and build environment used for the conveyed x86 module. Document any difference from upstream and include Remage modifications. Do not imply an untested source rebuild produced the published binary.
3. Provide reproducible instructions and necessary build/relink materials allowing replacement of LGPL components and rebuilding the combined module. Verify a user-supplied rebuilt WASM can be used by the adapter without a signature, account or access restriction.
4. Publish the source/rebuild materials alongside the named release artifact through an accessible durable location, retain the full combined dependency notices in the web artifact, and document the method used to satisfy the applicable terms. Have the artifact-specific interpretation reviewed before conveyance.
5. Record retrieval hashes, rebuild/replacement observations, published locations, exact web build identity and reviewer in the release evidence. Keep this gate open if any input or replacement step is unverified.

Local development and automated candidate tests do not satisfy public conveyance evidence. An MIT Remage repository does not relicense the combined WASM, fonts or copied component source. Motion Icon permission is a separate gate and does not cover this binary.

## Local preparation implemented

The isolated [codec source tools](../tools/codec-source/lock.json) now seal and verify 28 exact upstream source archives and retain original licenses, selected upstream build scripts, the allowlisted Remage application source and explicit rebuild/replacement instructions. See [codec-source-rebuild.md](codec-source-rebuild.md) for commands and [codec-source-evidence.md](codec-source-evidence.md) for measured outcomes. Archives and build work stay under ignored `release/codec-source/`; the packet is private preparation only.

The baseline source rebuild and marked libheif rebuild/relink both completed successfully. Their modules passed 36 actual-adapter fixture cases across the original and corrected application snapshots; the separate original-module loading proof adds nine cases. These are Node observations using the installed published wrapper's embedded glue, with generated glue retained as build material. The rebuilt bytes differ from the published module, so original-binary build attestation is not established.

The pinned ImageMagick/Dependencies scripts have no identified standalone redistribution grant. Public packet mode explicitly refuses while this and the artifact-specific review/publication gates remain unresolved. Task 10.5 remains open.
