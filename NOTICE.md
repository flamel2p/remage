# Third-party notices

Remage packages these components when building the macOS application:

- OxiPNG 10.2.1, licensed under MIT. Source: https://github.com/oxipng/oxipng
- libjpeg-turbo 3.2.0 and `jpegtran`, licensed under the Independent JPEG Group license and BSD-style licenses. Source: https://libjpeg-turbo.org/
- sharp and libvips, used for static image inspection, thumbnails, resizing, and conversion. See `node_modules/sharp/LICENSE` and its bundled notices in release artifacts.
- Atkinson Hyperlegible Next and Lilex font files, licensed under SIL Open Font License 1.1. Preserve their copyright notices and [Atkinson license](assets/fonts/google/atkinson-hyperlegible-next-OFL.txt) / [Lilex license](assets/fonts/google/lilex-OFL.txt) with redistributed fonts. [The manifest](assets/fonts/google/manifest.json) records fresh Google Fonts WOFF2 downloads, metadata, hashes and matching licenses; legacy files remain in use until renderer migration.

The codec-fetch script pins release URLs and SHA-256 checksums before package assembly.

REUI MCP is connected development tooling. No REUI component or premium icon source is currently bundled by this setup. Future free MIT component intake must retain its actual copyright/license notice; Motion Icons require the separately recorded written public-source redistribution permission and applicable notices before intake. See [the setup guide](docs/reui-setup.md). The application MIT license does not relicense third-party assets.
