# Selected Google Fonts assets

These fresh WOFF2 files implement the font choice in [design.md](../../../design.md). They are self-hosted assets, not runtime Google Fonts requests.

| Family | Purpose | Verified variable axis | Subsets |
| --- | --- | --- | --- |
| Atkinson Hyperlegible Next 2.001 | Headings, brand, controls, filenames and prose | wght 200–800 | Latin, Latin Extended |
| Lilex 2.621 | Sizes, dimensions, percentages and technical identifiers | wght 100–700 | Latin, Latin Extended |

[manifest.json](manifest.json) records provider URLs, retrieval date, Unicode ranges, byte counts, SHA-256 hashes, decoded metadata and matching licenses. The four WOFF2 files total 113,460 bytes. [fonts.css](../../design/fonts.css) supplies local declarations with `font-display: swap`.

Both families use SIL Open Font License 1.1. Ship the corresponding OFL files and copyright notices with redistributed font files. The embedded copyright text was matched to the downloaded notices. System fallback handles glyphs outside these subsets; do not claim bundled CJK coverage.

Maintain/update procedure:

1. Retrieve the Google Fonts stylesheet with a WOFF2-capable browser user agent and the required variable range.
2. Download only required subsets from the stylesheet's `fonts.gstatic.com` URLs. Preserve vendor bytes; fail on an unexpected file type or changed hash until reviewed.
3. Decode the WOFF2 name/fvar tables, match the family/version/range and copyright to the actual upstream OFL, and update the manifest hashes deliberately.
4. Update local declarations, check rendered typography/fallbacks and add the compatible assets to the PWA manifest when that implementation exists.

The three legacy font files in the parent directory remain used by the current renderer. Migration to these provenance-recorded downloads is planned; retaining them does not create a third font family.
