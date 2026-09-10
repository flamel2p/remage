## 1. Native bridge and app metadata

- [x] 1.1 Add a trusted, opaque destination-open operation to the main process,
  preload bridge, and shared API contract without exposing a filesystem path.
- [x] 1.2 Expose the installed application version and static local license/notice
  summary required by the About section without a network request.
- [x] 1.3 Add focused tests for the destination-open authorization/error path
  and preserve the current session-only destination behavior.

## 2. Header and settings implementation

- [x] 2.1 Move the mode switch into a fixed, layered header and provide the
  selected-state visual treatment and accessible names required by the spec.
- [x] 2.2 Move both idle privacy statements into the fixed action bar, in the
  specified order, while retaining processing progress behavior.
- [x] 2.3 Replace the in-workspace destination control with an accessible
  Settings dialog containing Save destination and About sections, including
  close, Escape, focus containment, and focus return behavior.
- [x] 2.4 Add labeled right-header icon actions for destination opening and
  Settings, with unavailable-state guidance when no session destination exists.
- [x] 2.5 Update desktop/minimum-size styles so fixed chrome, dialog, workspace,
  and action bar do not overlap content or focused controls.

## 3. Verification

- [x] 3.1 Run the focused automated tests plus `pnpm typecheck`, `pnpm lint`,
  and the full test suite; resolve regressions or document pre-existing failures.
- [x] 3.2 Verify the Electron UI at 800 × 600 and a populated scrolling workspace:
  mode selection, privacy copy order, destination selection/opening, About
  content, unavailable open action, Escape/Close focus return, and visible
  keyboard focus.
- [x] 3.3 Run strict OpenSpec validation and record exact verification evidence
  and any remaining platform-only limitations before archiving.

## Verification evidence

- `pnpm test` passed: 8 files, 22 tests.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `openspec validate
  improve-header-and-settings --strict`, and `git diff --check` passed.
- In the running Electron renderer through its local debug connection: the
  header was fixed at the top; Optimizer was selected; the two idle privacy
  statements appeared in the required order; the unavailable folder action
  showed its Settings guidance; the dialog exposed Save destination and About,
  focused Close Settings, and Escape returned focus to Open Settings.
- An 800 × 600 emulated Electron renderer viewport showed a 76px fixed header,
  an 80px fixed footer, workspace beginning below the header, and no horizontal
  overflow. Native Finder opening is covered by the sender-validated unit path;
  it was not invoked against a user-selected folder during verification.
