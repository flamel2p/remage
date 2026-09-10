## ADDED Requirements

### Requirement: Persistent workspace header and mode recognition
The system SHALL keep the Remage header visible while the workspace content
scrolls. The header SHALL contain keyboard-operable Optimizer and Converter
controls in its visual center, and SHALL make the active mode identifiable by a
textual selected state in addition to its visual color treatment. The fixed
bottom action area SHALL present both the local-processing statement and the
statement that files never leave the user's Mac whenever no batch is running.

#### Scenario: Identify the active mode while viewing workspace content
- **WHEN** a user scrolls through a populated workspace
- **THEN** the header remains visible and identifies the currently active
  Optimizer or Converter mode without relying on color alone

#### Scenario: View privacy commitments while idle
- **WHEN** no batch is running
- **THEN** the fixed bottom action area displays the local-processing statement
  above the Files never leave your Mac statement

### Requirement: Destination and application information settings
The system SHALL provide labeled header actions to open the currently selected
session output destination and to open a keyboard-accessible settings dialog.
The dialog SHALL contain a Save destination section that preserves the existing
destination-selection and automatic-export behavior, and an About section that
shows the application version, the Remage license, and bundled third-party
notice information. The system SHALL not expose an unselected or unauthorized
filesystem path to the renderer.

#### Scenario: Choose a save destination from settings
- **WHEN** a user selects a destination in the settings dialog
- **THEN** the application validates it through the native folder picker,
  retains it only for the current session, and uses it for subsequent automatic
  exports as before

#### Scenario: Open the selected destination
- **WHEN** a user activates the open-destination header action after selecting
  a session destination
- **THEN** macOS opens that selected folder without the renderer receiving its
  filesystem path

#### Scenario: Attempt to open without a destination
- **WHEN** no session output destination has been selected and a user activates the
  open-destination header action
- **THEN** the action remains keyboard-accessible, explains that a destination must
  be selected in Settings first, and does not invoke the native folder-open action

#### Scenario: Dismiss settings with a keyboard
- **WHEN** the settings dialog is open and the user presses Escape or activates
  its close action
- **THEN** the dialog closes and keyboard focus returns to the settings action
