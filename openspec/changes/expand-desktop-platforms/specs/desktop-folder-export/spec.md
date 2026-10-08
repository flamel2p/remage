## Purpose

Provide dependable native folder intake and automatic export on each supported desktop OS without overwriting originals, escaping authorization, or losing valid results after publication failures.

## ADDED Requirements

### Requirement: Folder intake remains user-authorized and bounded
The desktop edition SHALL validate selected files and folders consistently, skip symbolic links/reparse equivalents and hidden/system entries under its documented policy, and bound traversal/admission. Native paths SHALL remain opaque outside the trusted platform boundary.

#### Scenario: Folder contains links and invalid images
- **WHEN** the user imports a selected folder containing supported images, link entries, corrupt files, and nested folders
- **THEN** valid images enter the bounded queue, excluded entries are reported according to policy, and links do not expand authorization or create traversal cycles

### Requirement: Automatic export uses the submitted session destination
The desktop edition SHALL allow a user-selected session destination for automatic export and capture it with submitted settings. Later changes SHALL not redirect existing submitted work. Destination safety and writability SHALL be checked during publication, and the user SHALL be able to open a valid selected destination through a trusted platform action.

#### Scenario: Change destination after submitting a batch
- **WHEN** a new destination is selected while an earlier batch is active
- **THEN** that batch retains its submitted destination and new settings do not redirect its outputs

### Requirement: Native publication preserves originals and collisions
Native export SHALL use sanitized target-compatible names, preserve source bytes, remain inside the selected destination, and finalize separately without silent overwrite. Unsupported filesystem publication guarantees SHALL cause a safe actionable failure rather than destructive fallback. Publication success SHALL be reported only after the output is actually written successfully.

#### Scenario: Existing name collides on the target filesystem
- **WHEN** a derived output name collides with an original or existing output, including case-insensitive or reserved-name cases
- **THEN** the system selects a safe distinct name or reports an actionable error and does not overwrite the existing file

#### Scenario: Destination path changes into a link
- **WHEN** a destination/link changes outside validated user authorization between the initial check and publication finalization
- **THEN** export is refused safely and no outside path or existing file is overwritten

### Requirement: Failed native export remains retryable
Permission denial, removed destinations, unsupported volumes, disk exhaustion, and interrupted publication SHALL remove incomplete owned artifacts, retain the validated candidate, and offer another destination without reprocessing. Cancellation SHALL not erase an already published valid output.

#### Scenario: Destination disappears during automatic export
- **WHEN** a selected destination becomes unavailable after processing succeeds
- **THEN** the result reports a publication error and remains available for export to another validated destination
