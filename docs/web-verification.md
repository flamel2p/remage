# Web/PWA implementation and verification

Started 2026-10-12. Active change: release-web-pwa-v1. Status: **local web/PWA candidate implemented; release qualification open; WEB-STABLE not approved**. Record only observed checks, distinguishing source tests, local artifacts, browser engines, physical devices and deployed releases.

## Native baseline before extraction

Source: commit 9a8aba5b5615e9c346f5691f5647eb2d1039fc5d. Host: macOS 27.0.1 (26A434), arm64; Node 24.14.1, pnpm 11.18.0, Electron 44.3.0.

Named local test host (allowlisted hardware inventory, 2026-10-12): MacBook Pro **Mac16,8**, Apple **M4 Pro**, 14 cores (10 performance / 4 efficiency), **48 GB RAM**. This is a high-memory laptop, not weakest-device evidence. No phone timing/memory measurement is available yet.

| Command | Observed outcome |
| --- | --- |
| pnpm typecheck | Passed |
| pnpm lint | Passed |
| pnpm test | Passed, 8 files / 22 tests |
| pnpm build | Passed, Electron main/preload/renderer; two nonfatal Zod annotation warnings |

Independent QA launched the existing baseline out artifact using cached Playwright in an isolated temporary Electron profile. The native bridge returned default preferences, metadata and codec capabilities. A stubbed file-dialog response exercised actual public bridge/IPC and content intake. A synthetic PNG was strictly optimized from 1,151 to 157 bytes with identical decoded samples and unchanged source bytes. PNG-to-WebP resizing produced 32×16 output and published actual bytes into the task temporary destination. Serialized paths remained opaque. Settings focused Close, retained sampled Tab focus, and returned focus on Escape/Close; no page errors were observed. The isolated app/profile/files were cleaned up.

Limits: OS file-dialog interaction was stubbed; no downloaded/notarized package, Intel/Windows/Linux or production artifact was exercised. A baseline 800×600 UI had horizontal overflow; shared responsive implementation must fix and recheck it. This baseline does not prove the extracted build or browser behavior.

## Prepared corpus and candidate codec

### Native API extraction regression

After API injection on 2026-10-12, `pnpm build` completed successfully and an isolated Electron 44.3.0 / Playwright 1.62.1 smoke exercised the freshly built `out` artifact. The actual bridge reported desktop platform capabilities, original native defaults and legal metadata. Synthetic PNG strict optimization produced 156 bytes from 8,325 bytes; independently decoded RGBA, including hidden transparent RGB, matched. Native publication to a temporary destination succeeded. Requeue from retained original bytes produced a valid 32×16 WebP (1,426 bytes) and published it. The source SHA stayed unchanged; no raw source/destination path was exposed in snapshots. Settings initial focus, sampled Tab containment, Escape/Close trigger return passed, with no renderer page errors.

OS picker returns were stubbed to isolated synthetic files/destinations; real OS picker interaction and packaged release remain outside this check. The old shared layout still overflows at 800×600 (scrollWidth 800 versus clientWidth 785). The isolated app/profile/files were removed; this smoke did not alter real preferences or user files. Shared UI migration must resolve that layout defect and repeat native verification.

Extraction artifact SHA-256 values: main `ed8f1867b3d05ce44ddd4447b92ada0e9603a2f1304ee7e48c9998e8093e4564`; preload `9d97254411d0c4bb041779f9bddf04ea86e6512ba7fd9f058911de6b474aee51`; renderer HTML `9fecbdb2c02132de1e6b438e1e394c7306ed012f9a8c6702b61dad27752554cb`. These identify the extraction smoke, not the later responsive release artifact.

The [MIT synthetic encoded-image corpus](../test-fixtures/images/README.md) contains 17 real encoded or explicitly malformed fixtures and a purpose/hash manifest. Generated with node scripts/generate-web-fixtures.mjs on this host. The [codec decision](browser-codec-decision.md) records the exact WASM version/hash/runtime-format reports and initial hidden-RGB lossless WebP check. Full transformation, browser and boundary evidence will be recorded as checks complete.

