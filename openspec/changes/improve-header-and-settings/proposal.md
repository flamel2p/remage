## Why

The workspace currently separates its mode selector from the header, leaves the
privacy promise in the fixed action bar, and makes output destination management
harder to find. Users need a persistent orientation point and a single, familiar
place to manage destination and app information.

## What Changes

- Make the header fixed while workspace content scrolls below it.
- Move Optimizer and Converter into the center of the header and give the active
  mode a distinct, accessible selected treatment.
- Move the privacy processing statement beside the existing local-files promise
  in the fixed bottom action bar.
- Add header actions to open the currently selected output folder and to open
  a settings dialog.
- Move save-destination selection into the settings dialog and retain the
  existing persisted preference and export behavior.
- Add an About section to the dialog with the application version, product
  license, and third-party notice summary.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `desktop-workspace`: Define the persistent header, settings dialog, destination
  open-folder action, and in-app license/notice information.

## Impact

- Renderer header, fixed layout, settings controls, dialog accessibility, and
  styling in `src/renderer/src/App.tsx` and `src/renderer/src/styles.css`.
- A narrow, sender-validated Electron IPC action to open a selected destination
  folder, exposed through the preload bridge and shared API contract.
- Existing preference persistence, export paths, `NOTICE.md`, and packaged
  version metadata are reused; no image data, source path, or network behavior is
  added.
