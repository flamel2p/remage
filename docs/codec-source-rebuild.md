# Private codec source preparation

This implements the local preparation portion of `release-web-pwa-v1` task 10.5. It does not authorize a public binary/source release or certify license compliance. The selected published WASM is `@imagemagick/magick-wasm` 0.0.44, 15,447,097 bytes, SHA-256 `b7d6710436b150dc5bd1ca04d80b6b7614c54854d7470f888f7e69a2a41b00e4`.

## Source identity and rights

[tools/codec-source/lock.json](../tools/codec-source/lock.json) seals the compressed bytes, SHA-256, repository, exact 40-character commit and declared upstream tag for 28 archives: the wrapper, Native bridge, ImageMagick, Dependencies scripts and 24 libraries selected before the upstream clone script's WASM return. Retrieval uses the official repositories' commit-addressed GitHub codeload service. These are retrieval checksums, not upstream signatures or an attestation that the published binary was built from these exact bytes.

| Input | Exact source |
| --- | --- |
| Wrapper 0.0.44 | [8d346777ce0e172dacdb797a65346569425c43af](https://github.com/dlemstra/magick-wasm/tree/8d346777ce0e172dacdb797a65346569425c43af) |
| Magick.Native 2026.927.1314 | [999720f7ebe03d5a0029536f1586a2cb82b500ae](https://github.com/dlemstra/Magick.Native/tree/999720f7ebe03d5a0029536f1586a2cb82b500ae) |
| ImageMagick | [ad98b244c995d2e3051757fa3b7855f45b550d24](https://github.com/ImageMagick/ImageMagick/tree/ad98b244c995d2e3051757fa3b7855f45b550d24) |
| Dependencies 2026.09.26.1516 | [1c21ff03809da9cc544427fcd04e965d1558d06f](https://github.com/ImageMagick/Dependencies/tree/1c21ff03809da9cc544427fcd04e965d1558d06f) |

All original source archives and license texts remain intact. The separate license inventory includes conventional license filenames and every selected `.ImageMagick/Config.txt` `LICENSE_FILE` target, including FreeType `docs/FTL.TXT`. It is an index for review, not a determination that every source file has the same license. In particular, lqr metadata says LGPL-3.0-or-later while reviewed core headers explicitly name version 3; retain both and conservatively review LGPL3 terms. Optional FFTW, FLIF and JBIG inputs after the WASM return are not selected or bundled.

**Public packet blocked:** the pinned ImageMagick/Dependencies archive contains no identified license grant, and its README gives no standalone redistribution permission for its build scripts. The [official repository](https://github.com/ImageMagick/Dependencies) exposes README/security resources without a license. GitHub's [user-generated-content terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#d-user-generated-content) permit service-specific viewing/forking; treating that as a standalone release grant is unsupported. The tool only generates a private preparation packet and refuses `--public`. Resolve these script rights or a reviewed alternative before distribution; no maintainer contact has been made.

The combined static WASM's applicable LGPL terms require usable recombination/relink materials, not simply a renamed copy of the original module. See [LGPL3 section 4](https://www.gnu.org/licenses/lgpl-3.0.html) and the [FSF static-linking FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#LGPLStaticVsDynamic). The [GPL3 corresponding-source definition](https://gcc.gnu.org/onlinedocs/gcc/Copying.html) includes controlling scripts and distinguishes unmodified general-purpose tools/System Libraries. Artifact-specific interpretation and the actual public source/binary delivery method remain release gates.

## Collection and safe extraction

Run from the repository root with Node 24+ and Python 3.12+ providing `tarfile.data_filter`. The local verification used Node 24.14.1 and Python 3.14. Python 3.9 without that filter is explicitly rejected. No credentials or accounts are needed; collection requires network access to official public sources.

```sh
node tools/codec-source/collect.mjs
python3.14 tools/codec-source/prepare.py --work release/codec-source/work
node tools/codec-source/application.mjs
node tools/codec-source/verify.mjs python3.14
```

The collector streams at most four downloads concurrently with time/byte bounds, then checks the sealed SHA and byte count. Existing mismatches fail without replacing the lock. `--record-checksums` is a maintenance-only first-sealing operation; it is not a refresh command or a way to accept changed downloads. Independently review upstream revisions before ever changing the lock. The preparer verifies every archive before creating a fresh tree, checks commit roots and lexical paths/links, and explicitly uses Python's data extraction filter. It refuses an existing build tree and never deletes one.

`application.mjs` creates an explicit allowlist archive from Remage commit `8f2c5b48a4e8a388591ce309ec5a350531d34178`, including actual adapter/Worker/UI source, assets/notices, lockfiles, build scripts/configuration, public `.npmrc` build settings, fixtures and relevant build docs. It excludes Git history, agent/private configuration, environment files, installed dependencies and ignored results. `application-source.json` records the commit, paths and archive checksum. Newly written preparation tools/docs are separately included in the outer packet, so they are not lost by archiving an older HEAD.

The subsequent exact-12MP area-limit correction is preserved as a separate layer, without changing that baseline archive:

```sh
node tools/codec-source/application.mjs --workingtree-patch
```

This mode requires the recorded parent HEAD and exactly the authorized changes in `src/web/codec.ts` and `src/web/codec.test.ts`. It retains the binary Git patch, per-file original/current hashes, a layered application archive and the current emitted inventory. It compiles the **archived** build-ID implementation and recomputes the layered source's root/default-tag identity; a mismatch with the current canonical artifact fails. The patch mode is deliberately specific to this recorded correction, not a general working-tree export. Both application snapshots and their distinct provenance are included in the private packet.

## Isolated upstream rebuild command

The Native workflow selects Ubuntu 24.04, Emscripten 6.0.6, Q8, `wasm-x86`. The lock pins the official Emscripten image's Linux amd64 child digest as well as its multiarch index digest. The local attempt uses Docker amd64 emulation on an Apple M4 Pro; it is an environment difference from upstream's amd64 runner, not a bit-reproducibility claim.

After collection/extraction, run:

```sh
docker run --rm --name remage-codec-source-rebuild \
  --platform linux/amd64 --cpuset-cpus=0-3 --memory=6g --pids-limit=512 \
  --mount "type=bind,src=$PWD/release/codec-source/work,dst=/work" \
  --mount "type=bind,src=$PWD/tools/codec-source,dst=/remage-tools,readonly" \
  emscripten/emsdk@sha256:e70c319784885fc4740761e3d473dbfa5bf092c5b55b6d08f41f7b2c9248c4a4 \
  bash /remage-tools/rebuild.sh
```

The four pinned CPUs make upstream `nproc` report 4; adjust the set only for a host that supplies those CPUs. The driver invokes the exact pinned dependency install/build scripts, then the Native tool install, ImageMagick static Q8 build and Native WASM link. It does not execute upstream checkout scripts that download moving/prebuilt inputs. It preserves both generated `magick.wasm` and `magick.js` and the static-library/include prefixes when successful. The wrapper embeds Native JavaScript glue: an ABI-compatible replacement can use the installed glue; changed interfaces may require rebuilding the wrapper with the matching generated glue. Merely copying new WASM over an installed package does not resolve that compatibility question.

Build logs, exit status and resolved dpkg/pip versions are retained below `release/codec-source/work/evidence/`. Upstream dependency pip tools are pinned in the selected scripts; native CMake is 3.30.3. Upstream apt sources are not snapshot-pinned, so the recorded package versions document this attempt but do not make the host fully reproducible. Network package access and Docker are build prerequisites, not runtime dependencies of Remage. No npm package, canonical output, source asset, installed module or product configuration is replaced.

If a future attempt has an explicitly agreed time budget, stop only the named owned container when that budget expires. The recorded attempt has no imposed stopping deadline and continues while making meaningful progress:

```sh
docker stop remage-codec-source-rebuild
```

Preserve the exit/log evidence. A stopped partial build is not a successful rebuild, and an unavailable fallback source such as GLib's conditional `proxy-libintl` must be resolved and pinned if that branch is actually taken. Likewise verify no optional submodule/source fetch occurred before calling the collected set complete for a successful build.

## Replacement and relink validation

With dependencies installed from the application's frozen lock, this harness compiles the **actual** `src/web/codec.ts` adapter into a separate ignored directory and initializes the selected installed wrapper with supplied module bytes:

```sh
node tools/codec-source/prove-adapter.mjs /absolute/path/to/magick.wasm release/codec-source/adapter-proof
```

It performs all nine PNG/JPEG/WebP pairs using independent fixture inputs and Sharp output decoding, checks format/dimensions/JPEG alpha flattening, and checks lossless output pixels including hidden transparent RGB (JPEG decoders may differ by up to four sample values). An optional fourth argument selects an extracted frozen application source root; evidence records its path and relevant source hashes, so a changing working tree is not mistaken for the archived application. The installed wrapper version, declared Native glue version and actual ESM bundle hash are recorded separately from the supplied WASM identity. This is Node adapter evidence. It is not an installed/browser/offline/physical-device qualification, nor a rebuild/relink proof when using the unmodified published module. Supplied bytes need no signature, license-server contact or account.

The actual baseline proof tests the freshly linked module through the **installed published wrapper's embedded glue**. Generated glue is retained as separate build material; it is not substituted or runtime-tested by that proof. An ABI-changing component modification may require rebuilding the wrapper with the matching generated glue. The same adapter API does not imply every arbitrary WASM binary is compatible.

After validating the baseline, the marked local libheif exercise uses:

```sh
python3.14 tools/codec-source/modify-heif.py
docker run --rm --name remage-codec-source-relink \
  --platform linux/amd64 --cpuset-cpus=0-3 --memory=6g --pids-limit=512 \
  --mount "type=bind,src=$PWD/release/codec-source/work,dst=/work" \
  --mount "type=bind,src=$PWD/tools/codec-source,dst=/remage-tools,readonly" \
  emscripten/emsdk@sha256:e70c319784885fc4740761e3d473dbfa5bf092c5b55b6d08f41f7b2c9248c4a4 \
  bash /remage-tools/relink.sh
```

The modifier checks the pristine sealed source, retains the LGPL header, adds a dated version suffix and saves the exact patch/hashes. Relinking requires a **fresh** container and restores the saved baseline dependency/ImageMagick prefixes; existing prefixes are refused. The observable marker is ImageMagick's HEIC registry string compiled from `LIBHEIF_VERSION`, not a direct `heif_get_version()` invocation. Rebuilt libheif archive hashes/logs separately corroborate the library rebuild. Actual outcome and adapter validation are recorded in the evidence document; preparing a command alone is not a completed proof.

## Private packet

```sh
python3.14 tools/codec-source/pack.py
python3.14 tools/codec-source/audit.py
```

The deterministic gzip/tar packet includes all 28 raw archives, the license inventory/texts, both allowlisted Remage application snapshots, the patch/provenance, an explicit tool allowlist, newly written docs and bounded build/adapter evidence. Baseline and modified WASM/glue plus the two libheif static archives are explicitly included under `artifacts/` and inventoried in `artifact-identities.json`. Tar metadata and gzip timestamps are fixed. Its adjacent `.json` records the packet checksum and every member's length/SHA without a self-hash cycle. `audit.py` verifies those bytes, application exclusions and high-confidence credential/private-key patterns, reporting paths only. Seven already-public GLib synthetic TLS test fixtures are individually reviewed by exact commit/path/content SHA in `public-test-fixtures.json`; this is not a blanket PEM exemption. Unexpected matches fail the audit. This bounded scan is not an exhaustive secret detector. Tools are invoked explicitly with `node`, `python3.14` and `bash`; their 0644 packet mode is intentional. `PREPARATION-STATUS.json` derives local proof completion from actual records and binds the recorded adapter hashes to the corresponding application archive and measured published wrapper identity. It preserves the open public gates and disclaims public authorization. Keep the packet in ignored `release/codec-source/`; do not upload it while script rights and legal/source/publication review remain unresolved.

To reconstruct a **fresh private workspace** from the audited packet, extract it with Python's explicit data filter, then select the baseline or layered application tar. The outer packet intentionally stores tools separately from the application snapshot. For the baseline:

```sh
# In a fresh directory containing the audited packet and its adjacent manifest:
python3.14 -c 'import tarfile; tarfile.open("remage-magick-wasm-0.0.44-source-preparation.tar.gz").extractall(".", filter="data")'
mkdir remage-work
python3.14 -c 'import tarfile; tarfile.open("remage-codec-source/application/remage-8f2c5b48a4e8a388591ce309ec5a350531d34178.tar").extractall("remage-work", filter="data")'
mkdir -p remage-work/tools/codec-source remage-work/release/codec-source/downloads
cp -R remage-codec-source/tools/. remage-work/tools/codec-source/
cp remage-codec-source/sources/*.tar.gz remage-work/release/codec-source/downloads/
cd remage-work
python3.14 tools/codec-source/prepare.py --work release/codec-source/work
```

Use the `-workingtree.tar` archive instead to reconstruct the corrected candidate. The source build command above needs these extracted archives and tools, not Git history, a new `application.mjs` run or a prebuilt dependency download. Actual adapter proof additionally needs `pnpm install --frozen-lockfile` for the selected application's dependencies; it can run against the reconstructed source root. `application.mjs` is a maintainer provenance/export tool requiring the recorded Git commit and, for patch mode, the frozen two-file working tree. The archived adapter snapshot is the source needed to rebuild application code; a consumer does not need access to private configuration or signing credentials.

Measured local attempt outcomes are recorded in [codec-source-evidence.md](codec-source-evidence.md). Task 10.5 remains open until the complete release gate in [browser-codec-source-release.md](browser-codec-source-release.md) is satisfied.