### Browser core milestone

Developer-owned checks on 2026-10-12: `pnpm typecheck`, `pnpm typecheck:web`, `pnpm lint`, `pnpm test` (99 tests / 11 files, including 77 browser tests), `pnpm build`, `pnpm build:web`, and `pnpm verify:web:boundary` passed. The boundary harness rejects Sharp, Electron, node:fs and native-engine imports. Core tests use real encoded fixtures and the pinned WASM with independent Sharp sample checks; service fault/resource tests use injected Workers. These are different evidence classes.

The real-codec tests cover eight encoded-source varieties to all three outputs, all eight JPEG orientations and PNG/WebP EXIF orientation 6, exact lossless WebP including hidden RGB, explicit metadata removal/default rejection, unsupported ICC/CMYK/calibration/depth/animation, selected JPEG alpha background, output growth, source/planned-output and archive admissions, immutable settings/requeue, stale/malformed responses, timeout and cancellation cleanup. A focused regression holds ZIP validation paused through cancellation/clear/timeout, keeps its reservation until cleanup, suppresses duplicate completions and prevents overlapping Worker admission.

`pnpm verify:web:core` used the emitted production Workers/WASM in Playwright Chromium **151.0.7922.34**, Firefox **153.0**, and WebKit **26.5**. Each engine completed four real transforms, a three-entry Unicode STORE ZIP and two actual byte-verified downloads; independent `unzip -t` passed. Each observed ten same-origin application-asset requests, no non-GET/network uploads and no page errors. The emitted WASM matches the pinned SHA above. This harness does not exercise shared UI, service-worker installation, physical devices, retail Safari/Edge, installed surfaces or a deployed artifact.

Independent QA and technical lead reviewed bounded core source/tests. Their final P1 findings (unsupported EXIF ReferenceBlackWhite and reservation cleanup during asynchronous ZIP validation) were fixed with focused regressions. No remaining P0/P1 was found in that bounded source review; the reviewers did not independently rerun the reported suites. Phone/laptop memory measurement remains outstanding.

### Shared UI milestone

The UI owner reran both typechecks, lint, all 99 tests and both builds successfully. `pnpm verify:web:ui` exercised the actual production App in Chromium 151.0.7922.34: mixed real valid/unsupported intake, a resize validation error followed by a real 32px transform, individual PNG download, separate ZIP preparation/download, Settings Close initial focus/Escape/trigger return, explicit light/dark preference and clear-session keep/confirmation. No page errors or horizontal overflow were observed at 375/768/800×600/1440 in both themes. Nine screenshots are under ignored `output/playwright/web-ui`. Early theme screenshots can capture the 120ms color transition; settled frames/computed styles must be used for contrast evidence. Root visually inspected empty mobile and completed desktop/mobile frames; later settled desktop dark uses the canonical palette.

Independent QA repeated native behavior on the revised shared UI in an isolated Electron 44.3.0 / Chromium 152.0.7977.78 runtime: strict PNG 8,325→156 bytes with all RGBA/hidden RGB equal, real temporary publication and unchanged source; original requeue→32×16 WebP (1,426 bytes) with real publication. Platform/defaults, appearance persistence, local Atkinson availability and numeric Lilex passed. Radix named Settings, Close initial focus, sampled Tab/Shift-Tab containment, Escape and Close trigger return passed. Both themes at 800×600 had scrollWidth/clientWidth 785/785 and no page errors. The isolated process/profile/fixtures/exports were removed. OS dialogs were stubbed and one synthetic fixture was used; no packaged or broader metadata qualification is claimed.

