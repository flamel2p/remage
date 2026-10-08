# Remage UI/UX source of truth

Adopted direction: 2026-10-08. Applies to shared web, PWA and later desktop UI. This document defines the visual and interaction rules; it does not claim the current renderer has implemented them.

## Authority and maintenance

- Maintain design decisions and review rules here. Maintain exact token values in [tokens.css](assets/design/tokens.css), local font declarations in [fonts.css](assets/design/fonts.css), and the Tailwind/REUI mapping in [reui-theme.css](assets/design/reui-theme.css). These files implement this document; resolve any discrepancy before changing a screen.
- OpenSpec owns feature behavior, platform capabilities, processing guarantees, permissions and release gates. Visual decisions must preserve those contracts. The [platform execution plan](docs/platform-execution-plan.md) owns rollout order.
- REUI examples, generated skill suggestions, screenshots and legacy CSS are references, not competing authorities. Adapt component source through these tokens and documented APIs.
- Every UI change reads this document and the active specification first. Change a shared rule/token deliberately in the same change as its consumers; record justified exceptions with the affected screen and reason. Keep one implementation owner for shared styling.
- Validate changed screens against the review gate below. Source inspection, a token calculation, a specimen preview and product runtime evidence are distinct results.

## Design language

A calm working utility: neutral image-viewing surfaces, a restrained violet action color, readable sans text and a compact data face. Images and processing results carry the visual interest. Keep the existing Optimizer/Converter structure, predictable settings, clear batch progress and explicit exports.

Use one Card surface family across the workspace, with subtle borders, limited elevation and consistent corner radii. Keep panels functional and compact. Marketing compositions, decorative gradients, glass panels, ornamental charts and continuously moving decoration do not belong in the processing workspace.

## Typography

The selected families are both available from Google Fonts and bundled locally under OFL 1.1. Fresh variable WOFF2 downloads, verified axes, byte hashes and matching copyright/license notices are in [the font manifest](assets/fonts/google/manifest.json).

| Role | Family | Size / line height | Weight |
| --- | --- | --- | --- |
| Brand and page title | Atkinson Hyperlegible Next | 28px / 1.2; 24px at narrow widths | 600–700 |
| Section heading | Atkinson Hyperlegible Next | 20px / 1.2 | 600 |
| Body and editable inputs | Atkinson Hyperlegible Next | 16px / 1.5 | 400 |
| Navigation and controls | Atkinson Hyperlegible Next | 14–16px / 1.45 | 600 |
| Desktop filenames | Atkinson Hyperlegible Next | 14px / 1.45; allow growth/wrapping | 500–600 |
| Help, status labels and secondary copy | Atkinson Hyperlegible Next | At least 13px / 1.45 | 400–500 |
| Bytes, dimensions, percentages, technical identifiers | Lilex | 13–14px / 1.45 | 400–500 |

- Atkinson is the heading, brand and UI family. Lilex is reserved for technical data; status words and filenames remain sans.
- Use rem sizes from tokens and honor browser zoom. Mobile editable inputs remain at least 16px. Use tabular figures for aligned numeric values; disable discretionary programming ligatures in file/data text.
- Use normal tracking for body/controls. Title tracking may be mildly tightened, up to -0.02em. Hierarchy comes from size, weight and spacing rather than uppercase paragraphs.
- Load local WOFF2 through [fonts.css](assets/design/fonts.css), with `font-display: swap` and real variable weights. Preload only the critical Latin Atkinson face if measurement justifies it; other subsets/data faces load when needed and join the verified offline asset manifest.
- Downloaded faces cover Latin and Latin Extended. Unicode filenames outside those subsets use system fallback; verify mixed-script and emoji filenames. Do not claim bundled CJK coverage.
- Italic is optional for intentional explanatory text. The existing local italic asset remains available; declare its actual 200–800 axis only if used. Avoid synthetic styles and retain its family license.

## Color and appearance

Primary identity: **Remage Violet #5B4BDB**. Light mode pairs it with white; dark mode uses the lighter violet token with dark ink. Exact foreground/background, hover/active, semantic and component pairs live in [tokens.css](assets/design/tokens.css).

