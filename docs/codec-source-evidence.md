# Codec source preparation evidence

This records private local preparation for `release-web-pwa-v1` task 10.5. It does not establish public distribution permission, artifact-specific legal compliance, byte-for-byte reproduction of the published module, or browser/device qualification. Public packet generation is deliberately refused while the Dependencies build-script license grant is unresolved.

## Collected inputs and application snapshots

- All 28 official commit-addressed source archives passed the sealed SHA-256 and byte-count checks: **99,696,670 compressed bytes**. The exact revisions and retrieval checksums are in `tools/codec-source/lock.json`; anonymous tag metadata and retrieval records are retained with the downloads. Checksums identify downloaded bytes, not upstream signatures or original-binary build attestation.
- The license index contains **81 original texts**, including FreeType's selected `docs/FTL.TXT`. The complete source archives also retain their other notices. Only the Dependencies archive lacks an identified grant; the inventory is not a blanket license classification.
- Explicit Python data-filter extraction passed for all 28 archives. Python 3.9.6 without the filter was rejected before extraction. Corrupt-archive collection/extraction and `--public` packet generation were rejected; the sealed lock remained unchanged.
- The original application source archive records parent commit `8f2c5b48a4e8a388591ce309ec5a350531d34178`, SHA-256 `f6dc05283e10e0f83787e2ca41748e1828efae792cbd1648b1dbc233ca9be79c`, **2,529,280 bytes**. It preserves the pre-correction source, including all 98 inputs that produced build ID `b358a5af612b9a6aff5bb5682b9be778ae56909139f9083bb52e1713147db7fc`.
- The later inclusive-12MP correction is preserved separately as the two-file binary Git patch, SHA-256 `987acced1546bcc142bcda4373bad63cea2d338b90e3389838e44c032b88de15`, and layered application tar, SHA-256 `90c8a93f2fc89d1037a3fa1f9e1dd57e09b29f44ed43059abfbad6fc3109abdb`, **2,519,040 bytes**. Only `src/web/codec.ts` and `src/web/codec.test.ts` differ. The actual archived build-ID implementation computed `d01caddb56c9d3b94daa999f424dfee7dd36b3169d1a583bb572dcc33ace91bc`, matching the current canonical root artifact, digest `07cf681c3dc6820766cf7ad386323c2bb03de0e5c222a7ed302861e4a60db826`, SW SHA-256 `8d979d111738cdf099b830bc49fee4ad4d1bd17156132ebb71b0445f8d41a106`. An independent read-only reviewer recomputed the identity from the layered tar alone and found all current files identical.

The new source layer does not change the attribution of evidence obtained from the original frozen adapter. Both archives, patch, per-file hashes and current inventory belong in the private packet.

## Actual supplied-byte proof

The actual adapter from the extracted original application archive initialized the installed `@imagemagick/magick-wasm` 0.0.44 wrapper with a separate copy of the published x86 WASM. All nine PNG/JPEG/WebP input/output pairs passed independent Sharp format/dimension/alpha and relevant pixel checks, including hidden transparent RGB for lossless sources. The evidence records the actual adapter source hashes, installed ESM bundle hash, declared Native glue version and supplied module hash.

This proves the explicit byte-loading replacement path for that original module. It does **not** prove a source rebuild or LGPL-component recombination. It ran in Node, not a browser/installed PWA or physical phone. No canonical artifact or installed package was replaced.

## Owned baseline rebuild

The actual build began **2026-10-12 14:29:01 UTC** in the named disposable `remage-codec-source-rebuild` container. It uses the exact commands in [codec-source-rebuild.md](codec-source-rebuild.md), pinned amd64 Emscripten image digest `sha256:e70c319784885fc4740761e3d473dbfa5bf092c5b55b6d08f41f7b2c9248c4a4`, Emscripten **6.0.6**, Q8/wasm-x86, four pinned CPUs (`nproc=4`), 6 GiB memory limit and 512 PID limit. The host is an Apple M4 Pro MacBook Pro with 48 GB RAM, macOS 27.0.1 arm64; the container uses amd64 emulation. Docker Desktop is 4.84.0 and Engine 29.6.2.

The baseline driver completed **exit 0 at 15:33:38 UTC**, after **64 minutes 37 seconds**. It compiled all 24 selected libraries, ImageMagick and Native Q8. No stopping deadline was imposed. The rebuilt module passed all nine actual-adapter pairs against both the extracted original application and the separately extracted corrected source layer.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Baseline WASM | 15,446,944 | `f8c67c10f37a26148984dd0002d27d21e6a79e118f6c36ec1cd24292f5f049aa` |
| Generated baseline glue | 204,327 | `4bcbb52bb330c94ba51e24b40ccdf2e8ef37d96238c3f57e7e2fd8f4fcd524e8` |
| Baseline libheif static archive | 4,310,026 | `178711787e1e64f699ce4a2067481291c5b894d80988286c38a5f1228a9c0b8f` |