Native UI artifact SHA-256: main `86eb5e0192aa5bf84bdb30a4e3f81ec721235b304cc02512cfbc770ac622cca7`; preload `9d97254411d0c4bb041779f9bddf04ea86e6512ba7fd9f058911de6b474aee51`; renderer HTML `ff70799d286f087a9ef2664210a0388834bf7c01a476d5c077c907b97aaf3eba`; renderer `index-D2Zr6dJ9.js` `abec06a85aca4817d5b3546fa8644e7188c6b423ec95de482f0c26e9e7aac8ae`; CSS `index-BkknQgr2.css` `5a8317719f402086962483a904b6cff2e9c04be785cf8654e2b54e56ed67f838`. Exact local runtime evidence and settled screenshots are in ignored `output/playwright/native-ui`; the values identify this milestone, not a later PWA/public artifact.

Remaining UI gates: full composed contrast/state coverage, real target browsers/devices, manual screen-reader speech and actual 200% page zoom. Native UI automation could not attach retail Chrome (`cgWindowNotFound`), so it did not establish page-zoom evidence. CSS/pinch/DPR emulation is not substituted for that check. Icon scope is explicitly the existing local SVGs; written Motion Icon redistribution rights are absent.

### Native publication receipts

The PWA implementation owner added distinct native publication receipts to successful manual and automatic exports. A receipt contains the selected opaque destination ID and is created only after `OutputPublisher` succeeds; raw paths remain absent from snapshots. Pending/retried/failed manual publication clears an older success receipt. Focused native service tests exercise real temporary file publication, automatic WebP publication and failed destination retry; they passed in the owner's 108-test interim run. That run is an implementation checkpoint, not the final candidate or a new packaged runtime smoke.

Independent QA then repeated the actual native bridge/runtime on the rebuilt receipt-sensitive artifact. Manual strict PNG and resized WebP publication returned opaque `native-published` receipts; invalid-destination retry emitted pending without the prior receipt/path, failed without a receipt/path, and valid retry collision-safely published identical PNG bytes. Separate automatic destination publication produced a 156-byte strict PNG with the same opaque receipt semantics. Original 8,325-byte source SHA and all decoded RGBA/hidden RGB remained unchanged. Defaults/platform, local fonts, appearance persistence, named dialog/focus and both themes at 800×600 passed again (785/785, zero page errors). QA cleaned the isolated process/profile/inputs/manual and automatic exports. OS dialogs were stubbed; this remains one synthetic fixture and an unpackaged local artifact.

Receipt smoke artifact SHA-256: main `cadbbfe3e7c918f2201aa285afe439a6396c4bb75a35334de55d20746c3cf0cd`; preload `9d97254411d0c4bb041779f9bddf04ea86e6512ba7fd9f058911de6b474aee51`; renderer HTML `a9b8cf198bac8bc45e6f33ca51a12139b199d550d489cad54502919ee32d52ab`; `index-WTM7kbXA.js` `abec06a85aca4817d5b3546fa8644e7188c6b423ec95de482f0c26e9e7aac8ae`; `index-o58mPEwe.css` `f5537ba3a86c42a58b7279285f15db5aabf136f6b2e4e4cced88ee48e6b5f808`. Full local observations are in ignored `output/playwright/native-ui/receipt-evidence.json`.

### Frozen candidate source and artifact checks

On the frozen candidate, the implementation owner passed both typechecks, lint, the complete Vitest suite (**114 tests / 13 files**, including **91 browser tests / 5 files**), native and web builds, and the import-boundary harness's four forbidden-import cases. The emitted-worker core harness passed again in Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5: four transforms, three ZIP entries and two byte-verified downloads per engine, with zero page errors. The native rebuild matched every artifact hash in `output/playwright/native-ui/receipt-evidence.json`, including main/preload/HTML/JS/CSS/fonts; this is artifact equivalence to the independent receipt smoke, not a new packaged or physical-device run.

