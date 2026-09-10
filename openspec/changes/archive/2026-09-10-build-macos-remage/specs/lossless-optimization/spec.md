## Purpose

Minimize supported static PNG and JPEG files without changing the documented
image content or replacing an original with a larger candidate.

## ADDED Requirements

### Requirement: Strict optimization is the default
The system SHALL run strict lossless optimization by default for supported static PNG and JPEG sources at their original visible dimensions and in their original format. Strict JPEG optimization SHALL avoid a decode/re-encode image-data path; strict PNG optimization SHALL preserve decoded samples, including RGB values beneath fully transparent pixels.

#### Scenario: Optimize a supported JPEG without resize
- **WHEN** the user submits a supported static JPEG in default Optimizer settings
- **THEN** the system returns either a valid smaller JPEG satisfying the strict contract or the unchanged source result

#### Scenario: Optimize a transparent PNG
- **WHEN** the user submits a supported transparent PNG in default Optimizer settings
- **THEN** the selected result preserves its alpha and decoded pixel samples, including fully transparent pixel values

### Requirement: Strict optimization preserves rendering-relevant information
For the supported strict subset, the system SHALL preserve visible dimensions, orientation, transparency, color interpretation, and rendering-relevant metadata. Metadata removal SHALL be an explicit separate setting and SHALL not remove orientation or color information required for correct rendering.

#### Scenario: Optimize an oriented image
- **WHEN** the user strictly optimizes a supported image with orientation metadata
- **THEN** the result has the same visible orientation and dimensions as the source

#### Scenario: Keep metadata by default
- **WHEN** the user leaves metadata removal disabled
- **THEN** the system does not remove source metadata as an implicit side effect of strict optimization

### Requirement: No-larger optimization fallback
The system SHALL validate every strict candidate before selection. If a valid candidate is not smaller than the source, the system SHALL retain the source as the selected result and mark the item unchanged rather than claim a saving. If a candidate fails validation, the system SHALL mark the item as an error and SHALL not make either candidate bytes or an unverified source fallback exportable under an optimization result.

#### Scenario: Optimize an already efficient source
- **WHEN** no valid strict candidate is smaller than a supported source
- **THEN** the result reports No size reduction with source and result byte counts that are equal

#### Scenario: Reject a malformed candidate
- **WHEN** an optimizer produces bytes that do not validate as the expected format
- **THEN** the system reports an item error and does not make those bytes exportable

### Requirement: Strict support boundaries are explicit
The system SHALL reject inputs outside the verified strict subset with a reason that identifies the unsupported preservation condition. It SHALL not silently switch to lossy optimization, flatten animation, reduce depth, or remove pages to obtain a result.

#### Scenario: Unsupported high-depth source
- **WHEN** a source uses an unsupported high bit depth for strict optimization
- **THEN** the system reports the unsupported property and leaves the source unmodified
