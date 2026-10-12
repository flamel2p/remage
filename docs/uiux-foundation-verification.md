# UI/UX foundation evidence

Verified 2026-10-08 in the local Remage workspace. This records preparation for [design.md](../design.md); it does not establish renderer adoption or release readiness.

| Check | Observed result |
| --- | --- |
| Downloaded fonts | Four Google Fonts variable WOFF2 files, two matching OFL notices and provenance/hash manifest are present; 113,460 total font bytes |
| Font decoding | Full fontTools/Brotli decoding and table checksum checks passed; Atkinson weight axis 200–800 and Lilex 100–700; embedded copyright agrees with the bundled notices |
| Asset integrity | All four font and two license SHA-256 values match the manifest; font CSS local URLs resolve |
| Token structure | CSS variable references resolve and the Tailwind mapping has no self-references; this is source validation, not Tailwind compilation |
| Numerical contrast | 52 foreground/background pairs calculated from `tokens.css` pass the selected thresholds: 4.5:1 for text and 3:1 for meaningful input/focus boundaries |
| Primary text contrast | Light default/hover/active: 6.04 / 7.69 / 9.42:1; dark: 7.69 / 9.69 / 5.97:1 |
| Minimum tested contrast | Text: 4.81:1, light muted text on muted surface; control boundary: 3.22:1, light input border on canvas |
| REUI tooling | OAuth login and live context, agent workflow, catalog/API lookup and icon metadata calls succeeded; live account reports Ultimate access |
| REUI style routing | `radix-nova` is configured in project TOML; live discovery used the earlier default Base routing. Reconnect and verify the style before component adoption |
| Credential exclusion | Project `.env.local` is Git-ignored with mode 0600; committable example has blank optional values; project MCP config has no credential literal |
| Document consistency | Edited local Markdown links resolve, task IDs are unique, and both plans retain all implementation tasks unchecked: 42 web and 33 desktop |
| Independent review | Read-only design, QA and technical reviews found no material inconsistencies in authority, rollout mappings, assets, credentials, rights gates or validation boundaries; two documentation wording issues were corrected |

Contrast calculations use sRGB relative luminance: linearize channels at 0.04045, apply coefficients 0.2126/0.7152/0.0722, then calculate `(lighter + 0.05) / (darker + 0.05)`. Tested pairs include both themes' main/muted text on canvas/Card/elevated/muted surfaces, primary default/hover/active text, input/focus boundaries on three surfaces, selected text, and four semantic states' soft and filled treatments. Decorative dividers are excluded. Actual opacity, composition and rendered states still require product checks.

Commands completed successfully:

```sh
openspec validate release-web-pwa-v1 --strict
openspec validate expand-desktop-platforms --strict
openspec validate --specs
git diff --check
git check-ignore .env.local
```

Additional read-only Python checks validated font decoding/metadata/hashes, local links, CSS references, TOML, file permissions, task identifiers and numerical contrast. The temporary Brotli validation dependency was installed outside the repository; no application dependency changed.

No premium REUI icon/component source was fetched or installed. Written Motion Icon redistribution permission remains pending. No renderer code, package manifest or lockfile changed in this foundation slice. Product tests/builds, Tailwind compilation, screen/keyboard/accessibility checks and PWA/offline qualification were not run; their implementation and evidence remain in the [web tasks](../openspec/changes/release-web-pwa-v1/tasks.md).

## Credential follow-up: 2026-10-12

Following Ekko's confirmation that both credentials were configured:

- Both `.env.local` entries are nonempty; the file remains Git-ignored and mode 0600, with no frontend-prefixed credential entries.
- Each credential independently passed isolated Bearer-authenticated MCP `initialize` and `get_project_context` requests: HTTP 200 and successful JSON-RPC results. Both context calls reported Ultimate and `radix-nova`/Radix when the configured style header was sent. Only credential names and allowlisted status/plan/style fields were printed.
- The existing in-session OAuth connector still succeeds, but reports Base routing. `codex mcp get reui --json` confirms that the project header is configured. Reconnect and verify the connector's resolved style before adopting components.
- Credentials are not present in this process environment; this check did not switch Codex from OAuth to token mode. The optional token remains available for deliberate headless use as documented in the setup guide.
- No premium registry download, source installation, redistribution-permission verification or product tests were performed. The original font/contrast/OpenSpec checks above were not repeated in this follow-up; document whitespace and local links were checked.

Authentication checks follow the [official REUI MCP smoke-test protocol](https://reui.io/docs/mcp) and [documented Bearer credential options](https://reui.io/docs/codex). Authentication and account entitlement do not establish premium registry source access or the recorded public-source rights gate.

## Renderer follow-up: 2026-10-12

The separate `release-web-pwa-v1` implementation now imports the canonical font/token assets into the shared renderer, with reviewed free REUI/shadcn Radix-nova source and pinned dependencies. Both typechecks, lint, 99 tests and native/web builds passed. Actual App Chromium processing/download/dialog/theme/responsive checks and independent isolated native strict-processing/publication/800px regression passed. [Web verification](web-verification.md) records exact commands, artifact identities, screenshots and limits; [source provenance](ui-component-provenance.md) records deliberate design/processing adaptations.

This follow-up does not retroactively change the original foundation-only evidence. Motion Icons remain deferred without written public-source rights. Manual screen-reader speech, actual 200% retail page zoom, full device/PWA/production qualification and WEB-STABLE remain open.