Canonical untagged root artifact (`dist/web`): build ID `b358a5af612b9a6aff5bb5682b9be778ae56909139f9083bb52e1713147db7fc`; asset digest `4b95478bdd4c4c04c22e2b05f980951fcc00ea5760d0bf7d8d37203d8b4462fc`; service-worker SHA-256 `776053444b4953c26ca40c461c2a85601e60be9f8af1e496029306177fca740c`. The inventory contains **32 assets / 16,646,555 bytes**; disk count is 34 including the two derived files. Independent QA verified every asset SHA/length, digest, HTML/entry/worker embedded identity, manifest scope/start URL, 192/512 icons, four WOFF2 fonts and 18 notice/license files. WASM matches the pinned codec SHA. Tagged A/B lifecycle fixtures are separate artifacts and must be identified separately.

Root checked both configured REUI keys as nonempty, `.env.local` ignored and mode 0600, and finally scanned tracked/nonignored source, canonical web/native outputs and ignored local verification records/helpers (520 files): **zero exact credential-value matches**. Values were neither printed nor written to this record.

Exact final commands, all exit 0:

```sh
pnpm --config.verifyDepsBeforeRun=false run typecheck
pnpm --config.verifyDepsBeforeRun=false run typecheck:web
pnpm --config.verifyDepsBeforeRun=false run lint
pnpm --config.verifyDepsBeforeRun=false run test
pnpm --config.verifyDepsBeforeRun=false run test:web
pnpm --config.verifyDepsBeforeRun=false run build
pnpm --config.verifyDepsBeforeRun=false run build:web
pnpm --config.verifyDepsBeforeRun=false run verify:web:boundary
pnpm --config.verifyDepsBeforeRun=false run verify:web:core
pnpm --config.verifyDepsBeforeRun=false run verify:web:ui
pnpm --config.verifyDepsBeforeRun=false run verify:web:pwa firefox webkit chromium
git diff --check
```

Runtime tooling: Node 24.14.1, pnpm 11.18.0, TypeScript 5.9.3, Vitest 4.1.11, Vite 7.3.6 and Playwright 1.62.1. The per-command pnpm override avoids automatic repair of the existing installed modules tree; no fresh install was tested. Upstream Zod PURE-comment annotation warnings were nonfatal. Actual-App Chromium UI passed mixed intake, one transform, two downloads, widths 375/768/800/1440, both final palette assertions and zero page errors. Its screenshots do not consistently await finite color transitions and remain unqualified for settled color/contrast sampling; task 7.4 stays open.

### PWA lifecycle candidate

The frozen Firefox-first full run exited 0 and produced six aligned records in ignored `output/playwright/web-pwa/evidence.json`, SHA-256 `7a92c941fa40f39b7ce134ec4ded4d04872e8fac3f34028ae900a151cebcdf59`. Root and independent QA reviewed all records; independent UI/technical source review found no remaining P0/P1 in its bounded scope. Reviewers audited source and evidence rather than independently rerunning the complete suite. Earlier incomplete or superseded runs are investigation milestones, not this candidate's evidence.

At `/`, every engine completed the nine PNG/JPEG/WebP conversion pairs offline after reload, nine byte-verified individual downloads and a nine-entry Unicode/collision-safe ZIP with independent CRC/extraction/hash checks. Lossless samples, hidden transparent RGB, orientation, metadata/default rejection, ICC rejection and JPEG acknowledgement/background were checked. Each ran 20 mixed valid/unsupported batches and five cancellations, captured submitted settings despite later UI changes, and retried the real 60-second processing deadline. Cancellation and timeout hold actual Worker completion delivery; codecs still run. These prove lifecycle handling, not heavy-construction cancellation latency or physical memory limits.

| Engine | Version | Workers created / terminated after cycles | Deadline observed | Page errors |
| --- | --- | --- | --- | --- |
| Firefox | 153.0 | 56 / 56, active 0 | 61,130 ms | 0 |
| WebKit | 26.5 | 57 / 57, active 0 | 60,246 ms | 0 |
| Chromium | 151.0.7922.34 | 56 / 56, active 0 | 60,227 ms | 0 |

