## Purpose

Run browser batches with stable settings and accurate results, then provide safe single-file and bounded archive downloads without claiming unobservable filesystem publication.

## ADDED Requirements

### Requirement: Browser batches retain submitted settings
The browser edition SHALL capture source identity, operation, output format, resize, encoder, and metadata settings at submission. Later controls SHALL not alter queued, active, or completed work. Actual accounting SHALL use eligible completed/unchanged source/result bytes and distinguish errors and cancellations.

#### Scenario: Settings change during processing
- **WHEN** visible mode or settings change after a batch starts
- **THEN** all submitted results retain the captured settings and their labels, dimensions, and byte totals describe that operation

### Requirement: Browser cancellation preserves valid results
Cancellation SHALL stop queued scheduling, invalidate uncommitted active outputs, show cancelling until a safe discard point, and preserve validated completed results. Late output from cancelled work SHALL not be published.

#### Scenario: Cancel with one completed result
- **WHEN** the user cancels while one item is completed and another is active
- **THEN** the completed result remains downloadable and active/queued cancelled work never appears as a successful partial output

### Requirement: Single downloads report observable outcomes
The browser edition SHALL offer explicit downloads of validated result bytes using a sanitized format-correct filename. It SHALL distinguish processing completion, download preparation/request, and download errors. It SHALL not claim a confirmed saved file, destination, or filesystem collision guarantee when only download initiation is observable.

#### Scenario: Request a result download
- **WHEN** a user initiates a supported single-result download
- **THEN** the correct result bytes and suggested name are supplied and status reports download requested rather than verified saved-to-folder publication

### Requirement: Batch ZIP export is bounded and deterministic
The browser edition SHALL offer one ZIP containing selected available completed/unchanged results with sanitized collision-safe entry names and correct bytes/extensions. It SHALL display excluded failed/cancelled/unavailable counts and enforce both the serialized archive budget and a combined working-set reservation for retained sources/results/thumbnails, archive output, transfer/temporary copies and Worker scratch space before allocation. Any idle image Worker's retained WASM heap SHALL be included or that Worker terminated before archive allocation. Archive generation SHALL run incrementally in a cancellable dedicated Worker, pause new image scheduling, and wait for active image work to finish or be explicitly cancelled before archive allocation. Over-budget selection SHALL allow smaller selections or individual downloads.

#### Scenario: Duplicate names and mixed results
- **WHEN** selected results include duplicate basenames and failed or cancelled items
- **THEN** each eligible result has a distinct safe ZIP entry and excluded items are counted visibly

#### Scenario: Archive exceeds the budget
- **WHEN** selected result bytes plus archive overhead exceed the published limit
- **THEN** archive generation is blocked before unsafe allocation and smaller selection or individual downloads remain available

#### Scenario: Serialized archive fits but combined memory does not
- **WHEN** the archive fits its serialized size ceiling but retained data and temporary archive working space exceed the qualified combined budget
- **THEN** archive allocation is blocked, results remain available, and smaller selections or individual downloads are offered

#### Scenario: Request an archive during image processing
- **WHEN** the user requests an admitted archive while an image job is active
- **THEN** new image scheduling pauses, archive allocation waits for that job to finish or be explicitly cancelled, and the interface remains responsive during Worker-based archive generation

### Requirement: Export failure does not erase processing results
Download/archive failure or cancellation SHALL release incomplete export resources, retain validated results, and allow retry without reprocessing. Invalid candidates SHALL never become exportable through a fallback path.

#### Scenario: Cancel archive preparation
- **WHEN** the user cancels an in-progress archive
- **THEN** archive work and incomplete resources are released, selected validated results remain available, and queued image scheduling can resume

#### Scenario: Retry an archive failure
- **WHEN** an archive cannot be prepared or its download fails to initiate
- **THEN** the user sees an actionable export error and can retry with the retained results
