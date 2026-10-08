## Purpose

Make Remage optionally installable and reliably usable offline after setup, with honest cache readiness, safe version updates, and a measurable stability handoff to desktop development.

## ADDED Requirements

### Requirement: Installation is progressive
The browser edition SHALL provide valid application identity/icons and installation guidance for verified supported browser/OS combinations. Unavailable installation SHALL not block core browser workflows. Installation SHALL not imply native filesystem powers or unrestricted background execution.

#### Scenario: Browser cannot offer installation
- **WHEN** a user opens Remage in a browser without supported installation
- **THEN** file processing and downloads remain usable and installation controls do not imply unavailable support

### Requirement: Offline readiness covers every advertised operation
The PWA SHALL report offline-ready only when a compatible application shell, fonts, processing assets, and all required format codecs are cached. While that complete asset set remains available, supported processing/download workflows SHALL work with networking disabled, including reopening a verified installed surface. Initial setup SHALL disclose that cache eviction can require connectivity for recovery and that complete shell eviction can prevent offline launch. Recovery guidance SHALL be shown when a runnable shell exists; permanent cache retention SHALL not be promised.

#### Scenario: Reopen an offline-ready PWA
- **WHEN** a verified installed PWA is closed and reopened without networking after complete setup and the required cached assets remain available
- **THEN** all advertised offline format operations and downloads can complete from local assets

#### Scenario: Required cached assets are unavailable
- **WHEN** a runnable shell exists but the browser evicts or fails to cache a required codec asset
- **THEN** the app does not claim complete offline readiness and gives actionable reconnect/recovery guidance without pretending an unsupported operation succeeded

#### Scenario: Complete shell eviction while offline
- **WHEN** the browser evicts the application shell and the device has no connectivity
- **THEN** offline application launch is not promised and online reopening restores a complete coherent asset set before offline readiness is reported again

### Requirement: Application caches exclude user images
The PWA SHALL cache application assets only. Imported images, thumbnails, identifying filenames, filesystem handles, and results SHALL not enter service-worker caches or persistent application storage.

#### Scenario: Inspect caches after processing
- **WHEN** a user processes images, exports results, and updates the app
- **THEN** persistent application caches contain only application assets and no user-selected image/session data

### Requirement: Updates preserve active work and coherent assets
The PWA SHALL keep UI and processing asset versions compatible. A new version SHALL activate at a safe user-visible point without forcing away active work or retained results. Multiple open clients SHALL not lose required assets through another client's app-controlled update; unresponsive clients SHALL not be assumed to consent to destructive activation or cleanup. Failed updates SHALL preserve the last complete usable version against app-controlled cache changes, without guaranteeing survival of independent browser eviction. Version recovery SHALL be actionable when a runnable shell exists and otherwise require online reopening.

#### Scenario: Update while a batch is active
- **WHEN** a new build becomes available during processing
- **THEN** the existing batch continues with its compatible assets and activation waits until safe session handling is explicitly chosen

#### Scenario: Incomplete update with another client open
- **WHEN** an update fails to acquire all required assets while an older client remains open
- **THEN** the older complete version remains usable and its required assets are not retired

#### Scenario: Another client does not respond to an update
- **WHEN** one client accepts an update but another live client is frozen or does not report safe session handling
- **THEN** destructive activation and old-asset cleanup are deferred rather than treating the missing response as consent

### Requirement: Web stability gates precede desktop implementation
The project SHALL record WEB-STABLE evidence for W-01 through W-12 in the execution plan against a named production artifact, browser/device matrix, corpus, and measured limits before starting the deferred desktop implementation. No unresolved corruption, privacy, false fidelity, crash, core-flow, or unsafe-update blocker SHALL remain. Planning completion or historical desktop tests SHALL not be reported as web release evidence.

#### Scenario: Proposed web release still has a blocker
- **WHEN** a required supported browser cannot complete a core flow or update/privacy gate
- **THEN** web stability remains unapproved and deferred desktop implementation does not start
