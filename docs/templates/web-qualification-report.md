# Remage web/PWA qualification report

Status: **NOT RUN**. Replace placeholders with observed evidence; use `pass`, `fail`, `not run` or `not applicable` with a reason. One report covers one browser/surface/artifact; link related update/rollback artifacts separately. Follow [the procedure](../manual-web-qualification.md).

## Identity

| Field | Observed value |
| --- | --- |
| Tester / date / timezone | |
| Source commit / dirty state | |
| Artifact URL / base | |
| Build ID / asset digest / inventory count | |
| Service-worker SHA-256 | |
| Corpus manifest SHA-256 / boundary manifest SHA-256 | |
| Device / CPU / RAM (or unknown) | |
| Exact OS / retail browser versions | |
| Ordinary tab / installed PWA / home-screen web app | |
| Display / orientation / actual page zoom | |
| Appearance / reduced motion / screen reader version | |
| Network / power / thermal conditions | |
| Local / test-host / production evidence | |

## W-01–W-12 results

| Gate | Status | Actions, output hashes, evidence and limitations |
| --- | --- | --- |
| W-01 Nine format pairs / rejection / unavailable codec | not run | |
| W-02 Orientation / alpha / hidden RGB / metadata / JPEG loss and background | not run | |
| W-03 Intake and planned-output / combined-resource boundaries | not run | |
| W-04 Genuine processing and ZIP cancellation / timeout / retry / cleanup / actual navigation and background return | not run | |
| W-05 Captured settings / original requeue | not run | |
| W-06 Mixed counts / byte totals / signed growth | not run | |
| W-07 Individual downloads / ZIP CRC and extracted hashes / names / recovery | not run | |
| W-08 Network / caches / settings-only persistence | not run | |
| W-09 Offline tab reload / installed restart / selective and complete eviction / restore | not run | |
| W-10 Active and suspended second clients / failed update / rollback | not run | |
| W-11 Themes / contrast / fonts / keyboard / speech / genuine 200% zoom / touch | not run | |
| W-12 Exact served artifact / support and measured limits / source and release materials | not run | |

## Actual navigation and background return

Use real browser navigation/Back and tab/application/device backgrounding. Record the event inspection method and any BFCache exclusion reason; synthetic events do not qualify these cases. Keep genuine BFCache restoration separate from a fresh document/session and ordinary-tab observations separate from installed or physical-device runs.

| Case / actual surface | Observed events / `persisted` / duration | Retained results and ZIP / verified bytes | Active-work cancellation or background outcome / retry / session-loss guidance | Status / evidence |
| --- | --- | --- | --- | --- |
| Leave-page warning: Stay | | | | not run |
| Navigate away / Back with completed result and prepared ZIP | | | | not run |
| Navigate away / Back during genuine image or partial ZIP work | | | | not run |
| Non-persisted navigation or observed reload/eviction | | | | not run |
| Switch tab/application and return | | | | not run |
| Physical phone background/lock and return | | | | not run |

ZIP retention applies to a ZIP still ready at suspension. Starting replacement preparation invalidates the previous ZIP; interrupted construction must retain individual results and permit re-preparation. Cancelled preview work can leave source rows ready. Do not count a job that completed before navigation as active-work cancellation. Unknown `persisted` values do not prove BFCache use. Continued background completion is an observation, not a supported guarantee.

## Timings and memory

Keep raw per-trial samples and name the observation method. Do not substitute admission estimates for resident memory or programmatic-click timings for physical input latency.

| Workload / source hash / submitted settings | Cold time | Warm samples | p50 / p95 method | Peak memory observation / scope | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 MP same-size transform | | | | not measured | not run |
| 12 MP → 3 MP resize | | | | not measured | not run |
| 12 MP same-size memory denial | | | | not measured | not run |
| 16 MP intake rejection | | | | not measured | not run |
| ZIP setup / genuine partial construction / retry | | | | not measured | not run |
| Offline setup / update hashing headroom | | | | not measured | not run |

## Twenty consecutive cycles

At least five cycles cancel actual active work. Add the observed status/accounting/output hash, input→acknowledgement and input→teardown timing where measured, resource observations and evidence link in Notes.

| Cycle | Mixed intake and immutable settings | Actual download / bytes verified | Cancel and retry / clear or requeue | Notes / cleanup / errors |
| --- | --- | --- | --- | --- |
| 01 | | | | |
| 02 | | | | |
| 03 | | | | |
| 04 | | | | |
| 05 | | | | |
| 06 | | | | |
| 07 | | | | |
| 08 | | | | |
| 09 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |
| 15 | | | | |
| 16 | | | | |
| 17 | | | | |
| 18 | | | | |
| 19 | | | | |
| 20 | | | | |

## Review and remaining gates

- Blocking findings and reproducible issue links:
- Unperformed or unsupported cases, with reasons:
- Actual supported limits established by these measurements:
- QA reviewer / evidence / conclusion:
- Technical reviewer / evidence / conclusion:
- Publication authorization and production verification record (if applicable):
- WEB-STABLE decision: **not established** until all required matrix reports and W gates pass.

Keep images, private paths/names, keys and unreviewed device logs out of public reports. No automatic telemetry or report submission is introduced.
