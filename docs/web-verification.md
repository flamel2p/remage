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

Historical untagged root artifact before the exact-pixel boundary correction: build ID `b358a5af612b9a6aff5bb5682b9be778ae56909139f9083bb52e1713147db7fc`; asset digest `4b95478bdd4c4c04c22e2b05f980951fcc00ea5760d0bf7d8d37203d8b4462fc`; service-worker SHA-256 `776053444b4953c26ca40c461c2a85601e60be9f8af1e496029306177fca740c`. The inventory contains **32 assets / 16,646,555 bytes**; disk count is 34 including the two derived files. Independent QA verified every asset SHA/length, digest, HTML/entry/worker embedded identity, manifest scope/start URL, 192/512 icons, four WOFF2 fonts and 18 notice/license files. WASM matches the pinned codec SHA. Tagged A/B lifecycle fixtures are separate artifacts and must be identified separately. Current candidate identity and checks are recorded below.

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

The frozen Firefox-first full run exited 0 and produced six aligned records, preserved in ignored `output/playwright/web-pwa/pre-area-boundary-fix/evidence.json`, SHA-256 `7a92c941fa40f39b7ce134ec4ded4d04872e8fac3f34028ae900a151cebcdf59`. Root and independent QA reviewed all records; independent UI/technical source review found no remaining P0/P1 in its bounded scope. Reviewers audited source and evidence rather than independently rerunning the complete suite. Earlier incomplete or superseded runs are investigation milestones, not this candidate's evidence.

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

### Physical qualification packet preparation

The 2026-10-12 continuation adds a [manual retail/device/PWA procedure](manual-web-qualification.md) and [per-surface report template](templates/web-qualification-report.md), covering W-01–W-12, actual 200% page zoom/speech, physical offline installed restart, resource measurements and served update/rollback. These documents are preparation and close no release gate.

`node tools/web-qualification/generate-fixtures.mjs` generated **22 valid synthetic PNGs / 92,803,129 encoded bytes** under ignored `output/playwright/manual-qualification/fixtures`. They cover 1/12/16 MP, pixel/side ceiling plus one, exact per-file and aggregate-byte boundaries and eleven distinct-content count inputs. Independent Sharp 0.35.4/libvips decoding verified every manifest SHA/length, dimensions and **every RGB sample** for all 22, including padded optional-metadata files. Manifest SHA-256: `2f186e68227bb0f033dccfedd85f390e66de9fd1cadcefc5060ee466ae267d8f`; local validation record SHA-256: `13426e47cde45f7b64d3fc4d3001404088fa0441305bc38fd5681d2b875757a0`. Generator ESLint passed; all 19 relative links in the procedure/report/contribution guide existed at verification.

Source inspection confirms a same-size 12 MP transform exceeds the separate provisional 256 MiB reservation; 12 MP intake acceptance is not a blanket processing promise. The packet explicitly tests that denial and a separately admitted 12→3 MP resize. Generated/decoded fixtures are not browser intake, performance or phone evidence.

After these non-product additions, loading the Vite configuration recomputed the same canonical build ID, and all **32 emitted asset SHA/lengths** plus the service-worker SHA matched the frozen candidate above. Product code/build inputs were unchanged; the historical full product suites were not rerun merely for these documents/tools. Task/device gates remain open.

### Exact pixel boundary correction

The first actual-App laptop measurement exposed a blocking local-candidate defect: admitted `rgb-12mp.png` → 2000×1500 failed with `CacheResourcesExhausted` after 83.9 ms. Source remained retained and its Worker terminated. This was a failed qualification, not a deployed production incident. Historical measurement: ignored `output/playwright/manual-qualification/desktop-preliminary/evidence-final.json`, SHA-256 `2950181a07d226699a0d3811a0bb8d23c46af538e7c4050bb250a76a7c9b76ee`.

The pinned ImageMagick source (`MagickCore/resource.c`, `AcquireMagickResource`, AreaResource branch) accepts `size < area_limit`. Remage's own inspection/admission accepts `pixels <= 12,000,000`. An independent one-variable probe of the frozen actual adapter failed at area 12,000,000 and succeeded at 12,000,001 with identical input/settings. The owner corrected only that exclusive codec threshold; input/output pixel limits, disk prohibition and memory reservations are unchanged. A real-codec regression failed with the original cache error before the correction and now independently decodes both 12 MP → 3 MP and 3 MP → 12 MP outputs, verifying every RGB byte. Its large-buffer comparison uses native Buffer equality; the first deep-equality test attempt exhausted the test runner's JS heap and was corrected without increasing runtime limits.

