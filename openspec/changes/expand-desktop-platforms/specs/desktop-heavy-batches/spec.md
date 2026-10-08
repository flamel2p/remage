## Purpose

Support heavier local desktop workflows with measured capacity, bounded execution and cleanup, while preserving the native strict image-quality and source-safety contracts.

## ADDED Requirements

### Requirement: Native batch capacity is measured and bounded
The desktop edition SHALL publish independently qualified count, source-byte, source and planned-output pixel/dimension, concurrency, combined working-set and temporary-storage limits. Before corresponding decode/resize/encode allocations it SHALL validate rounded orientation-normalized output plans and reserve source/output rasters, native encoder/validation memory and concurrent retained resources. It SHALL reject unsafe workload admission before corresponding resource use and keep the interface responsive under its supported heavy workload. Browser limits SHALL not be presented as native qualification.

#### Scenario: Folder exceeds remaining capacity
- **WHEN** enumeration finds an image exceeding the remaining count or resource budget
- **THEN** the item is rejected with a reason, previously admitted sources remain available, and enumeration does not cause unbounded resource use

#### Scenario: Small source requests an oversized native output
- **WHEN** an admitted small source has enlargement enabled and its requested output exceeds the qualified dimension, pixel or combined working-set budget
- **THEN** submission is blocked before corresponding decode/resize/encode allocation with an actionable reason and existing completed results remain available

### Requirement: Native execution has bounded failure and cancellation
Native operations SHALL have documented execution limits and recoverable per-item failure. Cancellation SHALL stop scheduling, discard incomplete work, retain completed results, and report cancelling until safe termination/discard. Failed or late work SHALL not publish a successful partial candidate.

#### Scenario: Codec hangs during a heavy batch
- **WHEN** an operation exceeds its supported execution deadline
- **THEN** the operation is terminated or safely discarded, the item reports an actionable error, and unrelated completed results remain available

### Requirement: Packaged native strict processing proves conformance
Every advertised native strict PNG/JPEG capability SHALL satisfy the existing lossless-optimization contract in the released application, including hidden transparent RGB, orientation, metadata/color interpretation, coefficient-preserving JPEG processing, unchanged no-larger results, and non-exportable invalid candidates. Browser capability limitations SHALL not weaken that contract.

#### Scenario: Optimize an oriented profiled JPEG
- **WHEN** a supported source with orientation and color metadata is optimized in a released native build
- **THEN** the valid selected result preserves the strict contract without JPEG decode/re-encode and has smaller bytes or unchanged source bytes

### Requirement: Native temporary resources have a safe lifecycle
The desktop edition SHALL bound session result/snapshot retention, detect insufficient temporary storage, retain validated results for export retry within the session, and clean owned incomplete resources on cancellation/clear/exit. Recovery cleanup SHALL identify Remage-owned temporary resources without deleting user originals or unrelated files.

#### Scenario: Temporary storage becomes full
- **WHEN** a heavy batch cannot allocate its required temporary storage
- **THEN** the affected operation fails safely, originals remain unchanged, and previously validated results remain available for retry/export

#### Scenario: Reopen after an interrupted session
- **WHEN** Remage starts after a crash with orphaned application-owned temporary resources
- **THEN** its documented cleanup policy handles only those owned resources and never treats unrelated user files as disposable