- Follow system appearance by default; offer light/dark/system preference. Persist the preference only. Synchronize the root `.dark` class with the resolved system choice for REUI/Tailwind variants, and set an explicit root theme only for an explicit user choice.
- Use neutral canvas, Card and elevated surfaces. Accent is for primary actions, selected modes and focus. Image previews remain untinted; transparency checkerboards and the selected JPEG alpha background are independent of the UI theme.
- Normal text requires at least 4.5:1 contrast; large text and meaningful control/icon/focus boundaries require at least 3:1. Decorative dividers may be subtler; they cannot be the only control boundary. Inputs use the stronger `--input` token.
- State colors always accompany text or an icon. Completed uses success; unchanged/cancelled are neutral; processing uses the primary/info treatment; failure uses error; lossy conversion or preservation limitations use warning.
- A larger valid conversion stays completed and displays a signed byte increase. A browser download request is not a confirmed saved file. Preserve these OpenSpec meanings when applying colors or badges.
- Keep disabled labels readable. Use a disabled surface/treatment and true disabled semantics, rather than reducing an entire container's opacity indiscriminately.
- `light-dark()` and `color-scheme` select the palette without duplicate token tables. Check support on the declared browser matrix; any required compatibility fallback belongs in this token layer.

## Layout, spacing and density

- Use the 4px spacing rhythm in tokens: 4/8/12/16/20/24/32/40/48. Control radius is 8px, panel radius 12px, dialog radius 16px; full pills are for small state/selection treatments.
- Desktop working width caps at 1,040px with 24–32px outer gutters. Mobile uses 16px gutters and one column. Panels use 24px padding on wide layouts and 16px on narrow layouts.
- Primary and icon-control hit areas are at least 44×44 CSS px with comfortable separation, even when the visual icon is smaller. Rows start around 72px high and grow to fit content; avoid rigid row heights with zoom/wrapped names.
- Validate 375px, 768px, 800×600, 1,024px and 1,440px, plus 200% zoom and narrow landscape. The web page has no 800px minimum width. The native minimum remains a desktop contract.
- Below 768px, let brand/actions occupy a first header row and the two-mode selector a second row. Settings stack; filenames, status and row actions reflow. Keep the same reading order across layouts.
- Use one main page scroll region. Fixed/sticky chrome reserves its actual occupied space and safe-area inset; focused controls and final result actions must stay visible. Use dynamic viewport sizing where supported.
- File names can wrap or truncate with an accessible full-name disclosure. Preserve a shrinkable text child and `overflow-wrap: anywhere` for long unbroken tokens; expose names to keyboard/touch users, not only hover.
- Use the central layer scale for sticky chrome, scrims, dialogs, notices and tooltips. Apply elevation only to establish layering.

## Components and icons

### REUI foundation

Use **Radix-based `radix-nova`**, the Card surface family, REUI free components/examples, and their shadcn primitives. Core shadcn controls such as Button/Dialog/Select install by their own names; not every control is a REUI registry item. The [REUI setup guide](docs/reui-setup.md) records current readiness and adoption steps.

- Query the live MCP for exact item names, read APIs/examples, inspect dependencies and licenses, then use its returned registry command with reviewed/pinned tooling. Preserve primitive keyboard/focus behavior and align through shared tokens.
- Use needed controls only: operation selector, button, field, checkbox/switch, dialog, tooltip, alert, badge, progress and local intake composition. A simple file list fits the v1.0 web budget; adopt a Data Grid only for requirements needing its extra features.
- Map the complete REUI extended token contract, including info/success/warning/destructive foregrounds. Use [reui-theme.css](assets/design/reui-theme.css) when Tailwind v4 is introduced; review its reset against the existing native renderer.
- The file intake view connects to Remage's validator and registry. Remove simulated progress, demo URLs, remote thumbnails and upload endpoints. MIME `accept` is not content validation.
- Copy-and-own registry source stays local at runtime. Preserve third-party notices and record provenance/version/dependency review. Application processing cannot depend on the MCP or an online registry.

### Intended icon family: REUI Motion Icons

Ekko selected REUI Motion Icons once written public-source redistribution permission is obtained. Use **outline** consistently, normally 20px; 16px for inline data and 24px for larger empty-state affordances. Read each real API before applying size, color or animation props.

- Icons use semantic current color and align with control labels. Decorative icons beside equivalent text are hidden from assistive technology; meaningful standalone icons have an alternative; icon-only controls have an accessible name and state.
- Static glyphs are the default. Motion may respond to hover, keyboard focus or a meaningful state transition; avoid ambient loops. Respect reduced motion with the static equivalent and preserve the same meaning without animation.
- Search by action semantics. A cloud-upload/download symbol can falsely suggest remote processing; choose a local file/image/disk action where available. Do not invent registry names or mix outline/filled/duotone styles.
- **Rights gate:** account/Ultimate access permits discovery, not public source redistribution. Before importing premium icon source, record written permission covering Remage's public source, forks/contributions/rebuilds and intended distribution. Keep the applicable license/notices and describe any MIT exceptions accurately. An OEM agreement for icons does not automatically authorize premium blocks/templates.
- Until that gate passes, retain the current local icons as legacy assets; new premium icon adoption remains pending. Do not silently substitute another final icon family. The unresolved rights gate does not block independent core web implementation; icon migration is a separate slice.

