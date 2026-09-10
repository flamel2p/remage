## Purpose

Give users explicit, correctly disclosed resizing and static image conversion
for the initial PNG, JPEG, and WebP format matrix.

## ADDED Requirements

### Requirement: Resize uses explicit dimension semantics
The system SHALL keep resize disabled by default. With aspect ratio locked, one entered dimension SHALL derive the other and two entered dimensions SHALL describe a no-crop containing box. With aspect ratio unlocked, both dimensions SHALL be required and SHALL define exact output dimensions. The system SHALL reject invalid dimensions and SHALL not enlarge sources unless the user explicitly enables enlargement.

#### Scenario: Fit within two locked bounds
- **WHEN** a user enables resize with aspect ratio locked and enters width and height bounds
- **THEN** the output fits within both bounds without cropping or enlargement and the system displays the expected rounded dimensions before processing

#### Scenario: Reject invalid exact dimensions
- **WHEN** a user enables unlocked resize with a missing, zero, negative, decimal, or over-limit dimension
- **THEN** the system identifies the invalid input and prevents submission

### Requirement: Resize changes the quality contract honestly
The system SHALL identify resized results as transformations rather than as original-image-data-preserving optimization. Resizing to JPEG SHALL disclose that JPEG re-encoding is lossy before the batch can be submitted.

#### Scenario: Resize a JPEG in Optimizer mode
- **WHEN** the user enables resize for a JPEG source
- **THEN** the system shows that the strict original-dimension optimization contract no longer applies and requires acknowledgement of JPEG's lossy transformation behavior before processing

### Requirement: Converter exposes a verified static format matrix
The system SHALL permit conversion only between the verified static PNG, JPEG, and WebP input/output capabilities of the running build. The selected output's file signature, extension, type, and decoded dimensions SHALL agree.

#### Scenario: Convert PNG to WebP
- **WHEN** the user selects WebP and submits a supported static PNG
- **THEN** the system exports a valid WebP with the reported dimensions and a `.webp` filename

#### Scenario: Hide an unavailable encoder
- **WHEN** a target format is not available in the running build
- **THEN** the system does not present that format as a selectable output option

### Requirement: Format loss and transparency are disclosed
The system SHALL distinguish lossless and lossy encoder choices according to their actual configuration. Before converting a transparent source to JPEG, it SHALL show and apply a user-visible background color. It SHALL report a larger converted output as a completed transformation, not a processing failure.

#### Scenario: Convert transparent PNG to JPEG
- **WHEN** the user selects JPEG for a transparent PNG
- **THEN** the system requires a background selection, applies that background, and labels the conversion as lossy

#### Scenario: Conversion increases size
- **WHEN** a valid conversion creates more bytes than its source
- **THEN** the result completes and reports the signed size increase

### Requirement: Transformations start from the source
The system SHALL process resize, conversion, and optional lossy settings from the selected source bytes, not from a previous result. A current setting change SHALL not alter a submitted or completed result's operation description.

#### Scenario: Reprocess with new settings
- **WHEN** the user requeues a source after completing a prior conversion
- **THEN** the new result uses the source bytes and the prior result retains its original settings and output identity