Current canonical root artifact: build ID `d01caddb56c9d3b94daa999f424dfee7dd36b3169d1a583bb572dcc33ace91bc`; asset digest `07cf681c3dc6820766cf7ad386323c2bb03de0e5c222a7ed302861e4a60db826`; service-worker SHA-256 `8d979d111738cdf099b830bc49fee4ad4d1bd17156132ebb71b0445f8d41a106`; **32 assets / 16,646,558 bytes**. Source remains the two-file working-tree correction on commit `8f2c5b48a4e8a388591ce309ec5a350531d34178`; no commit or release publication was made.

On this corrected source, both typechecks, lint, **115 tests / 13 files**, native/web builds, four forbidden import-boundary cases, all three emitted-worker core engines and the actual-App Chromium responsive/theme/download harness passed. Each core engine completed four transforms, three ZIP entries and two independently byte-verified downloads with no page errors. The focused real-codec boundary test completed in 1.32 seconds. Initial sandbox attempts could not bind localhost or launch Firefox; the same authorized checks ran successfully with scoped local-test permissions. No fresh dependency install was tested. Full PWA requalification is recorded after completion; historical results above retain their original identities.

Independent actual-App follow-up used installed Chrome **155.0.8059.39** in an isolated headless context on the named M4 Pro/48 GB host, under concurrent owned 4-CPU/6-GiB amd64-emulated codec-source compilation. All 32 candidate inventory SHA/lengths were verified before and after. Each workload had one first trial and five warm trials; each job creates a fresh WASM Worker. Measurements are capture-phase DOM click → first result insertion, not physical input latency, separate codec initialization time or total resident memory.

| Workload | First trial | Five warm trials, nearest-rank p50 / p95 | Download validation |
| --- | --- | --- | --- |
| 1 MP PNG → PNG | 152.9 ms | 155.1 / 155.7 ms | Six outputs; all 3,000,000 RGB bytes exact per output |
| 12 MP PNG → 3 MP PNG | 807.4 ms | 809.6 / 810.9 ms | Six outputs; correct PNG/dimensions; independent Sharp Lanczos3 comparison max channel delta 1, mean absolute delta 0.0258774 |

Resized comparisons are descriptive across implementations, not an exact resize-filter parity claim. All 18 Workers terminated, active count zero; same-size 12 MP memory denial and 16 MP intake rejection passed without Worker creation; zero page/console/Worker errors or external requests. The observer did not hold or replace Worker output. Raw timing/settings/download/source hashes and cleanup are in ignored `output/playwright/manual-qualification/area-threshold-candidate/results/evidence.json`, SHA-256 `fbff1d1cae12a1f546a6d6bf8bca50adfc0483ac1d700023b0bf49d626afb899`. Independent narrow source/test review found no P0/P1 in this threshold correction. The browser/server closed and the owned listener was absent. This strong-host small-sample result does not calibrate phone limits or close task 3.5.

Independent focused emitted-Worker verification also passed both exact source/output ceilings in Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5: six real jobs, every decoded constant RGB byte identical, all owned Workers terminated and no page errors. All 32 disk/served asset hashes matched before/after. Evidence: ignored `output/playwright/web-pixel-boundary-d01caddb/evidence.json`, SHA-256 `e522dc8ec3138c5377498130db4254c8646628609c64b1164b9783a493293841`. This is a Worker harness with generated real PNGs, not actual-App timing, a phone benchmark or an installed PWA run.

### Corrected-candidate PWA requalification

`pnpm --config.verifyDepsBeforeRun=false run verify:web:pwa firefox webkit chromium` exited 0 on the corrected source. All six root/subdirectory records were reviewed: ignored `output/playwright/web-pwa/evidence.json`, SHA-256 `f4a8c7012522b63ed0449e16d86e0be883aa89c3e1f7ed3110916b8aac8bfe50`. The prior record is preserved at `pre-area-boundary-fix/evidence.json` with its original SHA. These lifecycle artifacts use tags A/B; their full inventory digests and service-worker hashes are in the record and differ from the untagged canonical artifact.

