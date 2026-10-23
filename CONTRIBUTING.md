# Contributing

Use English for product text, comments, pull requests and documentation.

## Code conventions

Use kebab-case for filenames and directories. Keep names required by the toolchain, such as `main.js` and `manifest.json`. Functions, variables and parameters use camelCase; types and interfaces use PascalCase. Constants may use UPPER_CASE. Preserve snake_case keys in saved JSON so existing data and templates keep working.

Prefer functions and composition. Keep state in small factories with explicit dependencies. The subclasses required by Obsidian belong in `src/infrastructure/obsidian/`; other code should avoid custom classes and constructors. Ordinary dialogs use `new Modal(app)` with callbacks.

Prettier defines the format: two spaces, LF, single quotes, semicolons and a target line width of 120. Run `pnpm run format` before review. Keep formatting changes separate from behavior changes where practical.

## Development

Use Node.js 22 or newer and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

For individual checks, use `pnpm run typecheck`, `pnpm run test`, `pnpm run lint` or `pnpm run format:check`.

Start a behavior change with a failing test that reproduces the problem. Make the smallest correction, then refactor while keeping the full suite green. Test observable results, including data preservation and cancellation. Use controlled timers in new scheduler tests so they do not need to wait on the clock.

## Architecture

Keep code grouped by responsibility:

- `src/domain/`: document validation, expressions, template rendering and formatting.
- `src/application/`: connections, document editing, generation and synchronization. `ports/` defines the vault contract used by these services.
- `src/features/`: connection settings, dialogs and the data editor.
- `src/infrastructure/obsidian/`: lifecycle registration, workspace operations and platform adapters.
- `src/shared/`: portable helpers for identifiers, paths, errors and value checks.

`plugin-entry.ts` composes the application services and registers the adapters. Features receive `ConnectionActions` or `EditorActions` instead of the plugin class. Domain, application and shared modules stay independent of Obsidian, features and infrastructure. ESLint checks these boundaries.

Queue source edits by data path so connections sharing JSON cannot lose concurrent changes. Keep settings writes in order. On unload, cancel timers and prevent pending source edits from writing. Sync controls must discard stale results after a newer check, a render or disposal.

Use the same rendered snapshot for the generated note and its fingerprint. Require approval on each request that replaces external edits; never save that approval in settings. Recheck automatic sync before writing, including after asynchronous folder creation. With automatic sync off, source edits save and the note waits for manual Sync. Preserve existing data and output if validation fails.

Keep persisted keys such as `jobs`, `data_path`, `template_path`, `output_path`, `last_output_hash` and `schema_version: 1`. Preserve custom source metadata during edits. Ignore legacy `overwrite_approved` values and strip them when saving settings. Managed sources live in `note-template-sync/data/`; existing sources keep their paths during upgrades.

## Source and generated files

Make code changes in `src/`. Keep `.build/`, package-manager caches and test output local. Run `pnpm run build` to regenerate `main.js`, which is kept in the repository for distribution. Edit the source rather than the generated JavaScript.

Add dependencies only when they solve a clear need. Keep private vault data, financial records, tokens and other personal information out of issues and pull requests.

## Releasing

1. Review the author and version in `manifest.json`, along with `LICENSE`, `README.md` and the example data. The release tag must match the version in both `manifest.json` and `package.json`.
2. Confirm that `pnpm run check` and CI pass. Test in a disposable Obsidian vault, including an upgrade from v0.4.x and a generated note with manual edits.
3. Tag and push the release. For version 0.5.0:

```sh
git tag 0.5.0
git push origin 0.5.0
```

GitHub Actions creates a draft release containing `main.js`, `manifest.json` and `styles.css`. Inspect and test those files, then publish the release so Obsidian can download it.

For community submission, confirm that `note-template-sync` is available and follow the official [plugin submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). Address review feedback and publish an updated release if needed.
