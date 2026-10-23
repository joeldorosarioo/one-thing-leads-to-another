# Changelog

## 0.5.3

- Added GitHub artifact attestations for `main.js`, `manifest.json` and `styles.css` so users can verify their build provenance.
- Required attestation verification against the release workflow, tag and source commit before creating a release.

## 0.5.2

- Fixed sidebar and confirmation-button API compatibility while keeping support for Obsidian 1.5.0.
- Added searchable connection settings for Obsidian 1.13.0 and later, with the existing settings screen retained for older versions.
- Respected the vault's configured settings folder when validating connection paths.
- Fixed callback typing, window timers, typed value maps and DOM helper usage reported during plugin review.
- Added Obsidian API lint checks and regression coverage for compatibility, settings controls and custom configuration folders.

## 0.5.1

- Fixed clean dependency installation in CI and release workflows by allowing the esbuild installation script.
- Added the repository name explanation and its musical reference to the README.

## 0.5.0 (release candidate)

- Migrated the source to TypeScript, grouped modules by product capability and enabled strict type checking for domain and application code.
- Added Vitest unit tests while keeping the existing runtime regression tests.
- Added automatic JSON file creation inside the vault, with an advanced option to select an existing file.
- Preserved existing connections and data sources using `schema_version: 1`.
- Fixed source edits when automatic sync is off, the pending state of the Sync button and redundant `unchanged` notifications.
- Added confirmation before replacing generated notes that contain manual changes.
- Kept the editor in the right sidebar, with fields arranged in a single column.
- Kept searchable locale and ISO currency selectors in connection settings.
- Added build and release automation, along with instructions for community submission.

### Upgrading from 0.4.x

1. Back up your vault, including `.obsidian/plugins/note-template-sync/data.json`, portable JSON sources and generated notes.
2. Quit Obsidian completely.
3. Replace `main.js`, `manifest.json` and `styles.css` in `.obsidian/plugins/note-template-sync/` with the release files.
4. Keep `data.json` in that directory. It stores your existing connections.
5. Restart Obsidian and review the connection settings.

Existing connections keep their original JSON paths. New connections create managed sources under `note-template-sync/data/`.

An older generated note may have no saved fingerprint. If it differs from the template output, review it for manual edits before approving an overwrite.

Check synchronization after upgrading:

- With Auto-sync off, edit a field. The JSON should save, the note should stay unchanged and Sync should become available.
- Click Sync. The note should update and the button should become disabled once it is up to date.
- Turn Auto-sync on and edit a field again. The note should update automatically.

Keep the original data and generated Markdown until you have checked the upgrade. If something is wrong, restore the previous release files and settings from your backup.

## 0.4.x (development prototypes)

- Introduced the data editor, document generation, formulas, regional formatting and right-sidebar workflow.