| Base | A build ID | B build ID |
| --- | --- | --- |
| `/` | `e0291f11e391aa1199cca7da7dedb839886821c6d5058d0cfb571cf072563597` | `cb30b87afeae5cff5caf49376637cb18e77bb49499b3b555d34c2c0fbbc0831a` |
| `/remage/` | `67539074c254045ffd77e3c568c8ed0c6b92f4ba7b806faf575c02a17c7148ad` | `94b733e3c29dbef6aeedee1f5aa8698e1b2a6cc41fb87c13fb61cb3869863e30` |

Every root engine passed nine offline format pairs/downloads, a byte/CRC-verified nine-entry ZIP, privacy/settings-only storage, 20 mixed batches, five held-completion cancellations and a real configured deadline followed by retry. Firefox 153.0 terminated 56/56 Workers (60,454 ms deadline), WebKit 26.5 57/57 (60,320 ms), Chromium 151.0.7922.34 56/56 (60,219 ms); active zero and no page errors. Both bases/all engines repeated selective eviction, invalid/corrupt restoration rejection, missing entry-JS navigation repair, failed next precache, multi-client waiting, whole-cache 503 recovery, normal close-all activation and coherent rollback. Chromium again included a frozen second client. Subdirectory checks cover lifecycle/recovery, not the full root transform/cycle workload. The prior instrumentation/offline/deployed/physical limitations remain applicable; this does not establish installed restart, measured phone memory or production qualification.

### Local codec source/relink preparation

The [source/rebuild procedure](codec-source-rebuild.md) and [measured source evidence](codec-source-evidence.md) cover the local preparation portion of task 10.5. All 28 sealed official source archives passed checksum/length verification (**99,696,670 compressed bytes**); 81 original license texts were indexed. Corrupt inputs, extraction without Python's explicit data filter and public packet generation were rejected. The original application source and the two-file correction are archived separately, with the current archive independently reproducing the canonical `d01caddb…` build ID.

The owned, pinned amd64 Emscripten 6.0.6 build finished successfully after 64 minutes 37 seconds. The freshly built WASM is 15,446,944 bytes, SHA-256 `f8c67c10f37a26148984dd0002d27d21e6a79e118f6c36ec1cd24292f5f049aa`; it differs from the supplied published module. A separate disposable-container rebuild/relink with a marked LGPL libheif version header finished successfully in 2 minutes 56 seconds. Its WASM is 15,446,974 bytes, SHA-256 `e26dc4852cc89ff5d27e0db739f3b790c60b09ed1252044d0de9d0b627eb389c`.

Both new modules passed all nine PNG/JPEG/WebP pairs through the actual adapters extracted from **both** application archives: 36 successful cases, with independent Sharp format/dimension/alpha and relevant pixel checks. Including the original supplied-module run gives 45 observed cases; the nine fixture export hashes match across all five records. That is bounded fixture evidence, not whole-module equivalence. The modified module also exposed the expected HEIC registry/header marker through the installed wrapper. This does not claim direct invocation of libheif's version API. Runtime proofs use the installed published ESM's embedded glue; generated glue is retained as build material, not substituted in those tests. No installed module or canonical web artifact was replaced. These are Node adapter proofs, not browser, installed-PWA or physical-device qualification.

The effective source-fetch branches and resolved package versions are retained. Upstream apt sources are not snapshot-pinned; this is an observed successful rebuild and modification/relink exercise, not byte-for-byte reproduction or an attestation of the original binary's build. Task 10.5 stays open for Dependencies build-script redistribution rights, original-binary matching provenance/release materials, artifact-specific review and durable public source/binary publication.

The final frozen private packet is ignored `release/codec-source/remage-magick-wasm-0.0.44-source-preparation.tar.gz`: **116,207,363 bytes / 178 members**, SHA-256 `748408595254f031c665bd2c9e6457490478d619b117490e74ebbad325b20e15`. Its adjacent per-member manifest is 34,554 bytes, SHA-256 `1a5ab3dbe822b5116a6caed615b65fbb4767b1ab83b25ae5aba1f46de027bd03`. Two final generations were byte-identical; the decoded audit verified all members, 28 nested source archives and 254 application files, with zero unexpected high-confidence token/private-key patterns. Seven public synthetic GLib TLS fixtures matched their individually sealed hashes. These are private preparation results; public mode still refuses. Both owned build/relink containers were confirmed absent.

