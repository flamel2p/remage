## Purpose

Perform verified local browser image transformations while separating encoder choices, metadata policy, and strict preservation guarantees from unsupported desktop parity claims.

## ADDED Requirements

### Requirement: Verified browser conversion matrix
The browser edition SHALL support the advertised static 8-bit PNG/JPEG/WebP input/output combinations for its published color/metadata subset. Output signatures, extensions, types, visible orientation, and dimensions SHALL agree. Animation, pages, unsupported depth, color interpretation, or metadata preservation SHALL be rejected explicitly rather than silently discarded.

#### Scenario: Convert a supported source
- **WHEN** a user selects an available output for a supported static image
- **THEN** a validated result has the chosen format, extension, dimensions, and disclosed transformation policy

#### Scenario: Required color interpretation is unsupported
- **WHEN** a source profile or color model cannot be correctly interpreted under the chosen operation
- **THEN** the operation is rejected with a reason and does not strip the profile to disguise unsupported processing

### Requirement: Browser transformations disclose fidelity changes
The browser edition SHALL keep resize off and aspect lock/no enlargement on by default, apply source orientation before resize planning, use containing-box or exact-dimension semantics consistently, and validate rounded output dimensions. Before decode/resize/encode allocations it SHALL enforce source and planned-output dimension/pixel budgets and admit the combined retained-data, source/output raster, encoder/WASM and validation working set. JPEG encoding SHALL require loss acknowledgement and apply the selected alpha background. Larger valid transformations SHALL complete with signed byte increases. A lossless output encoder SHALL not be described as preserving all original source detail after resize/conversion.

#### Scenario: Resize an oriented JPEG
- **WHEN** the user resizes a supported JPEG with orientation metadata
- **THEN** planned and output dimensions follow its visible orientation and JPEG re-encoding is acknowledged before submission

#### Scenario: Convert transparency to JPEG
- **WHEN** a user converts a transparent PNG or WebP to JPEG
- **THEN** the chosen background is applied, output has no alpha, and the result is identified as lossy conversion

#### Scenario: Small source requests an oversized output
- **WHEN** an admitted small source has enlargement enabled and its requested rounded output exceeds the published dimension, pixel or combined working-set budget
- **THEN** submission is blocked before corresponding decode/resize/encode allocation with an actionable reason and existing completed results remain available

### Requirement: Metadata policy requires explicit support or selection
The browser edition SHALL keep metadata preservation selected by default. If a chosen operation cannot fulfill that policy, it SHALL reject submission and explain the limitation. Any metadata removal SHALL require an explicit user selection; orientation and color information needed for correct rendering SHALL still be applied consistently.

#### Scenario: Preservation cannot be fulfilled
- **WHEN** a source contains metadata the selected adapter cannot preserve
- **THEN** processing is blocked with a recoverable explanation and metadata is not removed implicitly

#### Scenario: User selects metadata removal for transformation
- **WHEN** a user explicitly selects removal for an otherwise supported transformation
- **THEN** the result records that policy and preserves correct visible orientation and verified color interpretation

### Requirement: Browser strict optimization is evidence-gated
The browser edition SHALL expose strict optimization only for a verified format/subset preserving same-format decoded samples, hidden transparent RGB, dimensions, orientation, alpha, ICC/EXIF, and required color information. Strict JPEG SHALL avoid decode/re-encode. Every candidate SHALL validate before selection; a valid non-smaller candidate SHALL yield unchanged source bytes, while a failed candidate SHALL yield a non-exportable error. Browser strict JPEG parity SHALL not be a mandatory web v1.0 release capability.

#### Scenario: No smaller strict candidate
- **WHEN** a valid strict candidate is equal to or larger than the source
- **THEN** the selected result is the unchanged source with equal byte counts and no claimed saving

#### Scenario: Candidate changes preservation information
- **WHEN** a candidate changes required pixels, metadata, orientation, alpha, or color information
- **THEN** the item fails and candidate bytes are not exposed as successful optimization

### Requirement: Browser processing is bounded and recoverable
Image processing SHALL run away from the interface with documented concurrency/resource limits and bounded execution. Failures or timeouts SHALL preserve unrelated completed results, provide per-file recovery, and prevent stale or incomplete work from becoming successful results.

#### Scenario: Active processing fails
- **WHEN** active processing crashes or exceeds its execution limit
- **THEN** the source has an actionable error, unrelated results remain downloadable, and the user can retry or process subsequent work without reloading