The WASM differs from the published module, so byte reproduction and published-binary build attestation are not established. Adapter execution used the installed published ESM bundle, **not** substituted generated glue. Its bundle is 409,450 bytes, SHA-256 `cf1db24f7e63f560118ef434fd581dc9ef66ad099dc417184765cd6076fb4a1b`, declaring Native version 2026.927.1314. Generated glue is retained as build/recombination material; its standalone runtime compatibility has not been tested.

Logs and resolved package versions are retained under `release/codec-source/work/evidence/`. Dependency and mid-build dpkg lists were captured before Native tooling installation; no post-Native baseline dpkg snapshot was obtained before the disposable container exited. Native pip versions were captured. The future driver adds the missing dpkg snapshot; the exact executed driver is retained separately. Relink has its own actual post-tooling dpkg list. Upstream apt repositories remain unsnapshotted, and amd64 emulation differs from the upstream runner.

## Effective source closure

GLib Meson found pinned installed **libffi 3.8.0** and **zlib 1.3.2**, and its `ngettext` probe succeeded. It did not create fallback subproject directories or fetch `proxy-libintl`; internal PCRE was already present in the sealed GLib archive. Highway tests/examples were OFF. JPEG XL's SKCMS/SJPEG/JPEGLI/tests/tools/examples/benchmark/fuzzer paths were OFF; Highway, Brotli and LCMS2 resolved to the separately pinned `/tmp/dependencies` libraries, as did PNG/zlib. Full Meson/CMake and ImageMagick/Native configuration evidence is retained.

The pinned upstream JPEG XL script misspells `JPEGXL_ENABLE_WASM_TRHEADS=false`; the actual `JPEGXL_ENABLE_WASM_THREADS` remains **TRUE**. This discrepancy was retained in the baseline and relink. No corrected retry was needed for their links and the observed PNG/JPEG/WebP Node paths. Do not infer single-thread configuration from the misspelled option or treat these cases as testing JPEG XL behavior.

No extra project-source fetch was observed in the effective configuration, subproject directories or retained logs. This is an observed source-closure review, not network packet tracing or original-binary attestation. Compiler/sysroot, OS packages and general-purpose build tools are recorded separately from the 28 project/library archives.

## Actual modified-component recombination

The pristine sealed libheif source at commit `b8fbb502979530d5e4baa7d24d8c353c3d13d1cd` was modified only at `libheif/api/libheif/heif_version.h.in`. Its original LGPL3-or-later header was retained; a dated comment and `-remage-relink-proof` version suffix were added. The exact patch, original/modified source hashes and executed driver are included. The fresh pinned relink container started **15:34:48 UTC** and completed **exit 0 at 15:37:44 UTC**, after **2 minutes 56 seconds**.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Modified-component WASM | 15,446,974 | `e26dc4852cc89ff5d27e0db739f3b790c60b09ed1252044d0de9d0b627eb389c` |
| Generated modified glue | 204,327 | `4bcbb52bb330c94ba51e24b40ccdf2e8ef37d96238c3f57e7e2fd8f4fcd524e8` |
| Modified libheif static archive | 4,310,046 | `4053555e68e97fa7dd8ce3286e176b924ef1f22ba448bffbd1eff87c0a91f93c` |

Both original and corrected actual-adapter source roots exposed **`1.23.5-remage-relink-proof`** in ImageMagick's HEIC-family registry and passed all nine PNG/JPEG/WebP pairs using the modified module. This marker is compiled from `LIBHEIF_VERSION`; it is not a direct `heif_get_version()` call. The separately changed static-library hash and build log corroborate the library rebuild, followed by ImageMagick and Native relink.

Five finalized adapter records contain **45 cases**: original supplied copy 9, rebuilt baseline 18 across the two application snapshots, modified relink 18 across those snapshots. All nine fixture output byte hashes match published-to-baseline and baseline-to-modified. These are bounded fixture observations, not whole-module equivalence, arbitrary ABI compatibility, browser/offline/installed qualification or peak-memory evidence. The Node runtime is **24.14.1 darwin arm64**, independent Sharp **0.35.4**; decoder-library versions and all adapter hashes are recorded in each JSON. Both owned disposable containers were confirmed absent after their successful exits; no canonical artifact or installed package was replaced.

## Packet and release gates

The private packet contains **178 files**, including the two compiled modules, both generated glue files and baseline/modified static libheif archives, alongside the 28 intact sources, patches, application snapshots, tools, 81 license texts and evidence. Its completion flags are derived from successful exit records, exact module identities, archived adapter source hashes, measured wrapper identity, nine-pair records, observable marker and changed static archive. Repeated packet generation produced identical bytes. The decoded audit verified every packet member and both application snapshots' **254 regular files**, with no unexpected high-confidence credential-pattern matches. Seven already-public GLib synthetic TLS fixtures matched their individually sealed content hashes. This is a bounded pattern audit; the lead's separate exact configured-key scan and artifact-specific release review remain necessary. The adjacent manifest holds the packet checksum without a self-hash cycle.

Task 10.5 remains open: Dependencies script rights, matching original-binary provenance, artifact-specific license/recombination review and durable public matching source/binary publication are unresolved. Physical-device, installed/offline and release qualification are tracked separately; this source-preparation evidence cannot satisfy them.
