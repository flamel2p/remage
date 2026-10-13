# Manual web/PWA qualification

Prepared 2026-10-12 for `release-web-pwa-v1`. This is a procedure, not a passed test. It covers the physical, retail-browser and installed-surface gaps in [web verification](web-verification.md). [The release contract](web-release-contract.md), [W-01–W-12](platform-execution-plan.md#5-web-stable-handoff-gate), root [design.md](../design.md) and the active specifications control acceptance.

Start with the oldest or lowest-memory available phone. A failed required core flow means fixing the defect or explicitly narrowing the declared support/limits before release. Record a separate [qualification report](templates/web-qualification-report.md) for every browser/surface/artifact combination. Use synthetic inputs only; Remage does not collect reports automatically.

## 1. Freeze the artifact and test setup

The current local root candidate has build ID `d01caddb56c9d3b94daa999f424dfee7dd36b3169d1a583bb572dcc33ace91bc` and asset digest `07cf681c3dc6820766cf7ad386323c2bb03de0e5c222a7ed302861e4a60db826`. Verify these directly from `dist/web/web-build.json` and the served response for each run. Source, build output and the served response must agree. See the corrected boundary candidate in [web verification](web-verification.md#exact-pixel-boundary-correction).

Use the complete production-style build at its original base path. Local desktop preview:

```sh
pnpm --config.verifyDepsBeforeRun=false run preview:web --host 127.0.0.1
```

Use its printed URL and stop that terminal with Ctrl-C. Physical-phone PWA tests require a reachable HTTPS origin with a certificate the phone trusts; an ordinary HTTP LAN address is not a substitute for desktop localhost. [MDN documents service-worker secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). Use the [static hosting recipe](static-web-hosting.md) for MIME/headers and atomic updates. Local preparation does not authorize public deployment or certificate installation.

Record source commit and dirty-state description; `web-build.json` build ID, digest and asset count; SHA-256 of `sw.js`; URL/base; date/time; device/model/RAM if known; exact OS/browser version; browser tab versus installed window; screen dimensions/orientation; appearance; assistive technology; network state; power/thermal conditions. A rebuilt or differently based artifact needs a new identity/report. A private/incognito test does not qualify the ordinary installed surface.

Required matrix:

| Target | Surface |
| --- | --- |
| Named desktop Chrome, Firefox, Safari | Ordinary retail browser; each supported engine's repeated-cycle test |
| Named desktop Edge | Core-flow smoke |
| Named desktop Chrome or Edge | Installed PWA |
| Physical Android Chrome | Ordinary browser and installed PWA |
| Physical iPhone Safari | Ordinary browser and home-screen web app |

Playwright test engines, a narrow viewport and Electron page zoom remain separate local evidence. Do not relabel them as retail Safari, mobile hardware or installed-PWA evidence.

## 2. Prepare and verify inputs

Use the committed synthetic [corpus](../test-fixtures/images/README.md) and its SHA-256 [manifest](../test-fixtures/images/manifest.json). Generate additional boundary inputs:

```sh
node tools/web-qualification/generate-fixtures.mjs
```

It writes 22 MIT-licensed PNGs and a hash/dimension/purpose manifest under ignored `output/playwright/manual-qualification/fixtures/` (about 93 MB uncompressed). Transfer only the needed synthetic fixtures through your chosen local file workflow. Preserve the generated manifest with each report. Do not regenerate the committed corpus silently: encoder versions can change bytes.

| Inputs | Purpose / expected outcome |
| --- | --- |
| `rgb-1mp.png` | 1 MP same-size transform baseline |
| `rgb-12mp.png` | Exact 12 MP intake ceiling; resize to 2000×1500 for a separately admitted transform |
| Same 12 MP source, resize off | Reject same-size transform under the current combined reservation; maximum input pixels do not guarantee every operation is admitted |
| `rgb-over-12mp.png`, `rgb-16mp.png` | Reject 12,003,000 and 16,000,000 pixels before full decode |
| `side-8192.png`, `side-8193.png` | Accept exact side ceiling; reject side ceiling plus one |
| `bytes-20mib.png`, `bytes-over-20mib.png` | Exact per-file intake ceiling and ceiling plus one; padding is valid optional PNG text metadata |
| `bytes-20mib.png` + `bytes-20mib-second.png` + `bytes-10mib.png` | Distinct content totaling exactly 50 MiB source bytes; test intake before processing |
| Replace the 10 MiB file with `bytes-over-10mib.png` | Reject the third file without losing the two accepted sources |
| `count-01.png` through `count-11.png` | Ten distinct accepted sources; reject the eleventh while keeping the first ten |

Padded files require explicit metadata removal before conversion; this is separate from intake acceptance. Start each boundary case with Clear session and wait until idle. Preview work and download Blob reservations also count toward combined admission. Identical-content duplicates are rejected even with different filenames; use the distinct-content count/aggregate fixtures.

The corpus's `oversized.png` is an intentionally inconsistent header bomb, not a valid large-image benchmark. Boundary fixture generation/decoding alone does not prove browser admission, device capacity or preservation fidelity.

## 3. Core formats, fidelity and resources

1. In a dedicated fresh test profile with no saved Remage settings, confirm Converter, no selected output, resize off, aspect lock on, enlargement off, metadata preservation on and JPEG acknowledgement off. Clearing image results or reopening an existing profile retains saved settings; check that behavior separately. Optimizer must disclose that browser strict optimization is unavailable.
2. Run all nine source/output pairs using `rgba-hidden-rgb.png`, `baseline.jpg`, and `lossless.webp`. The committed PNG includes optional `pHYs` metadata: first verify default preservation blocks it, then explicitly select metadata removal for the matrix and record that policy. For JPEG, explicitly acknowledge loss and choose the background. Download each output and a selected-results ZIP. Check actual bytes/signature/extension/dimensions using an independent decoder; check ZIP CRC/extracted bytes against individual downloads. Do not count a requested download as a confirmed filesystem save.
3. Run `oriented.jpg`: default preservation is blocked; explicit removal permits a correctly oriented 48×64 result. Run `metadata.png`: default blocked, explicit removal recoverable. ICC/CMYK, APNG, high depth, corrupt and unsupported inputs remain rejected, including when removal is selected. Hidden RGB/alpha comparison uses decoded samples, not screenshots.
4. Exercise picker and drag/drop where the surface supports both. A touch-only surface still needs the picker. Mix supported/rejected inputs; accepted items and previous results must survive rejection, retry and cancellation. Confirm an intentionally larger valid conversion has a signed byte increase.
5. Run every intake boundary in section 2. With `rgb-1mp.png`, enable Resize and Allow enlargement, disable aspect lock, and set exact 4001×3000: the 12,003,000-pixel output must be rejected before corresponding allocation. Then set exact 8193×1 to test side-limit rejection independently. A locked containing box or enlargement-off default would plan a different valid output. With the 12 MP input, distinguish same-size memory denial from the admitted 2000×1500 resize.
6. Exercise serialized-ZIP denial and combined-memory denial separately using the existing automated cases as controls. For a device run, record the actual retained source/result/download bytes and selected entries; a fabricated console counter is not a physical-device result. If the state cannot be reached through supported UI, record that limitation and retain the separately named automated evidence.
7. Rename distinct synthetic inputs to mixed-script/emoji names, duplicate basenames and traversal-like names where the platform's file picker permits them. Verify full-name disclosure, sanitized output names, distinct ZIP entries and correct bytes. Include failed/cancelled items, check eligible/excluded counts, deselect all results and confirm empty selection cannot prepare a ZIP. Deny a download through available browser controls, retain results and retry; separately name automated fault-injection evidence for cases the platform cannot expose.

Limits are provisional: 10 sources; 20 MiB/file; 50 MiB sources/results/serialized ZIP independently; 12 MP and 8192 px per source/output; 256 MiB estimated combined reservation; one image Worker; 60-second image and 30-second ZIP deadlines. These are neither total process-memory caps nor measured phone guarantees. [The release contract](web-release-contract.md#resource-profile-and-qualification) gives the full bounds.

## 4. Timing and repeated cycles

Record one cold start and at least five measured warm trials per admitted workload/settings. Keep raw timings, initialization time where observable, total completion time and p50/p95 calculation method. Small five-trial p95 is descriptive; preserve all samples. Measure 1 MP transforms and 12→3 MP resize. The 16 MP case currently measures rejection only.

Run 20 consecutive representative mixed-batch cycles on every supported browser engine. Each cycle imports valid plus rejected inputs, changes settings after submission, verifies submitted settings/result accounting, requests an actual download, clears or requeues, and returns idle. At least five cycles cancel genuine active work. Keep already completed results, retry, and verify late cancelled output is never published. Also cancel genuine partial ZIP construction and retry without reprocessing.

Verify timeout/crash recovery separately: keep an already completed result, observe a genuine deadline failure when reachable, then retry or process a subsequent job without reloading. If a controlled Worker fault or held completion is required, label it as fault injection and record the actual configured 60-second image/30-second archive deadline. The prior result must remain downloadable, stale output must not publish, and the next job must succeed. A physical device crash/reload during an otherwise admitted workload is a failure to triage, not a successful timeout case.

Record button input→visible cancellation acknowledgement and input→Worker teardown separately where instrumentation permits. The plan's 150 ms/one-second targets are proposed qualification thresholds. A held Worker message validates lifecycle handling, not actual construction or physical input latency. No published latency claim should rest on a programmatic DOM click alone.

Use available OS/browser tools for peak resident-memory observations and name exactly what was measured (tab, renderer, browser aggregate, JS heap or owned buffers). If unavailable, record `not measured`; source/result counters do not establish total memory. Record thermal throttling, process kills, OS reloads and memory warnings. Include setup/update hashing headroom, which lives outside the image Worker's reservation. Zero crashes, invalid exports, stuck work or accumulating application-owned resources are required.

## 5. Accessibility and layout

In both themes, wait for finite color transitions to settle before sampling composed contrast. Cover default, selected, hover/focus, disabled, validation/error and completed states. Normal text needs 4.5:1; large text and meaningful control/icon/focus boundaries need 3:1. Confirm actual local Atkinson/Lilex loading and mixed Latin/CJK/emoji fallback, long unbroken names, touch targets and final actions.

Use keyboard only through intake/settings/submission/results/downloads. Verify named controls, visible unobscured focus, persistent labels/errors, named Settings dialog, contained Tab/Shift-Tab, Escape and trigger focus return. Run a real screen reader (name/version in the report); listen to errors, routine progress, cancellation, completion and export states. Accessibility-tree snapshots do not prove spoken announcements.

Set **actual browser page zoom to 200%**, confirm its menu/settings value, and test at 800×600 plus narrow landscape. [Chrome's supported page-zoom controls](https://support.google.com/chrome/answer/96810?hl=en) are one route. Record the browser's actual zoom value. CSS zoom, device scale, pinch zoom and changing viewport size do not close this requirement. Check no page overflow, clipped dialog, hidden focused control or unreachable final action.

Enable OS reduced motion, repeat dialog/progress/status flows, and confirm meaning remains available without motion. Test physical touch, software keyboard and orientation changes separately. Desktop accessibility preparation in the existing native app does not unlock deferred desktop expansion.

## 6. Installed offline and recovery

1. On an empty session, finish setup and Enable offline use or close all Remage clients and reopen. Require the app's complete offline-ready state before testing. Install through the real offered browser control. On iPhone use [Apple's Safari home-screen web-app instructions](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios); record whether it opens as an installed web app.
2. Disable real connectivity (airplane mode, then explicitly disable Wi-Fi if it remains enabled). Close the installed surface completely and reopen from its icon. Test all nine supported pairs and actual individual/ZIP downloads from local assets. Repeat ordinary-tab offline reload. A surviving already open tab is not installed restart.
3. On a dedicated synthetic-data test origin/profile, use the platform's developer tools to delete only the current Remage cache's WASM entry (`remage-app:<base>:<buildId>:<digest>`). Keep the shell. Reopen offline: there must be no false complete readiness or successful codec result. Reconnect, use Restore offline files, then repeat an actual transform offline.
4. Separately remove all Remage caches for that test origin/profile and reopen offline. Complete shell eviction may prevent launch; if the worker survives, its self-contained recovery response must not claim ready. Reconnect and reopen to recover a coherent complete set. Record browser-native error versus app recovery, not an assumed result.
5. Interrupt initial asset acquisition on the isolated test origin; record partial/not-ready status, reconnect, finish setup and prove an actual offline transform. Do not erase unrelated website storage or a user's retained production work.

Remote inspection support varies; record unperformed eviction cases rather than claiming they passed. Physical networking evidence supplements the local harness's origin-unavailable/automation-offline checks.

## 7. Updates, privacy and served-production closure

On an approved test origin, serve complete identified N and N+1 artifacts atomically while retaining old hashed assets. Keep an active batch and a second client (also a suspended/unresponsive client case). Require N to finish with its assets; waiting N+1 must not force activation, reload or discard. Exercise explicit keep/discard, close every tab/installed window, reopen, verify identity and transform offline. Interrupt N+1 precache and confirm complete N remains usable. Roll back to the complete N artifact and repeat reopen/offline processing.

Inspect network and persistent storage during intake, preview, processing, downloads and update. Requests/caches must contain only same-origin application assets; localStorage settings only, no input bytes/names/thumbnails/results/history/handles. Use synthetic canary names. Keep HAR/log evidence private until reviewed for identifying data and secrets; inspection traffic from the test harness is recorded separately.

Actual production task 10.4 starts only after an authorized destination/publication. Verify served build identity, HTTPS, response headers/MIME, installed restart, downloads, privacy, update and rollback on that artifact. Finish the W ledger, measured limits, codec source/rebuild/relink publication and notices, then obtain QA/technical review. Only a complete passing record can close 10.6 and enable desktop expansion. This checklist does not close any task by itself.
