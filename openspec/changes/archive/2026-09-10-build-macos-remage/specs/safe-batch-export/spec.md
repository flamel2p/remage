## Purpose

Run local image batches predictably and publish completed files without
overwriting sources, losing valid results, or misreporting their outcomes.

## ADDED Requirements

### Requirement: Submitted batches retain immutable settings
The system SHALL capture mode, output format, encoder choices, resize settings, destination, and metadata policy when a batch is submitted. Later changes to controls or mode SHALL not change the operation, result labels, or output identity of queued, processing, or completed items.

#### Scenario: Change the active format while a batch runs
- **WHEN** the user changes the currently visible converter format after submitting a batch
- **THEN** submitted items continue with their captured format and results report that captured format

### Requirement: Batch progress and cancellation are safe
The system SHALL run source processing with bounded concurrency away from the interface. Cancellation SHALL stop queued work, prevent incomplete candidates from publication, retain completed results, and report a cancelling state while an uninterruptible active operation reaches a safe discard point.

#### Scenario: Cancel a mixed-progress batch
- **WHEN** a user cancels a batch after one item completes and another is processing
- **THEN** the completed result remains available, queued items become cancelled, and the active item never becomes a successful incomplete export

### Requirement: Results use actual accounting
The system SHALL show each completed or unchanged result's source bytes, result bytes, source/target format, dimensions, operation, and textual status. Savings SHALL equal source bytes minus result bytes. Aggregate totals SHALL exclude errors and cancellations and SHALL count unchanged results separately from failures.

#### Scenario: View a mixed-result summary
- **WHEN** a batch contains completed, unchanged, cancelled, and failed items
- **THEN** the summary reports each count distinctly and derives totals only from eligible completed or unchanged results

### Requirement: Output publication preserves sources and existing outputs
The system SHALL write a successful result separately from its source, use an output name with the expected extension, and avoid silent collisions with any existing source or output. It SHALL use temporary publication and exclusive/atomic finalization where the platform supports it, remove incomplete artifacts after failure/cancellation, and preserve a valid in-memory result after export failure.

#### Scenario: Export alongside a source
- **WHEN** the user exports an optimized image to the source folder
- **THEN** the source remains unchanged and the output receives a collision-safe derived name

#### Scenario: Retry a failed export
- **WHEN** a destination becomes unwritable during export
- **THEN** the system reports an export error, retains the processed result, and allows another destination to be selected for retry

### Requirement: File paths remain within user-authorized destinations
The system SHALL derive output names without allowing a source name or output name to escape the destination selected by the user. It SHALL not follow symbolic links during folder intake and SHALL not overwrite files through a resolved destination link.

#### Scenario: Source name contains path components
- **WHEN** a source has a name containing path separator or traversal-like characters
- **THEN** the output is safely named within the user-authorized destination and no outside path is written
