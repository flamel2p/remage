## Purpose

Provide a private and accessible Remage browser workspace for modest local image batches, with explicit platform capabilities and safe session resource limits.

## ADDED Requirements

### Requirement: Private browser workspace
The browser edition SHALL process selected images entirely on the user's device without accounts, image uploads, telemetry, remote fonts, or a remote processing service. It SHALL persist settings only, excluding image bytes, thumbnails, source names, filesystem handles, destinations, and result history.

#### Scenario: Process a selected image
- **WHEN** a user imports, processes, and exports a supported image
- **THEN** image data and identifying file information remain local and no image-bearing or identifying network request is made

#### Scenario: Reopen a previous session
- **WHEN** the user reloads the app after selecting images and changing preferences
- **THEN** valid settings can be restored but image/session/result data is not restored from persistent application storage

### Requirement: Responsive and accessible platform actions
The browser edition SHALL expose keyboard-operable Optimizer and Converter controls, truthful codec capabilities, visible focus, textual status, supplied local fonts, and a usable layout at 375px width, 800x600, and 200 percent zoom. Unsupported desktop folder-opening, automatic-export, and destination-writing actions SHALL not be presented as available browser features.

#### Scenario: Use a narrow browser viewport
- **WHEN** a user opens the workspace at 375px width
- **THEN** intake, settings, queue status, results, and run/download actions remain reachable without horizontal page overflow

#### Scenario: Strict optimization is unavailable
- **WHEN** the running browser build has no verified strict adapter for a source
- **THEN** Optimizer explains the unsupported capability and never silently routes the source to lossy recompression

### Requirement: Content-validated and bounded file intake
The browser edition SHALL route picker and drop inputs through equivalent content validation. It SHALL inspect signatures, dimensions, animation/page count, bit depth, orientation, and required color/metadata information before unsafe allocations, and enforce published count, per-file-byte, aggregate-byte, source and planned-output dimension/pixel limits. It SHALL reserve retained data and source/output/encoder/validation working sets before their corresponding allocations. Previously accepted items and completed results SHALL survive rejection of another item or operation.

#### Scenario: Mixed input files
- **WHEN** supported, corrupt, unsupported, and over-limit files are selected together
- **THEN** supported files become ready and each rejected file has an actionable reason without stopping other intake

#### Scenario: Source exceeds a decoded limit
- **WHEN** an image header describes dimensions above the published decoded-pixel budget
- **THEN** the image is rejected before the corresponding full decode allocation

### Requirement: Shared UI follows the Remage design authority
The browser edition SHALL follow root `design.md` and its canonical tokens/local font declarations for typography, colors, spacing, component states, responsive behavior and accessibility review. The selected REUI/shadcn foundation SHALL use the Radix style and Card surface consistently, preserve documented primitive behavior, and keep adopted source/assets local at runtime. Premium Motion Icon source SHALL enter the public project only after written redistribution rights covering the intended open-source use are recorded; otherwise the current local icons SHALL remain and the migration SHALL be explicitly deferred.

#### Scenario: Add a workspace panel
- **WHEN** a new settings or result panel is implemented
- **THEN** it uses shared semantic/component tokens, Atkinson UI text, Lilex only for technical data, and the same reviewed light/dark and responsive states

#### Scenario: Premium icon rights are outstanding
- **WHEN** the account can discover Motion Icons but written permission for public-source redistribution has not been recorded
- **THEN** premium icon source is not imported, current local icons remain usable and the icon migration is recorded as deferred without misrepresenting account access as redistribution rights

### Requirement: Session lifecycle is explicit
The browser edition SHALL retain source identity and immutable source bytes for reprocessing, provide explicit clear/remove controls, release application-owned resources when no longer needed, and disclose that closing/reloading can discard session results. It SHALL not promise background completion after tab closure or mobile suspension.

#### Scenario: Clear a completed session
- **WHEN** the user clears retained sources and results
- **THEN** associated session bytes, thumbnails, export resources, and active work are released without modifying any original file

#### Scenario: Requeue a source
- **WHEN** a user requeues a previously transformed source
- **THEN** a new item uses original source bytes and earlier results retain their original settings and identity
