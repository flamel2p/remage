# Third-party notices

Remage packages these components when building the macOS application:

- OxiPNG 10.2.1, licensed under MIT. Source: https://github.com/oxipng/oxipng
- libjpeg-turbo 3.2.0 and `jpegtran`, licensed under the Independent JPEG Group license and BSD-style licenses. Source: https://libjpeg-turbo.org/
- sharp and libvips, used for static image inspection, thumbnails, resizing, and conversion. See `node_modules/sharp/LICENSE` and its bundled notices in release artifacts.
- Atkinson Hyperlegible Next and Lilex font files supplied in this repository. Their upstream licenses must remain with any redistributed font files.

The codec-fetch script pins release URLs and SHA-256 checksums before package assembly.
