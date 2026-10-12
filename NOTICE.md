# Third-party notices

Class Variance Authority 0.7.1 uses Apache-2.0. Retain [its full license and copyright](assets/licenses/class-variance-authority-0.7.1-APACHE-2.0.txt) with the shared component build. Other runtime dependencies keep their upstream notices; copied REUI/shadcn source is recorded in [UI provenance](docs/ui-component-provenance.md).

Remage packages these components when building the macOS application:

- OxiPNG 10.2.1, licensed under MIT. Source: https://github.com/oxipng/oxipng
- libjpeg-turbo 3.2.0 and `jpegtran`, licensed under the Independent JPEG Group license and BSD-style licenses. Source: https://libjpeg-turbo.org/
- sharp and libvips, used for static image inspection, thumbnails, resizing, and conversion. See `node_modules/sharp/LICENSE` and its bundled notices in release artifacts.
- Atkinson Hyperlegible Next and Lilex font files, licensed under SIL Open Font License 1.1. Preserve their copyright notices and [Atkinson license](assets/fonts/google/atkinson-hyperlegible-next-OFL.txt) / [Lilex license](assets/fonts/google/lilex-OFL.txt) with redistributed fonts. [The manifest](assets/fonts/google/manifest.json) records Google Fonts WOFF2 downloads, metadata, hashes and matching licenses. The shared renderer imports these canonical local assets.

The codec-fetch script pins release URLs and SHA-256 checksums before package assembly.

The browser candidate uses @imagemagick/magick-wasm 0.0.44. Preserve its [Apache-2.0 wrapper license](assets/licenses/magick-wasm-0.0.44-LICENSE.txt) and [complete native dependency notices](assets/licenses/magick-wasm-0.0.44-NOTICE.txt), including applicable LGPL terms. The [codec decision/source chain](docs/browser-codec-decision.md) identifies the exact artifact, corresponding sources and remaining public-binary redistribution obligations. Remage's MIT license does not relicense that combined WASM.

REUI MCP is connected development tooling. The shared renderer includes adapted free REUI Badge/Alert/intake-hook source and shadcn/Radix-nova Button/Card/dialog composition. Retain the [REUI MIT notice](assets/licenses/reui-MIT.txt), [shadcn MIT notice](assets/licenses/shadcn-ui-MIT.txt) and dependency licenses. [UI provenance](docs/ui-component-provenance.md) records reviewed URLs/hashes and adaptations. No premium icon/template/block source is bundled. Motion Icons require recorded written public-source/fork/rebuild/distribution permission before intake. See [the setup guide](docs/reui-setup.md). The application MIT license does not relicense third-party assets.
