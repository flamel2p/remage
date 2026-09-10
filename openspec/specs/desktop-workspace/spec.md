# desktop-workspace Specification

## Purpose

Provide a private, keyboard-accessible macOS Remage workspace for selecting,
inspecting, and preparing local image batches before an operation is submitted.

## Requirements

### Requirement: Local macOS workspace
The system SHALL provide a macOS-first desktop workspace with Optimizer and Converter modes. The workspace SHALL process imported image data locally and SHALL not require an account, upload images, load remote fonts, or contact a remote image-processing service.

#### Scenario: Open the empty workspace
- **WHEN** a user opens Remage without queued images
- **THEN** the system displays the active mode, a drop target, a keyboard-accessible image picker action, and an accurate list of currently supported source formats

#### Scenario: Process while offline
- **WHEN** the user processes a supported local image without network connectivity
- **THEN** the operation can complete without a network request

### Requirement: Accessible supplied typography and modes
The system SHALL load the supplied Atkinson Hyperlegible Next normal/italic fonts for interface text and Lilex for compact numeric/technical data. It SHALL provide keyboard-operable mode controls, visible focus, text labels for icon-only actions, and status information that is not conveyed by color alone.

#### Scenario: Navigate without drag and drop
- **WHEN** a keyboard user tabs through the empty workspace
- **THEN** the mode controls and Choose images action are reachable in visual order with a visible focus indicator

#### Scenario: Read a completed result
- **WHEN** a result is completed, unchanged, cancelled, or failed
- **THEN** its textual status identifies the state without relying only on color or an icon

### Requirement: Consistent source intake
The system SHALL route macOS file picker, drag-and-drop, and supported folder intake through one validation and inspection path. It SHALL detect a source's supported type from content rather than extension alone and SHALL not modify source bytes during intake.

#### Scenario: Add supported files using either input method
- **WHEN** the user selects or drops the same supported image
- **THEN** the system creates an equivalent ready queue item with the source name, byte size, visible dimensions, and detected format

#### Scenario: Reject an extension mismatch
- **WHEN** a file has an allowed extension but its contents are not a supported image
- **THEN** the system reports the file as unsupported or invalid and does not submit it for processing

### Requirement: Bounded and recoverable queue inspection
The system SHALL inspect sources before processing and SHALL expose ready, processing, completed, unchanged, error, and cancelled states. It SHALL reject files that exceed the documented count, source-byte, decoded-pixel, or dimension limits before the corresponding unsafe allocation. An invalid source SHALL not prevent other valid sources from becoming ready.

#### Scenario: Mixed valid and invalid intake
- **WHEN** a user imports one supported image and one corrupt image
- **THEN** the supported image becomes ready and the corrupt image reports an actionable error independently

#### Scenario: Requeue a source after earlier processing
- **WHEN** the user explicitly requeues a previously processed source with different settings
- **THEN** the system creates a new queue item linked to the source and preserves the earlier result unchanged

### Requirement: Honest capability reporting
The system SHALL enable an import, operation, or output format only when the running build can perform it. It SHALL reject static images with unsupported animation, page count, bit depth, or color model when the operation cannot preserve the documented contract.

#### Scenario: Unsupported animated input
- **WHEN** the user adds an animated image to an operation that only supports static images
- **THEN** the system identifies animation as the reason and does not flatten the image into a successful result
