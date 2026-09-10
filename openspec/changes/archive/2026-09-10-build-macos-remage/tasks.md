## 1. Project foundation and security boundary

- [x] 1.1 Create the Electron, React, TypeScript, and Vite project structure with reproducible install, typecheck, lint, test, development, and macOS package commands.
- [x] 1.2 Configure the secure local window, content security policy, preload bridge, validated IPC sender/payload handling, and blocked remote navigation/window creation.
- [x] 1.3 Define shared schemas and DTOs for source inspection, capabilities, settings snapshots, queue/result/export states, errors, and progress events.
- [x] 1.4 Add local Atkinson Hyperlegible Next and Lilex font declarations, design tokens, accessible mode controls, and Optimizer/Converter empty workspace shell.
- [x] 1.5 Add test infrastructure and tests for shared schemas, state transitions, and font/style asset inclusion.

## 2. Intake, inspection, and queue

- [x] 2.1 Implement main-process source/destination selection and supported macOS folder traversal with symlink, hidden-file, duplicate, and limit handling.
- [x] 2.2 Implement secure drag/drop intake and opaque source/task identifiers without renderer filesystem or shell access.
- [x] 2.3 Implement content-based static-image inspection, capability checks, orientation-aware metadata DTOs, thumbnail generation, and per-source validation errors.
- [x] 2.4 Implement the editable queue, source details, remove/clear/requeue behavior, visual status states, and complete keyboard path.
- [x] 2.5 Add integration and UI tests for picker/drop parity, corrupt/unsupported inputs, duplicate/requeue behavior, limits, and source-byte preservation during intake.

## 3. Strict lossless PNG and JPEG optimization

- [x] 3.1 Select, pin, and package macOS arm64/x64 strict PNG/JPEG adapter dependencies; implement startup capability probes and license-notice inventory.
- [x] 3.2 Implement the strict JPEG coefficient-preserving adapter, fixed argument invocation, metadata policy, temporary candidates, and validation.
- [x] 3.3 Implement the strict PNG decoded-sample-preserving adapter without alpha-value optimization, with metadata policy, temporary candidates, and validation.
- [x] 3.4 Implement candidate comparison, no-larger source fallback, unchanged status, strict-subset rejection, and actual per-item/aggregate byte accounting.
- [x] 3.5 Implement the bounded background BatchCoordinator with immutable submissions, progress events, cancellation/cleanup, and isolated adapter failures.
- [x] 3.6 Implement collision-safe atomic OutputPublisher, per-result/all-result export, retryable export failures, and destination/name validation.
- [x] 3.7 Add fixture tests for strict PNG/JPEG sample/pixel preservation, JPEG adapter selection, transparent RGB, orientation, ICC/metadata, already-optimized inputs, invalid candidates, cancellation, collisions, and failed writes.

## 4. Resize and conversion

- [x] 4.1 Implement and test resize input validation, orientation-aware bounds math, integer rounding, aspect lock, exact dimensions, no-enlargement defaults, and setting snapshots.
- [x] 4.2 Add the packaged static PNG/JPEG/WebP transformation adapter with capability-gated decode/encode, source-based processing, target validation, and compatible metadata handling.
- [x] 4.3 Implement format selection, resize controls, strict-to-transform disclosures, JPEG loss acknowledgement, transparent-to-JPEG background selection, and result details.
- [x] 4.4 Add integration tests for valid format signatures/extensions/dimensions, PNG-to-WebP, transparent PNG-to-JPEG, larger conversions, invalid resize input, and unsupported animation/depth/page inputs.

## 5. macOS quality and release evidence

- [x] 5.1 Implement validated preference persistence and safe reset behavior without persisting image data, task history, or source paths.
- [x] 5.2 Complete accessibility review and fixes for focus visibility, labelled icon actions, live progress/status, long Unicode names, reduced motion, 200% text scaling, and the 800 × 600 content area.
- [x] 5.3 Write README, architecture, build instructions, support matrix, troubleshooting, privacy statement, source-license decision, and third-party/font notices.
- [x] 5.4 Configure macOS artifact packaging so native dependencies and local fonts ship correctly; run clean-install and packaged-app smoke tests on macOS arm64 and x64 where available.
- [x] 5.5 Produce a requirement-to-evidence verification record, resolve review findings, and update the plan only with actual command results and supported capability claims.