## Interaction, feedback and accessibility

| Surface | Required states and recovery |
| --- | --- |
| Intake | Empty/picker, drag-active, inspecting, accepted, mixed rejection; actionable per-file reasons and keyboard picker alternative |
| Settings | Defaults, available/unavailable capability, invalid field, lossy acknowledgement and explicit metadata policy; visible labels and inline errors |
| Batch | Ready/queued/active/cancelling/completed/unchanged/error/cancelled; submitted settings remain stable and completed results survive unrelated failure |
| Export | Preparing/archive-ready/download-requested or native-published/error; eligible/excluded counts and retry without reprocessing |
| PWA | Setup/partial/offline-ready/cache recovery/update waiting; guidance reflects actual browser capability and a runnable shell |
| Dialog/notice | Named dialog, contained focus, Escape and trigger-focus return; severity-specific notice and relevant recovery action |

- Keep one dominant operation action for the current state. During work, provide cancellation and progress without disabling navigation needed to inspect results. Downloads are explicit result actions.
- Use native semantic inputs/buttons and Radix's documented behavior. Give every editable field a persistent label, units and linked error/help text. Put blocking validation near its cause.
- Focus is a 3px ring with offset, visible on both palettes and unobscured by sticky chrome. Preserve OS shortcuts, reading order, browser zoom and keyboard alternatives to dragging.
- Routine progress uses a polite contextual status region with throttled updates; reserve alerts for blocking errors. Do not announce every percentage or style informational notices as errors.
- Transitions use the shared 120/180/220ms tokens for color/opacity and small overlays. Motion cannot delay actions, shift surrounding layout or obscure results. Reduced motion removes nonessential transforms and animated icons.
- Processing, fidelity, size accounting, cancellation, export and offline wording comes from the relevant OpenSpec contract. Avoid implied savings, background completion or folder powers unsupported by the current adapter.

## Review gate for every UI change

1. Identify the affected surface, active spec and token/component decisions; update the authority or document a narrow exception if needed.
2. Check UI and data family roles, available weights, minimum text sizes, Unicode/long names, and locally loaded fonts.
3. Check light/dark hover/active/disabled/selected/error treatments, composed text/control contrast and image-preview neutrality.
4. Exercise keyboard flow, labels/errors, dialog focus, announced state changes, touch targets, reduced motion and zoom on the affected flow.
5. Check the affected layout at the declared breakpoints with empty, busy, mixed-error and completed content; include real mobile/PWA evidence when the change depends on those surfaces.
6. Check real processing/download/publication semantics and local-only asset/data behavior; verify any REUI source/dependency/license intake separately.
7. Report commands, screen/viewport/action, observed result, remaining limitations and artifact identity. A token/specimen pass does not establish product accessibility or release readiness.

## Current implementation gaps

The inspected renderer still uses Lilex for headings/brand/status, scattered literal colors, 12px secondary text and an 800px body minimum. It has no token-based dark mode or Tailwind/shadcn foundation. These are migration tasks in the web change, not completed by publishing these rules. New downloaded fonts and tokens are not yet imported into the production renderer.

## Decision sources

- Ekko's 2026-10-08 request and subsequent selection of Motion Icons conditional on written redistribution permission.
- [Product typography/visual requirements](docs/product-requirements.md), [current renderer](src/renderer/src/styles.css), [web requirements](openspec/changes/release-web-pwa-v1/specs/web-workspace/spec.md), and [platform execution plan](docs/platform-execution-plan.md).
- [Google Fonts Atkinson source](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext) and [Lilex source](https://github.com/google/fonts/tree/main/ofl/lilex); downloaded assets/licenses and verified local metadata are recorded in the font manifest.
- [REUI styling](https://reui.io/docs/styling), [registry](https://reui.io/docs/registry), [MCP](https://reui.io/docs/mcp), and [license terms](https://reui.io/legal/license), checked 2026-10-08. Live MCP context, skill and catalog calls are recorded in the setup guide.
- [Foundation verification](docs/uiux-foundation-verification.md) records asset, token, contrast, tooling and planning checks separately from pending product UI validation.