All engines at **both `/` and `/remage/`** passed selective WASM/font/image-Worker/CSS eviction restoration; corrupt bytes, redirects, HTML fallback and incorrect CSS MIME rejection; selectively missing entry-JavaScript navigation repair; failed N+1 precache retaining N and removing its partial cache; two-client waiting updates with an active transform; explicit keep/discard; complete-cache eviction showing a self-contained 503 recovery page; normal close-all activation; and coherent rollback with offline reload. Chromium's second client was frozen through CDP; other engines used two open clients. Reopening includes a one-second allowance for normal asynchronous closed-client release. There is no forced activation, automatic reload, old-cache deletion or session discard. Failed-install assertions observe terminal cleanup while the fault is held; they do not claim permanent installer quiescence. **Subdirectory records cover recovery/update/rollback, not the entire root conversion/cycle workload.**

Privacy inspection verified every cached body SHA/length against the exact application inventory, no input/name/Blob URLs, settings-only localStorage, empty sessionStorage and empty fresh IndexedDB listings. Server observations were same-origin GETs without input canaries or query strings. Candidate CSP, nosniff, referrer and Permissions-Policy headers from [static hosting](static-web-hosting.md) were applied locally; production headers remain unverified.

Chromium and Firefox use Playwright's context-offline override. WebKit locally rejected cached responses under that override; the harness drops **all origin sockets**, including service-worker fetches, and a fresh service-worker-blocked context must fail navigation. A [related upstream report](https://github.com/microsoft/playwright/issues/42775) describes this automation limitation. This is origin-unavailable evidence, not real-device airplane mode. Ordinary-browser processing/download fallback was exercised with the service-worker capability synthetically disabled. Persisted pagehide/pageshow events were simulated and retained results/prepared ZIP; actual BFCache, installed restart, background execution and physical devices remain unqualified.

Lifecycle fixture identities below use nonsecret QA tags `a`/`b`. They share the frozen source with the canonical untagged artifact but have different embedded IDs. Each base's identities agree across all three engines.

| Base / fixture | Build ID | Asset digest | Service-worker SHA-256 |
| --- | --- | --- | --- |
| `/` A | `6883d3569d8b494a6aa853a8fac72f9d91612e9e7f7570b8132da4fd83ef4d15` | `715c25de8640a245bdfcad0893005a32a72c7c6061b59185ccb9e325c9d68998` | `3dd3a28fbe560da63551b5f21e857e20c60f23a58303c5905f6bb4282e87ec71` |
| `/` B | `876ca457890c014817a2b3be8a4ef58a2d168481f6dd0568c4211b22b01544de` | `40bdbcd8183cb47457e888d92a0ba5c7633dfc071cfc9c8a3d6c46b396c9b180` | `f9d508fbf1364e3c93f56e4abdb59350ae7ca74b2f65803d8c0d238b83fd755a` |
| `/remage/` A | `7568716486629faecdc10720e1ec55161cd5d85ff350184bd8c24f0dc73eafca` | `bc414f90abf4d697de42882b6a76a6ab753e31c1a50db27c485130d97d5fad0d` | `3adb9b9edb0101ef06077a34e8e33c444b0f257c6936e55378bb208e2129c756` |
| `/remage/` B | `ac6bd4caff743c9fa88594f174a83ed4689484465e61cdfe23ee24283dcf75aa` | `de19328ba9e16d4ef440e1efc8ebf47d5bf664692db81f12001bd006705d4e3e` | `9c0be88e7acb2b569ab8cebad2ef37a4224f40c1a55a11ef9ecbeea5fd339680` |

Owned browsers, contexts, servers and temporary artifacts were closed/removed; the owner verified its process and observed listener absent. Unrelated pre-existing browser profiles were preserved. No public deployment, package release or desktop expansion was performed.

### Real archive construction cancellation

