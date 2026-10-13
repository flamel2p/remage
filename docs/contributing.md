# Contributing to Remage

The active [web/PWA change](../openspec/changes/release-web-pwa-v1/tasks.md) controls the current release scope. Desktop Windows/Linux expansion starts after the recorded WEB-STABLE gate. [design.md](../design.md) owns shared UI rules; OpenSpec owns behavior and release acceptance.

Use Node 24 and pnpm 11 with the committed lockfile. Install with `pnpm install --frozen-lockfile`. The existing macOS app starts with `pnpm fetch:codecs` then `pnpm dev`; native codec acquisition does not install system-wide executables. Web commands and actual validation results are recorded in [web verification](web-verification.md) as implementation lands.

Keep changes scoped and preserve the native adapter. Read affected source and the active specification, propose non-trivial behavior changes through OpenSpec, and run the relevant checks. A passing unit test/build does not establish physical-device, installed-PWA or production behavior. Report exactly what ran, with browser/device and build identity for runtime evidence.

## Local verification

Install the browser binaries matched to the pinned Playwright version with `pnpm exec playwright install chromium firefox webkit`; see [Playwright's browser installation guide](https://playwright.dev/docs/browsers). This installs test browser builds, not retail Chrome, Edge or Safari. The integration harnesses also use `unzip`; on macOS Unicode extraction uses `bsdtar`. Linux browser system dependencies and Linux execution remain unqualified.

```sh
pnpm typecheck
pnpm typecheck:web
pnpm lint
pnpm test
pnpm build
pnpm build:web
pnpm verify:web:boundary
pnpm verify:web:core
pnpm verify:web:ui
pnpm verify:web:pwa
```

Core and UI harnesses exercise `dist/web`; rebuild it after product changes. The PWA harness builds its own complete A/B artifacts at `/` and `/remage/`, exercises the three browser engines, and removes its owned temporary servers/artifacts. It tests the real 60-second processing deadline, so allow several minutes. Optional engine arguments, for example `pnpm verify:web:pwa firefox`, narrow investigation; `--recovery-only` omits the format/cycle/timeout matrix and cannot replace a full run. Evidence and screenshots stay in ignored `output/playwright`; preserve exact build IDs/digests with the permanent verification record.

WebKit recovery tests disconnect every request to the local origin because automation's offline override locally rejected cached service-worker responses; a [related upstream report](https://github.com/microsoft/playwright/issues/42775) describes this limitation. A fresh context with service workers blocked must fail navigation as the control. This proves cached application operation without that origin; physical-device airplane mode, installed restart and background/BFCache behavior need separate manual evidence.

Use synthetic, licensed fixtures in `test-fixtures/images`; regenerate them through the committed script. Do not commit user images, private filenames/paths, native destinations, credentials or screenshots containing private data. Processing inputs/results stay session-only; persisted preferences and service-worker caches must exclude them. Reports use the [reproducible bug template](../.github/ISSUE_TEMPLATE/bug_report.yml); Remage collects no automatic issue telemetry.

Physical-device, retail-browser and installed-PWA qualification follows the [manual procedure](manual-web-qualification.md), with a separate [report](templates/web-qualification-report.md) per surface/artifact. `node tools/web-qualification/generate-fixtures.mjs` creates synthetic 1/12/16 MP and exact byte/dimension/count inputs plus hashes in ignored `output/playwright/manual-qualification/fixtures`. Generating fixtures is not a passed resource benchmark; record actual timings, available memory observations and unperformed checks.

Keep registry source local and record its provenance, exact dependencies and applicable notices. Public-source rights for REUI Motion Icons remain pending: do not submit premium icon/block/template source based solely on account entitlement. Preserve font OFL and dependency licenses independently of Remage's MIT license. The browser WASM candidate's corresponding-source/rebuild/relink release gate is in [the codec decision](browser-codec-decision.md).

Optional development registry credentials belong in ignored root `.env.local` as `REUI_LICENSE_KEY` and `REUI_MCP_TOKEN`. Never prefix them with `VITE_`, place literal values in configuration, expose them in logs, or include them in web/PWA artifacts. Follow [credential maintenance](reui-setup.md).
