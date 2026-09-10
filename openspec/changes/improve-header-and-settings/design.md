## Context

See `proposal.md` for the motivation. The renderer currently renders the mode
switch above the workspace, the destination picker in the output settings
panel, and a single idle privacy statement in the fixed action bar. The main
process already stores a selected output folder as an opaque, session-only
destination identifier, intentionally withholding its actual path from the
renderer. `NOTICE.md`, `LICENSE`, and package metadata already supply the
authoritative About content.

The existing `src/main/index.ts` has user work in progress and must be merged
carefully with any header-action IPC registration.

## Goals / Non-Goals

**Goals:**

- Keep the active operation and primary privacy commitments continuously
  discoverable without obscuring workspace content or focused controls.
- Put session destination selection and application legal information behind a
  small, accessible dialog.
- Add a least-privilege native folder-open action without exposing raw paths through
  the renderer bridge.

**Non-Goals:**

- Persisting destination paths across restarts, browsing arbitrary filesystem
  locations, adding accounts or telemetry, or creating a settings page.
- Changing batch, export, output naming, or automatic-export semantics.
- Adding a remote website, support link, updater, or new third-party dependency.

## Decisions

### Keep workspace navigation and actions in one fixed header

The brand remains left, the two-mode control is centered, and compact icon-only
actions remain at the right. The active choice uses a semantic selected state,
distinct surface/color, and an existing text label; it will not rely on color
alone. The header has an explicit stacking layer and the workspace reserves its
height, so content and focus are never hidden below it.

Keeping the mode control above the workspace was rejected because it disappears
on long queue/result lists. A separate settings route was rejected because it
adds navigation for two small infrequent sections.

### Use a renderer-owned modal dialog with explicit focus behavior

The Settings action opens a native HTML dialog or equivalent modal primitive.
It groups Save destination and About content under headings, closes via Escape
and an accessible Close button, keeps focus inside while open, and returns focus
to its trigger after closing. The actions use inline SVG line icons with
`aria-label`s and a minimum 44px hit target; no external icon package is added.

A browser alert or popover was rejected because it cannot group controls or
provide reliable focus return. A custom clickable `div` is rejected because it
would omit button semantics and keyboard behavior.

### Retain opaque session destination handles and add only a folder-open IPC

Selecting a destination keeps the existing picker-to-`selectDestination`
behavior and stored opaque identifier. The main process adds a sender-validated
`open-output-directory` IPC route that resolves the identifier in
`RemageService` and calls Electron's native folder-open capability. The
preload exposes one typed `openOutputDirectory()` method; the renderer never
gets the real path.

Passing a filesystem path back to the renderer or invoking a shell command from
the renderer was rejected because it expands a deliberate filesystem trust
boundary. Persisting a path was rejected because the current privacy contract
explicitly makes destinations session-only.

### Derive About data from packaged local sources

About displays the installed application version and summaries from the
repository's `LICENSE` and `NOTICE.md`; it does not fetch remote license text.
The implementation will expose only the small static metadata needed by the
dialog, keeping the renderer CSP and offline guarantee intact.

Opening external source URLs was rejected because it creates an unnecessary
network/browser dependency for a local utility. Inventing component licenses
was rejected; the existing notices remain authoritative.

## Risks / Trade-offs

- [Header and fixed footer may overlap scroll/focus targets at small window
  heights] → reserve their combined spacing in the workspace and manually test
  minimum 800 × 600 viewport and keyboard focus.
- [Selected folder could be deleted or become unavailable] → resolve and open
  only at action time, report a recoverable error, and let users choose a new
  folder in Settings.
- [New IPC could open arbitrary paths] → accept no renderer-supplied path;
  resolve only the current opaque identifier after trusted-sender validation.
- [Modal behavior may be inaccessible] → use semantic dialog behavior,
  Escape/Close dismissal, focus containment/return, visible focus, and manual
  keyboard verification.
- [Existing main-process edits could conflict] → preserve the current diff and
  integrate the new handler around the actual edited state rather than replacing
  `src/main/index.ts`.

## Migration Plan

1. Implement the renderer layout/dialog and narrow bridge/main-process folder-open
   contract without changing stored preferences.
2. Run focused unit/type/lint checks and verify the behavior in the Electron
   window at its minimum dimensions.
3. Roll back by removing the new folder-open endpoint and restoring the former
   header/destination placement; opaque destination identifiers and exports
   remain compatible.
