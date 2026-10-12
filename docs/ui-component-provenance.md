# Shared UI source intake

Reviewed and adopted 2026-10-12 for tasks 7.1–7.5. Actual renderer validation is recorded separately in [web verification](web-verification.md). Root [design.md](../design.md) remains authoritative over registry defaults.

| Selected source | Explicit Radix registry / API | Retrieved registry SHA-256 |
| --- | --- | --- |
| REUI use-file-upload | https://reui.io/r/radix-nova/use-file-upload.json | `566294f0084d2c0bd7738e868ff6034b897ba4aedbc56d0930e14f23ab4fb6d5` |
| REUI Badge | https://reui.io/r/radix-nova/badge.json | `57b12b8298c4be86cccdd55f7f6306e73df86850d3abbb30ae06d44510eeb454` |
| REUI Alert | https://reui.io/r/radix-nova/alert.json | `2746c12047d4a0924477e45721af6be1deba6a1928fac9623c47848c0ea879b2` |
| shadcn Button | https://ui.shadcn.com/r/styles/radix-nova/button.json | `c07a8feb7b7ed07ad5279023e45ce23ed7b5b94c7dba3de5c08f30a2aa037de3` |
| shadcn Card | https://ui.shadcn.com/r/styles/radix-nova/card.json | `acf04c936ab6b613ed761067d8c2963508ba0f009f2accf2565aa5c3aeb4c06a` |

The live MCP returned real APIs/registry names for File Upload, Badge and Alert. Its reused connector still advertises default Base routing; the reviewed registry URLs explicitly select radix-nova. Do not infer Radix dependencies from that Base context. Dialog follows the [documented Radix API](https://www.radix-ui.com/primitives/docs/components/dialog) and [shadcn composition](https://ui.shadcn.com/docs/components/radix/dialog), including asChild trigger/close, named content, focus containment and trigger return.

Retain [REUI's MIT notice](../assets/licenses/reui-MIT.txt) and [shadcn's MIT notice](../assets/licenses/shadcn-ui-MIT.txt). The reviewed free source is covered by [REUI's public-source MIT terms](https://reui.io/legal/license); no proprietary template/block/icon source is selected. MCP workflow version 68f0e6fa91 was read without running its global/vendor configuration installer.

## Required adaptations

- The intake hook provides picker/input/drag interactions only. Remage's adapter owns content validation, duplicate identity, count/budget admission and previews. Remove filename/size deduplication, all-or-nothing mixed-file returns, previews allocated before validation and demo/upload/remote-image behavior. Keep keyboard selection and nested drag state. Native selection continues through its OS bridge.
- Replace bare registry `cn` imports with the local reviewed clsx/tailwind-merge helper and aggregate radix-ui imports with the specific pinned Radix packages needed. This avoids installing unrelated primitives. Do not overwrite root token definitions with registry `cssVars`.
- Root design requires 44px controls, 13px minimum secondary text, 16px editable inputs and 24px/16px Card padding. Adapt the copied variants centrally; registry nova defaults are smaller. Preserve primitive APIs and interaction semantics.
- The registry's light Badge variants use foreground roles that differ from Remage's solid foreground pairs. Map light status variants to the explicit soft surfaces plus strong semantic text; validate composed contrast in both themes. Do not use white solid-foreground text over a pale status background. Remove unused variants requiring undefined focus tokens instead of inventing values.
- Use Atkinson for UI/status/file text, Lilex for numeric data, the complete local theme mapping and no entrance/ambient animation. Reduced motion follows root tokens. Keep existing local icons until written redistribution rights are recorded.

These adaptations are implemented in `src/renderer/src/components`, `hooks/use-file-upload.ts`, `lib/utils.ts`, shared stylesheet and both Vite/TypeScript alias configurations. Direct pins: Tailwind/@tailwindcss/vite 4.3.3, Radix Dialog 1.3.0, AlertDialog 1.2.0, Slot 1.5.0, CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0. CVA is Apache-2.0; [its exact license](../assets/licenses/class-variance-authority-0.7.1-APACHE-2.0.txt) is retained. Release-age exceptions are exact Radix package/version entries, not wildcard exemptions. supportedArchitectures includes the current build host alongside existing Darwin targets; non-macOS builds are not yet verified.

The live REUI audit checklist was read on 2026-10-12. Generic prohibitions on changing source/theme defaults conflict with the approved root design and local processing contracts; the narrow adaptations above are deliberate. No premium block, Data Grid, remote demo media or alternate icon family is adopted. Fixed chrome uses measured heights; the Radix modal is bounded by the viewport and safe-area insets. Motion is limited to token-based color transitions with reduced-motion removal; theme screenshots must wait for finite transitions to finish. Full manual accessibility/device qualification remains open.

Local typechecks, lint, 99 tests, both builds and actual-App Chromium smoke passed. Browser layouts were checked at 375/768/800×600/1440 in light/dark; native 800×600 strict-processing/publication and Radix regression passed separately. These observations do not complete manual screen-reader, retail zoom, physical/PWA or WEB-STABLE gates. Existing local SVG icons are the explicitly deferred release scope; written premium redistribution rights have not been supplied.
