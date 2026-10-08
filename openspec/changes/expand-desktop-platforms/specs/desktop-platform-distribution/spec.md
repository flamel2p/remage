## Purpose

Qualify and distribute independent offline desktop artifacts only after stable web delivery, with truthful OS/architecture support, bundled codec integrity, licensing, and reproducible source builds.

## ADDED Requirements

### Requirement: Desktop implementation follows verified web stability
Desktop milestone implementation SHALL start only after WEB-STABLE is recorded for the web/PWA release. Planning readiness SHALL not be reported as satisfaction of that dependency.

#### Scenario: Web stability is not yet established
- **WHEN** this desktop change has complete planning artifacts but required web stability evidence is absent
- **THEN** the desktop implementation remains deferred

### Requirement: Each platform artifact is independently qualified
The project SHALL advertise a desktop OS/architecture only after the actual downloaded artifact passes its declared clean-host processing, folder/export, cancellation, offline, and accessibility smoke criteria. macOS arm64 evidence SHALL not qualify Intel, and a successful build SHALL not qualify Windows or Linux execution. Unsupported targets SHALL be labeled explicitly.

#### Scenario: Windows installer has only build evidence
- **WHEN** a Windows artifact has been created but its downloaded clean-host processing/export checks have not passed
- **THEN** it is not advertised as a supported verified Windows release

### Requirement: Native releases contain compatible verified dependencies
A released desktop artifact SHALL bundle compatible local processing dependencies with checked integrity, retained licenses/notices, and runtime capability probes. Normal offline processing SHALL not require downloading codecs. The application SHALL disable unavailable processing capabilities instead of promising operations it cannot execute.

#### Scenario: Bundled codec cannot execute
- **WHEN** a runtime probe finds an unavailable or incompatible native codec
- **THEN** the affected capability is disabled with an actionable reason and unrelated available operations remain usable

### Requirement: Open-source distribution is reproducible and honest
Every advertised target SHALL have documented source-build/setup and verification steps, artifact checksums, declared minimum platform requirements, and accurate signing/notarization status. Credentials SHALL not be committed or included in distributable artifacts. Release and dependency versions SHALL identify a compatible bundle for rollback.

#### Scenario: Development build is unsigned
- **WHEN** an unsigned development artifact is shared
- **THEN** its status and platform installation limitations are disclosed and it is not described as a signed/notarized public release