Independent QA additionally exercised the canonical untagged App in Chromium 151.0.7922.34 on the named Mac host using four deterministic 1024×1024 noise PNGs. Four actual results were 3,151,794–3,151,804 bytes each. With **unmodified Worker responses and no held delivery**, the first real progress message reported 1/4 entries; an actual Cancel ZIP DOM button click terminated that Worker before any completion event. All four results remained and no prepared archive appeared. Eleven animation frames and nine timer ticks advanced during the cancelled construction. This is a programmatic real UI action, not manual click-latency or weakest-device evidence.

Retry emitted all four progress messages and a real completion while 53 animation frames and 44 timer ticks advanced. The actual downloaded ZIP was **12,607,612 bytes**, SHA-256 `d5516295da4409bf422c3002c910105e6ab3ca8e302f7445cf42c3ff88c9cb0d`; independent `unzip` CRC and extracted SHA-256 values matched all four individual downloads. Zero page errors. Evidence: ignored `output/playwright/web-pwa/real-zip-cancel-evidence.json`, SHA-256 `a3339fb2d5d330b9c069ef3831c1b26a1370e8137d9312349cc5950b5da540f3`. The ad hoc helper is preserved in ignored `output/playwright/web-pwa/real-zip-cancel.mjs`, SHA-256 `98decfe1412ea5087c7c323ac2ef20d507c6a51e4f4f289361a7aedc96779004`; it is local evidence, not a committed clean-checkout verification command. QA removed owned temporary fixture/download directories and confirmed its listener closed; canonical and six-record identities remained unchanged. Together with source admission/invalid-output/empty-selection/failure/timeout tests and the three-engine Unicode/byte-verified App suite, this closes local task 6.4. It does not complete physical or full target-matrix tasks 3.5/10.2/10.3.

## W-01–W-12 evidence ledger

| Gate | Current evidence / outstanding qualification |
| --- | --- |
| W-01 Format matrix | Nine offline root pairs passed in all three test engines; retail/device/installed matrix pending |
| W-02 Fidelity | Independent encoded samples/orientation/background, metadata/default rejection and unsupported-color corpus passed locally; physical target qualification pending |
| W-03 Resources | Admission/reservation tests and 20 mixed/5 held-cancellation cycles per engine passed; weakest-device timing/memory and real heavy-work cancellation pending |
| W-04 Lifecycle | Failure/timeout/retry, teardown, actual archive fetch failure/retry and simulated persisted events passed; real BFCache/background/installed lifecycle pending |
| W-05 Immutable settings | Real App settings capture, original requeue and native requeue passed; complete physical target qualification pending |
| W-06 Accounting | Growth/error/cancellation/result counts and repeated real mixed batches passed locally; physical resource qualification pending |
| W-07 Downloads/ZIP | Actual three-engine nine-download/nine-entry ZIP bytes/CRC, safe Unicode names and failure/retry passed; independent Chromium unheld partial-construction cancellation/retry passed; installed/device workflows pending |
| W-08 Privacy | Exact PWA cache-body inventory/hash and settings-only storage canary checks passed locally; served/physical target privacy checks pending |
| W-09 Offline | Compatible cached reload and all root format/download pairs passed; installed restart, physical offline and full-eviction launch qualification pending |
| W-10 Updates | Both bases/all engines passed failed precache, multi-client waiting, 503 recovery and rollback; Chromium frozen client passed; installed/served production qualification pending |
| W-11 UI/accessibility | Shared responsive/theme/font/Dialog migration and Chromium/native runtime smoke passed; complete contrast/manual speech/retail zoom/device checks pending |
| W-12 Release | No public candidate deployed or qualified; physical mobile/retail browser and production checks pending |

**34/42 tasks are checked.** Remaining: 3.5 (physical resource measurements), 7.4 (full manual accessibility/retail zoom), 8.4 (physical offline/installed restart), and 10.2–10.6 (retail/device matrix, weakest-device boundaries/cycles, production verification, public release/licensing and WEB-STABLE). Source/default budgets remain provisional. All production/device/installed-PWA gates remain required. Desktop expansion stays deferred. See the [web release contract](web-release-contract.md) and [execution plan](platform-execution-plan.md).
