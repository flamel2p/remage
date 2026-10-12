# Browser codec decision and redistribution record

Candidate selected 2026-10-12 under web task 3.1. This records evaluated source and local artifact evidence; it does not establish the full browser/device matrix or a public release.

## Selected candidate

Use one isolated `@imagemagick/magick-wasm` adapter, pinned to **0.0.44**, inside a dedicated module Worker. The installed x86 WASM is **15,447,097 bytes**, SHA-256 **b7d6710436b150dc5bd1ca04d80b6b7614c54854d7470f888f7e69a2a41b00e4**. The x64 module is unnecessary for this browser baseline.

A local Node initialization of the exact published WASM reports PNG/libpng **1.6.58**, JPEG/libjpeg-turbo **3.2.0**, and WebP/libwebp **1.6.0** with read/write capability. A lossless WebP conversion of the synthetic RGBA fixture preserved every decoded RGBA byte, including nonzero RGB under zero alpha. This is one artifact/fixture check, not browser parity.

The [tagged initializer](https://github.com/dlemstra/magick-wasm/blob/0.0.44/src/image-magick.ts) accepts an explicit WASM URL or bytes. Vite must emit the module/glue/Worker as local assets and include them in the compatible offline asset manifest. No CDN, SharedArrayBuffer, COOP/COEP or processing API is required by this selected single-thread path.

## Implementation constraints

- Inspect content and admit source/planned-output/combined working sets before decode/resize/encode allocations. Restrict the decoder explicitly to the inspected PNG/JPEG/WebP format.
- Reject animation, unsupported depth/color/ICC. Preservation stays selected; optional metadata removal is explicit. Avoid compressed ancillary metadata expansion in the decoder input, without stripping unsupported color information to claim support.
- Apply orientation before shared resize planning. Use exact planned geometry with ignoreAspectRatio after that plan, avoiding a second containing-box fit.
- JPEG requires loss acknowledgement and alpha compositing over the chosen background using AlphaAction.Remove.
- WebP uses quality 100, lossless/exact true, alpha quality 100, thread level 0 and method 5. The [pinned coder](https://github.com/ImageMagick/ImageMagick/blob/7.1.2-32/coders/webp.c) derives near-lossless behavior from quality; the exact flag alone is insufficient.
- Copy write-callback bytes before the borrowed WASM allocation is released. Validate encoded format/dimensions and independent decoded samples in the corpus.
- Disable disk spill; constrain width/height/list/profile/pixel-cache/single-allocation/time resources. Terminate the Worker on timeout/cancellation and after image work before archives. ResourceLimits.memory is a pixel-cache limit, not a total heap limit; the compiled module permits growth to 4 GiB. Own admission estimates and physical-device measurement remain necessary. [Native build flags](https://github.com/dlemstra/Magick.Native/blob/2026.927.1314/src/Magick.Native/CMakeLists.txt)

## Alternatives evaluated

Stock jSquash WebP was rejected as the initial dependency because its published build source pins old libwebp and its upstream [security/provenance issue](https://github.com/jamsinclair/jSquash/issues/112) remains relevant. The [build file](https://github.com/jamsinclair/jSquash/blob/main/packages/webp/codec/Makefile) was inspected. Adding separate PNG/JPEG/resize packages alongside Magick would retain multiple codec heaps without benefit for this initial matrix.

wasm-vips requires a shared-memory/thread deployment profile beyond the selected baseline. webp-wasm is Node-oriented; the evaluated icodec prebuilt provenance was unresolved. Browser Canvas WebP cannot supply the selected verified lossless/exact encoder contract. The larger Magick artifact and its license/source maintenance are the accepted candidate trade-off; keep the adapter small to permit replacement later.

## Notices and corresponding source

The wrapper is Apache-2.0; the combined native WASM includes separately licensed components. Retain the exact published [wrapper license](../assets/licenses/magick-wasm-0.0.44-LICENSE.txt) and [full dependency NOTICE](../assets/licenses/magick-wasm-0.0.44-NOTICE.txt), not an Apache-only summary.

Pinned source chain:

1. [magick-wasm 0.0.44](https://github.com/dlemstra/magick-wasm/tree/0.0.44)
2. [Magick.Native 2026.927.1314](https://github.com/dlemstra/Magick.Native/tree/2026.927.1314)
3. [ImageMagick commit ad98b244c995d2e3051757fa3b7855f45b550d24](https://github.com/ImageMagick/ImageMagick/tree/ad98b244c995d2e3051757fa3b7855f45b550d24)
4. [Dependencies 2026.09.26.1516](https://github.com/ImageMagick/Dependencies/tree/2026.09.26.1516), whose clone-dependencies.sh pins each upstream source revision.
5. [Native build workflow/toolchain](https://github.com/dlemstra/Magick.Native/blob/2026.927.1314/.github/workflows/main.yml) and tagged CMake above.

The selected WASM build includes LGPL libheif/libde265/liblqr and GLib/LibRaw. GPL text in the notices accompanies LGPL terms; the reviewed WASM build branch excludes optional GPL-only FFTW/FLIF/JBIG components. This source review does not waive LGPL corresponding-source/rebuild/relinking obligations for the statically combined module.

**Public binary distribution remains gated:** prepare an accessible exact corresponding-source package, licenses, modifications and reproducible build/relink instructions for the conveyed module and verify that users can replace/rebuild it under the applicable terms. Upstream links are provenance evidence, not a claim that all conveyance obligations are already fulfilled. Remage does not relicense vendor code or restrict permitted replacement/debugging of the WASM. Record artifact-specific compliance evidence before publication.