Root's separate exact configured-key scan covered **989 current source/product/local-evidence files / 323,298,064 bytes** plus **20,284 decoded archive members / 490,762,951 bytes**, including the frozen packet and its nested source/application archives: **zero matches**. Both configured keys were nonempty; `.env.local` remained ignored and mode 0600. Values were neither printed nor recorded. Local record: ignored `output/playwright/final-private-safety-scan.json`. This does not claim an exhaustive secret detector. Final targeted ESLint passed for all tools and the two product files; five Python tools parsed, both Bash drivers passed syntax checks, all 27 relative preparation-document links existed and OpenSpec strict validation passed.

Independent read-only technical review verified the final packet/manifest identities, all 178 member hashes/lengths/fixed metadata, all 28 archives against the packed lock, both application archives, six compiled artifacts, all five proof records and matching archived adapter/wrapper provenance. Packed tools/docs matched the frozen working tree. It found no remaining P0/P1 or material documentation mismatch in that bounded scope; the completion-flag provenance finding was corrected before freezing. The reviewer did not rerun compilation, adapter runtime, browser suites or the lead's key scan. Both local proof flags are true; public authorization is false and all four source-release gates remain open.

### Bounded accessibility continuation

These additional independent checks belong to the **historical b358a5af candidate**, before the codec correction. They do not qualify the new artifact's bytes. Four isolated/headless engines (Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5, installed Chrome 155.0.8059.39) passed both themes at six viewport sizes, settled text contrast ≥4.8075:1, sampled 44 px targets, Unicode/font roles, Settings/Clear focus containment and return, reduced-motion emulation and actual metadata failure/removal/retry with retained results. All four passed 12 sampled keyboard focus clearances against fixed actions; complete keyboard intake→retry→download passed Chromium/Firefox/Chrome. WebKit lost document keyboard routing after completing two actual results; retail Safari continuation remains unverified, without a confirmed product defect. Actual App count 10/11 and aggregate 50 MiB/+1 intake boundaries passed. Root visually inspected the 375 px Firefox and 800×600 WebKit dark mixed-source screenshots.

Initial completed record: ignored `output/playwright/a11y-7.4/isolated-initial-completed-evidence.json`, SHA-256 `2386beec79bafdf9cfa6ff0182dcd624f9c2ab3f28515a8c87a7eea049dc8ace`. Final extended record: `isolated-keyboard-follow-up-evidence.json`, SHA-256 `bbd91a5aa6820bf188fc23409c81f4c29e4cad4e7310c340eac127f111693edf`; exit 1 preserves the explicit WebKit routing gap. Full source/method/screenshot provenance is in that directory's `README.md`.

Native Chrome controls genuinely showed 200% zoom for an empty session and Settings in both themes. This did not exercise queued/results zoom or screen-reader speech. Its reduced UA was Chrome 154.0.0.0; the separate installed/headless Chrome 155 version must not be substituted. CUA lost native window/ownership access; no further native input was sent. All isolated browsers/listeners closed, but cleanup of the last observed owned `http://127.0.0.1:64423/` tab, its exact-origin Remage storage and restoration of the observed 100% hostname zoom remains unverified. Chrome default zoom can span localhost ports. Follow-up record: `native-cleanup-follow-up.json`, SHA-256 `e3c3a8b9ac2227046f8f2534f98bd4a60db9696c7b31f7b54e981a43cc45be9f`. Task 7.4 still requires actual speech, full genuine zoom flows and target surfaces.

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
| W-11 UI/accessibility | Shared responsive/theme/font/Dialog migration, four-engine bounded settled contrast/focus and partial genuine native zoom observed; actual speech, full retail zoom and device/surface qualification pending |
| W-12 Release | No public candidate deployed or qualified; physical mobile/retail browser and production checks pending |

**34/42 tasks are checked.** Remaining: 3.5 (physical resource measurements), 7.4 (full manual accessibility/retail zoom), 8.4 (physical offline/installed restart), and 10.2–10.6 (retail/device matrix, weakest-device boundaries/cycles, production verification, public release/licensing and WEB-STABLE). Source/default budgets remain provisional. All production/device/installed-PWA gates remain required. Desktop expansion stays deferred. See the [web release contract](web-release-contract.md) and [execution plan](platform-execution-plan.md).
